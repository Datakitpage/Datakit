import { pdfjs } from 'react-pdf';

const PDFJS_VERSION = pdfjs.version;
const PDFJS_CDN = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build`;

let workerInitialized = false;

/**
 * Initialize PDF.js worker using CDN + blob URL pattern.
 * Required because COEP headers block direct cross-origin worker loading.
 * Same pattern as DuckDB worker loading in src/lib/duckdb/config.ts.
 */
export async function initPDFWorker(): Promise<void> {
  if (workerInitialized) return;

  try {
    const response = await fetch(`${PDFJS_CDN}/pdf.worker.min.mjs`);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF.js worker: ${response.status}`);
    }
    const blob = await response.blob();
    const workerUrl = URL.createObjectURL(blob);

    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerInitialized = true;
  } catch (error) {
    console.error('[PDF] Failed to initialize worker, falling back to inline:', error);
    // Fallback: disable the worker (slower but functional)
    pdfjs.GlobalWorkerOptions.workerSrc = '';
  }
}
