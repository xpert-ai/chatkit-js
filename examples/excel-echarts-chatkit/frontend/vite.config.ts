import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_BACKEND_TARGET || 'http://localhost:8010';

  return {
    plugins: [react()],
    server: {
      port: 5175,
      proxy: {
        '/api': backendTarget,
        '/health': backendTarget,
      },
    },
  };
});
