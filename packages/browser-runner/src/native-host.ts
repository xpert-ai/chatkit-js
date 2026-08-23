#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

import { installNativeMessagingHost } from './install-native-host.js';
import { runNativeMessagingHost } from './native-host-runtime.js';
import { launchPlaywrightBrowserSession } from './playwright-provider.js';
import { BrowserRunner } from './runner.js';

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (process.argv.includes('--install-host')) {
    const extensionId = readFlag('--extension-id');
    if (!extensionId) {
      throw new Error('--extension-id is required with --install-host.');
    }
    const installed = await installNativeMessagingHost({
      extensionId,
      nativeHostScript: fileURLToPath(import.meta.url),
    });
    process.stdout.write(
      `Installed ${installed.manifestPath}\nLauncher: ${installed.launcherPath}\n`,
    );
    return;
  }

  const runner = new BrowserRunner({ launch: launchPlaywrightBrowserSession });
  const stop = () => void runner.stop().finally(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  runNativeMessagingHost(runner);
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
