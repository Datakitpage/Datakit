import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Document, Page } from 'react-pdf';
import { initPDFWorker } from '@/lib/pdf/pdfWorkerConfig';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PDFViewerProps {
  url: string;
  pageCount?: number;
  fileName: string;
  accentColor: string;
}

export function PDFViewer({ url, pageCount: initialPageCount, accentColor }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(initialPageCount || 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [workerReady, setWorkerReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initPDFWorker().then(() => setWorkerReady(true));
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const goToPrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(numPages, prev + 1));
  }, [numPages]);

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(3.0, +(prev + 0.25).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(0.25, +(prev - 0.25).toFixed(2)));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1.0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if an input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === '=' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevPage, goToNextPage, zoomIn, zoomOut, resetZoom]);

  if (!workerReady) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: `${accentColor}30`, borderTopColor: accentColor }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--surface-secondary)',
        }}
      >
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="px-2 py-1 rounded text-sm transition-colors disabled:opacity-30 hover:bg-black/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            &larr;
          </button>
          <span className="text-xs tabular-nums min-w-[60px] text-center" style={{ color: 'var(--text-primary)' }}>
            {currentPage} / {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
            className="px-2 py-1 rounded text-sm transition-colors disabled:opacity-30 hover:bg-black/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            &rarr;
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.25}
            className="px-2 py-1 rounded text-sm transition-colors disabled:opacity-30 hover:bg-black/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            &minus;
          </button>
          <button
            onClick={resetZoom}
            className="px-2 py-1 rounded text-xs tabular-nums min-w-[48px] text-center transition-colors hover:bg-black/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className="px-2 py-1 rounded text-sm transition-colors disabled:opacity-30 hover:bg-black/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            +
          </button>
        </div>
      </div>

      {/* PDF content area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center p-6"
        style={{ backgroundColor: 'var(--surface-secondary)' }}
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center py-20">
              <div
                className="w-8 h-8 border-2 rounded-full animate-spin"
                style={{ borderColor: `${accentColor}30`, borderTopColor: accentColor }}
              />
            </div>
          }
          error={
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Failed to load PDF
              </p>
            </div>
          }
        >
          <motion.div
            key={currentPage}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              className="shadow-lg rounded-lg overflow-hidden"
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </motion.div>
        </Document>
      </div>
    </div>
  );
}
