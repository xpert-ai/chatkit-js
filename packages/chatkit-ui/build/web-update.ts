import type { Plugin } from 'vite';

/** Hosting integrations can verify update support before stamping a release identity. */
export function webUpdateCapability(): Plugin {
  return {
    name: 'xpert-web-update-capability',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'xpert-web-update.json',
        source: JSON.stringify({ schemaVersion: 1 }),
      });
    },
  };
}
