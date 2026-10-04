import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Resolve from the iframe UI, which may use a different SDK than the host app.
const require = createRequire(
  new URL('../packages/chatkit-ui/package.json', import.meta.url),
);
const methods = [
  'listFiles',
  'readFile',
  'saveFile',
  'uploadFile',
  'saveBinaryFile',
  'deleteFile',
  'downloadFile',
  'downloadArtifact',
  'connectTerminal',
];

try {
  const entry = require.resolve('@xpert-ai/xpert-sdk');
  const { Client } = await import(pathToFileURL(entry).href);
  const client = new Client({ apiUrl: 'http://localhost:3000/api/ai' });
  const missing = methods.filter(
    (method) => typeof client.workbench?.[method] !== 'function',
  );
  if (missing.length)
    throw new Error(
      `SDK is missing Client.workbench methods: ${missing.join(', ')}`,
    );
  console.log(`Workbench SDK: OK\nResolved: ${entry}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    'Run corepack pnpm install --frozen-lockfile, then restart with corepack pnpm dev:ui:fresh and reload the host page.',
  );
  process.exitCode = 1;
}
