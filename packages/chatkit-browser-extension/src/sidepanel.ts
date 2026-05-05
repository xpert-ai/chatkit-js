import './styles.css';

import { readConfig, readConfigChange } from './storage';
import { mountChatKitHost } from './host';
import { createChromeExtensionPlatform } from './platform/chrome/api';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing side panel root element.');
}

const appRoot = root;
const platform = createChromeExtensionPlatform();

async function main() {
  const config = await readConfig(platform.storage);
  const host = mountChatKitHost(appRoot, config, 'sidePanel', {
    openOptionsPage: platform.openOptionsPage,
  });

  platform.onStorageChanged?.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    const nextConfig = readConfigChange(changes);
    if (nextConfig) {
      host.update(nextConfig);
    }
  });

  window.addEventListener('pagehide', () => {
    host.destroy();
  });
}

void main();
