import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { getHttpsServerOptions } from 'office-addin-dev-certs';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(async ({ command }) => {
  const https = command === 'serve' ? await getHttpsServerOptions() : undefined;

  return {
    plugins: [react(), tsconfigPaths()],
    publicDir: 'public',
    server: {
      port: 3002,
      ...(https ? { https } : {}),
      proxy: {
        '/api': {
          target: process.env.CHATKIT_EXCEL_SERVER_URL ?? 'http://localhost:8789',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist/taskpane',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          taskpane: resolve(__dirname, 'taskpane.html'),
        },
      },
    },
  };
});
