import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@xpert-ai/chatkit-types': fileURLToPath(
        new URL('../../chatkit/src/index.ts', import.meta.url),
      ),
    },
  },
  preview: { host: '127.0.0.1', port: 4326 },
});
