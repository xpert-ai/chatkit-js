import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_BACKEND_TARGET || 'http://localhost:3000';
  const workspaceRoot = resolve(__dirname, '../../..');

  return {
    plugins: [tsconfigPaths()],
    resolve: {
      alias: {
        // Build the demo directly from workspace sources so clean checkouts do
        // not depend on prebuilt package artifacts.
        '@xpert-ai/chatkit-angular': resolve(
          workspaceRoot,
          'packages/chatkit-angular/src/index.ts',
        ),
        '@xpert-ai/chatkit-types': resolve(
          workspaceRoot,
          'packages/chatkit/src/index.ts',
        ),
        '@xpert-ai/chatkit-web-component': resolve(
          workspaceRoot,
          'packages/web-component/src/xpert-chatkit.ts',
        ),
        '@xpert-ai/chatkit-web-shared': resolve(
          workspaceRoot,
          'packages/chatkit-web-shared/src/index.ts',
        ),
      },
    },
    server: {
      port: 5175,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4175,
    },
  };
});
