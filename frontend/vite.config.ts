import { defineConfig } from 'vite'
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command, mode }) => {
  const isElectronBuild = process.env.ELECTRON_BUILD === 'true';
  console.log('Building for Electron:', isElectronBuild);
  
  return {
    base: isElectronBuild ? './' : '/',
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
        '@types': path.resolve(__dirname, './src/types'),
        '@utils': path.resolve(__dirname, './src/utils')
      }
    },
    optimizeDeps: {
      exclude: ['@duckdb/duckdb-wasm', '@motherduck/wasm-client'],
      include: ['apache-arrow']
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        external: [
          // Exclude WASM and worker files from the build
          /.*\.wasm(\?url)?$/,
          /.*\.worker\.js(\?url)?$/,
        ],
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('@duckdb/duckdb-wasm')) {
                return 'duckdb';
              }
              if (id.includes('xlsx')) {
                return 'xlsx';
              }
            }
          },
        },
      },
    },
    server: {
      headers: {
        // Required headers for MotherDuck WASM client (SharedArrayBuffer support)
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
      fs: {
        allow: ['..'], // Allow serving files from parent directories if needed
      },
      historyApiFallback: true,
      proxy: {
        '/api/openai': {
          target: 'https://api.openai.com/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/openai/, ''),
          headers: {
            'Origin': 'https://api.openai.com',
          },
        },
        '/api/anthropic': {
          target: 'https://api.anthropic.com/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          headers: {
            'Origin': 'https://api.anthropic.com',
          },
        },
        '/api/groq': {
          target: 'https://api.groq.com/openai/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/groq/, ''),
          headers: {
            'Origin': 'https://api.groq.com',
          },
        },
      },
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      }
    }
  };
})