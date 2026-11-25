import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
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
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
