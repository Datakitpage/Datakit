import { defineConfig } from 'vite'
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils')
    }
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
    include: ['apache-arrow']
  },
  build: {
    target: ['es2015', 'safari11'],
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('@duckdb/duckdb-wasm')) {
              return 'duckdb';
            }
            if (id.includes('xlsx')) {
              return 'xlsx';
            }
            if (id.includes('pdfjs-dist') || id.includes('react-pdf')) {
              return 'pdf';
            }
          }
        },
      },
    },
  },
  server: {
    port: 5180,
  },
})
