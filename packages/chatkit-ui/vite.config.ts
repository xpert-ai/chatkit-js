import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { petCatalog } from './build/pet-catalog';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@xpert-ai\/chatkit-primitives\/components\/ui\/(.+)$/,
        replacement:
          fileURLToPath(
            new URL(
              '../chatkit-primitives/src/components/ui/',
              import.meta.url,
            ),
          ) + '$1.tsx',
      },
      {
        find: '@xpert-ai/chatkit-primitives/lib/utils',
        replacement: fileURLToPath(
          new URL('../chatkit-primitives/src/lib/utils.ts', import.meta.url),
        ),
      },
      {
        find: '@xpert-ai/chatkit-primitives/styles.css',
        replacement: fileURLToPath(
          new URL('../chatkit-primitives/src/styles.css', import.meta.url),
        ),
      },
      {
        find: /^@xpert-ai\/chatkit-primitives$/,
        replacement: fileURLToPath(
          new URL('../chatkit-primitives/src/index.ts', import.meta.url),
        ),
      },
      {
        find: /^@xpert-ai\/chatkit-primitives\/(.+)$/,
        replacement:
          fileURLToPath(
            new URL(
              '../chatkit-primitives/src/components/ui/',
              import.meta.url,
            ),
          ) + '$1.tsx',
      },
    ],
  },
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
