import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

// Adding a public/pets/<id>/pet.json + spritesheet publishes a new preset.
export function petCatalog(): Plugin {
  const directory = fileURLToPath(new URL('../public/pets/', import.meta.url));
  const catalog = () =>
    readdirSync(directory, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(entry.name),
      )
      .flatMap((entry) => {
        const path = `${directory}/${entry.name}`;
        if (
          !existsSync(`${path}/pet.json`) ||
          !existsSync(`${path}/spritesheet.webp`)
        )
          return [];
        const metadata: unknown = JSON.parse(
          readFileSync(`${path}/pet.json`, 'utf8'),
        );
        if (
          !metadata ||
          typeof metadata !== 'object' ||
          !('displayName' in metadata) ||
          typeof metadata.displayName !== 'string'
        )
          return [];
        const spriteVersionNumber =
          'spriteVersionNumber' in metadata
            ? metadata.spriteVersionNumber
            : undefined;
        if (
          spriteVersionNumber !== undefined &&
          spriteVersionNumber !== 1 &&
          spriteVersionNumber !== 2
        )
          return [];
        return [
          {
            id: entry.name,
            label: metadata.displayName.slice(0, 100),
            ...(spriteVersionNumber === undefined
              ? {}
              : { spriteVersionNumber }),
          },
        ];
      });
  return {
    name: 'assistant-pet-catalog',
    configureServer(server) {
      server.middlewares.use('/pets/catalog.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-cache');
        response.end(JSON.stringify(catalog()));
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'pets/catalog.json',
        source: JSON.stringify(catalog()),
      });
    },
  };
}
