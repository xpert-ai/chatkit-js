import { createReadStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** Serve the optional offline pack in development; never copy it into UI dist. */
export function petCatalog(): Plugin {
  const directory = fileURLToPath(
    new URL('../../chatkit-assets/pets/', import.meta.url),
  );
  return {
    name: 'assistant-pet-assets-dev',
    configureServer(server) {
      server.middlewares.use('/pets', (request, response, next) => {
        const pathname = (request.url ?? '').split('?')[0];
        if (
          !/^\/(?:catalog\.json|[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}\/(?:pet\.json|spritesheet\.webp))$/.test(
            pathname,
          )
        )
          return next();
        const file = `${directory}${pathname.slice(1)}`;
        if (!existsSync(file)) return next();
        response.setHeader(
          'Content-Type',
          pathname.endsWith('.webp') ? 'image/webp' : 'application/json',
        );
        createReadStream(file).pipe(response);
      });
    },
  };
}
