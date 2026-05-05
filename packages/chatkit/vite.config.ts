import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        constants: resolve(__dirname, 'src/constants.ts'),
      },
      name: 'XpertChatkit',
      fileName: (format, entryName) =>
        format === 'cjs' ? `${entryName}.cjs` : `${entryName}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: (id) =>
        id.startsWith('@a2ui/lit') ||
        id.startsWith('@langchain/core'),
    },
    sourcemap: true,
    minify: false,
  },
});
