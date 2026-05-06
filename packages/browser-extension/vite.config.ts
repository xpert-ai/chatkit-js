import { resolve } from 'path';
import { defineConfig, type PluginOption } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

import packageJson from './package.json';
import { createChromeManifest } from './src/platform/chrome/manifest';

function chromeManifestPlugin(): PluginOption {
  return {
    name: 'chatkit-chrome-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: `${JSON.stringify(
          createChromeManifest(packageJson.version),
          null,
          2,
        )}\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [tsconfigPaths(), chromeManifestPlugin()],
  publicDir: false,
  build: {
    outDir: 'dist/chrome',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        options: resolve(__dirname, 'options.html'),
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        overlay: resolve(__dirname, 'overlay.html'),
        'service-worker': resolve(__dirname, 'src/service-worker.ts'),
        'content-script': resolve(__dirname, 'src/content-script.ts'),
      },
      output: {
        entryFileNames(chunk) {
          if (chunk.name === 'service-worker') return 'service-worker.js';
          if (chunk.name === 'content-script') return 'content-script.js';
          return 'assets/[name].js';
        },
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
