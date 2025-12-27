import { defineConfig } from 'vite';
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api/ai': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
