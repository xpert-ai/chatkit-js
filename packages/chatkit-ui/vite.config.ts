import { defineConfig } from 'vite';
import { petCatalog } from './build/pet-catalog';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [petCatalog(), tsconfigPaths(), react(), tailwindcss()],
  // Both packages locate binary assets relative to their modules.
  optimizeDeps: {
    exclude: ['@docx-editor.dev/fonts', '@docx-editor.dev/core'],
  },
  build: {
    outDir: 'dist/app',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.XPERT_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.XPERT_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
