import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react(), tailwindcss()],
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
