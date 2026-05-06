import './styles.css';

import { validateConfig } from './config';
import { createI18n, formatConfigIssues } from './i18n';
import { readConfig } from './storage';
import type { ChatKitExtensionConfig } from './types';
import { createChromeExtensionPlatform } from './platform/chrome/api';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing popup root element.');
}

const appRoot = root;
const platform = createChromeExtensionPlatform();

function createButton(
  label: string,
  onClick: () => Promise<void>,
  disabled = false,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ck-button';
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener('click', () => {
    void onClick();
  });
  return button;
}

function setStatus(message: string, kind: 'info' | 'error' = 'info') {
  const status = appRoot.querySelector<HTMLElement>('[data-role="status"]');
  if (!status) {
    return;
  }

  status.textContent = message;
  status.className = kind === 'error' ? 'ck-alert' : 'ck-status';
}

function renderPopup(config: ChatKitExtensionConfig) {
  const i18n = createI18n(config.locale);
  const validation = validateConfig(config);
  document.documentElement.lang = i18n.locale;

  const shell = document.createElement('section');
  shell.className = 'ck-shell';

  const header = document.createElement('header');
  header.className = 'ck-header';
  const headingGroup = document.createElement('div');
  const heading = document.createElement('h1');
  heading.className = 'ck-title';
  heading.textContent = i18n.t('appTitle');
  const subtitle = document.createElement('p');
  subtitle.className = 'ck-subtitle';
  subtitle.textContent = validation.ok
    ? i18n.t('popupReadySubtitle')
    : formatConfigIssues(validation.issues, i18n);
  headingGroup.append(heading, subtitle);
  header.append(headingGroup);

  const actions = document.createElement('div');
  actions.className = 'ck-actions';
  const status = document.createElement('p');
  status.className = validation.ok ? 'ck-status' : 'ck-alert';
  status.dataset.role = 'status';
  status.textContent = validation.ok ? i18n.t('ready') : i18n.t('setupPrompt');

  const sidePanelButton = createButton(
    i18n.t('openSidePanel'),
    async () => {
      try {
        await platform.openSidePanelForActiveTab();
        setStatus(i18n.t('sidePanelOpened'));
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : i18n.t('sidePanelOpenError'),
          'error',
        );
      }
    },
    !config.surfaces.sidePanel,
  );

  const overlayButton = createButton(
    i18n.t('togglePageOverlay'),
    async () => {
      try {
        await platform.togglePageOverlayForActiveTab();
        setStatus(i18n.t('pageOverlayToggled'));
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : i18n.t('pageOverlayToggleError'),
          'error',
        );
      }
    },
    !config.surfaces.pageOverlay,
  );

  const optionsButton = createButton(i18n.t('openOptions'), async () => {
    await platform.openOptionsPage();
  });
  optionsButton.classList.add('ck-button-primary');

  actions.append(sidePanelButton, overlayButton, optionsButton);
  shell.append(header, actions, status);
  appRoot.replaceChildren(shell);
}

async function main() {
  renderPopup(await readConfig(platform.storage));
}

void main();
