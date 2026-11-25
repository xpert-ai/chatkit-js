import { fileURLToPath } from 'node:url';
/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { defineConfig } from 'vitest/config';

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
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
