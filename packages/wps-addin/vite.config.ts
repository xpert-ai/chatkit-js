import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  base: './',
  plugins: [react(), tsconfigPaths()],
  publicDir: 'public',
  server: {
    port: 3003,
    proxy: {
      '/api': {
        target: process.env.CHATKIT_WPS_SERVER_URL ?? 'http://localhost:8789',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        taskpane: resolve(__dirname, 'taskpane.html'),
      },
    },
  },
});
