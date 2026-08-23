import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { BROWSER_RUNNER_NATIVE_HOST } from './native-host-runtime.js';

function quoteShell(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function chromeNativeHostDirectory() {
  if (process.platform === 'darwin') {
    return join(
      homedir(),
      'Library',
      'Application Support',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
    );
  }
  if (process.platform === 'linux') {
    return join(homedir(), '.config', 'google-chrome', 'NativeMessagingHosts');
  }
  throw new Error(
    'Automatic native host installation currently supports macOS and Linux.',
  );
}

export async function installNativeMessagingHost(options: {
  extensionId: string;
  nativeHostScript: string;
}) {
  if (!/^[a-p]{32}$/.test(options.extensionId)) {
    throw new Error('A valid 32-character Chrome extension ID is required.');
  }
  const supportDirectory = join(homedir(), '.xpert-chatkit', 'browser-runner');
  const launcherPath = join(supportDirectory, 'native-host.sh');
  await mkdir(supportDirectory, { recursive: true });
  await writeFile(
    launcherPath,
    `#!/bin/sh\nexec ${quoteShell(process.execPath)} ${quoteShell(
      resolve(options.nativeHostScript),
    )}\n`,
    { mode: 0o755 },
  );
  await chmod(launcherPath, 0o755);

  const manifestPath = join(
    chromeNativeHostDirectory(),
    `${BROWSER_RUNNER_NATIVE_HOST}.json`,
  );
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        name: BROWSER_RUNNER_NATIVE_HOST,
        description: 'Xpert ChatKit isolated browser runner',
        path: launcherPath,
        type: 'stdio',
        allowed_origins: [`chrome-extension://${options.extensionId}/`],
      },
      null,
      2,
    )}\n`,
  );
  return { manifestPath, launcherPath };
}
