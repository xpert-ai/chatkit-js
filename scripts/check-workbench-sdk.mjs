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
  if (typeof client.viewHosts?.readFileAccess !== 'function') {
    throw new Error(
      'SDK is missing Client.viewHosts.readFileAccess. Install @xpert-ai/xpert-sdk ^0.8.2 before starting ChatKit.',
    );
  }
  // Verify transport behavior as well as method presence: older SDKs still rely on cookies.
  const probe = new Client({
    apiUrl: 'https://sdk-check.invalid/api/ai',
    callerOptions: {
      maxRetries: 0,
      fetch: async (url, init) => {
        if (
          String(url) !==
            'https://sdk-check.invalid/api/ai/workspace-files/view-sessions/session/grants/grant/content/proof.txt' ||
          init?.credentials !== 'omit'
        )
          throw new Error(
            'SDK requires the authenticated View file-content transport. Install @xpert-ai/xpert-sdk ^0.8.2.',
          );
        return new Response('ok');
      },
    },
  });
  await probe.viewHosts.readFileAccess(
    'https://sdk-check.invalid/api/workspace-files/content/session/grant/proof.txt',
  );
  console.log(`Workbench SDK: OK\nResolved: ${entry}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    'Run corepack pnpm install --frozen-lockfile, then restart with corepack pnpm dev:ui:fresh and reload the host page.',
  );
  process.exitCode = 1;
}
