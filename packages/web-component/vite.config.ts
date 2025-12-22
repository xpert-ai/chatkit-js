import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(({ command }) => {
  // Development server configuration
  if (command === 'serve') {
    return {
      server: {
        port: 3001,
        open: true,
        proxy: {
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
        },
      },
    };
  }

  // Build configuration
  return {
    plugins: [dts({ rollupTypes: true })],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/xpert-chatkit.ts'),
        name: 'XpertChatkit',
        fileName: 'xpert-chatkit',
        formats: ['es', 'umd'],
      },
      rollupOptions: {
        output: {
          exports: 'named',
        },
      },
      sourcemap: true,
      minify: 'esbuild',
    },
  };
});
