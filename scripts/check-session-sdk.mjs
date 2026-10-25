// Check the installed package, not TypeScript aliases: source tests cannot validate a release dependency.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export async function checkSessionSdk(
  manifest = new URL('../packages/chatkit-ui/package.json', import.meta.url),
) {
  const require = createRequire(manifest);
  const entry = require.resolve('@xpert-ai/xpert-sdk');
  const sdk = await import(pathToFileURL(entry).href);
  assert.equal(
    typeof sdk.HTTPError,
    'function',
    'Installed SDK must export HTTPError',
  );
  assert.equal(
    typeof sdk.isThreadControlView,
    'function',
    'Installed SDK must validate public control views',
  );
  assert.equal(
    typeof sdk.mergeThreadControlView,
    'function',
    'Installed SDK must order public control views',
  );
  const view = {
    version: 1,
    threadId: 'package/probe',
    runId: 'probe',
    revision: '9007199254740993',
    state: 'stopping',
    actions: {
      canPause: false,
      canResume: false,
      canTerminate: false,
      canSend: false,
      canQueue: false,
      canRetry: false,
      canRespond: false,
    },
  };
  const controller = new AbortController();
  let reads = 0;
  const client = new sdk.Client({
    apiUrl: 'https://package-check.invalid/api/ai',
    callerOptions: {
      maxRetries: 0,
      fetch: async (url, init) => {
        reads++;
        assert.equal(
          new URL(url).pathname,
          '/api/ai/threads/package%2Fprobe/control-view',
        );
        assert.ok(!init?.method || init.method === 'GET');
        assert.equal(
          init?.body,
          undefined,
          'A control read must not replay input',
        );
        assert.equal(
          init?.signal,
          controller.signal,
          'The installed SDK must forward cancellation',
        );
        return Response.json(view);
      },
    },
  });
  for (const method of ['getControlView', 'getCapabilities'])
    assert.equal(
      typeof client.threads[method],
      'function',
      `Installed SDK is missing threads.${method}`,
    );
  assert.deepEqual(
    await client.threads.getControlView(view.threadId, {
      signal: controller.signal,
    }),
    view,
  );
  assert.equal(reads, 1);
  console.log(`Session SDK package contract passed: ${entry}`);
  return entry;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await checkSessionSdk();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(
      'Install a paired SDK release containing the public control view and abortable reads. Do not use a local patch as release evidence.',
    );
    process.exitCode = 1;
  }
}
