import './styles.css';

import {
  EXTENSION_LOCALE_OPTIONS,
  normalizeConfig,
  validateConfig,
} from './config';
import { createI18n, type I18n } from './i18n';
import { readConfig, writeConfig } from './storage';
import type { ChatKitExtensionConfig, OverlayPosition } from './types';
import { createChromeExtensionPlatform } from './platform/chrome/api';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing options root element.');
}

const appRoot = root;
const platform = createChromeExtensionPlatform();

type FormFields = {
  frameUrl: HTMLInputElement;
  apiUrl: HTMLInputElement;
  xpertId: HTMLInputElement;
  clientSecret: HTMLInputElement;
  locale: HTMLSelectElement;
  displayMode: HTMLSelectElement;
  colorScheme: HTMLSelectElement;
  sidePanel: HTMLInputElement;
  pageOverlay: HTMLInputElement;
  autoPageOverlay: HTMLInputElement;
  hostAutomation: HTMLInputElement;
  overlayWidth: HTMLInputElement;
  overlayHeight: HTMLInputElement;
  overlayPosition: HTMLSelectElement;
};

function getField<T extends HTMLElement>(
  form: HTMLFormElement,
  name: string,
): T {
  const field = form.elements.namedItem(name);
  if (!field || !(field instanceof HTMLElement)) {
    throw new Error(`Missing options field: ${name}`);
  }

  return field as T;
}

function createLocaleOptions(
  current: ChatKitExtensionConfig['locale'],
  i18n: I18n,
) {
  return EXTENSION_LOCALE_OPTIONS.map((locale) => {
    const label =
      locale === 'en'
        ? i18n.t('english')
        : locale === 'zh-Hans'
          ? i18n.t('simplifiedChinese')
          : i18n.t('browserDefault');
    const selected = (current ?? '') === locale ? ' selected' : '';
    return `<option value="${locale}"${selected}>${label}</option>`;
  }).join('');
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function createPositionOptions(current: OverlayPosition, i18n: I18n) {
  const positions: Array<{ value: OverlayPosition; label: string }> = [
    { value: 'bottom-right', label: i18n.t('bottomRight') },
    { value: 'bottom-left', label: i18n.t('bottomLeft') },
    { value: 'top-right', label: i18n.t('topRight') },
    { value: 'top-left', label: i18n.t('topLeft') },
  ];

  return positions
    .map(({ value, label }) => {
      const selected = current === value ? ' selected' : '';
      return `<option value="${value}"${selected}>${label}</option>`;
    })
    .join('');
}

function collectFields(form: HTMLFormElement): FormFields {
  return {
    frameUrl: getField<HTMLInputElement>(form, 'frameUrl'),
    apiUrl: getField<HTMLInputElement>(form, 'apiUrl'),
    xpertId: getField<HTMLInputElement>(form, 'xpertId'),
    clientSecret: getField<HTMLInputElement>(form, 'clientSecret'),
    locale: getField<HTMLSelectElement>(form, 'locale'),
    displayMode: getField<HTMLSelectElement>(form, 'displayMode'),
    colorScheme: getField<HTMLSelectElement>(form, 'colorScheme'),
    sidePanel: getField<HTMLInputElement>(form, 'sidePanel'),
    pageOverlay: getField<HTMLInputElement>(form, 'pageOverlay'),
    autoPageOverlay: getField<HTMLInputElement>(form, 'autoPageOverlay'),
    hostAutomation: getField<HTMLInputElement>(form, 'hostAutomation'),
    overlayWidth: getField<HTMLInputElement>(form, 'overlayWidth'),
    overlayHeight: getField<HTMLInputElement>(form, 'overlayHeight'),
    overlayPosition: getField<HTMLSelectElement>(form, 'overlayPosition'),
  };
}

function readForm(fields: FormFields): ChatKitExtensionConfig {
  return normalizeConfig({
    frameUrl: fields.frameUrl.value,
    apiUrl: fields.apiUrl.value,
    xpertId: fields.xpertId.value,
    clientSecret: fields.clientSecret.value,
    locale: fields.locale.value,
    displayMode: fields.displayMode.value,
    theme: {
      colorScheme: fields.colorScheme.value,
    },
    surfaces: {
      sidePanel: fields.sidePanel.checked,
      pageOverlay: fields.pageOverlay.checked,
      autoPageOverlay: fields.autoPageOverlay.checked,
    },
    overlay: {
      width: fields.overlayWidth.value,
      height: fields.overlayHeight.value,
      position: fields.overlayPosition.value,
    },
    hostAutomation: {
      enabled: fields.hostAutomation.checked,
    },
  });
}

function setStatus(message: string, kind: 'info' | 'success' | 'error') {
  const status = appRoot.querySelector<HTMLElement>('[data-role="status"]');
  if (!status) {
    return;
  }

  status.textContent = message;
  status.className =
    kind === 'success'
      ? 'ck-alert ck-alert-success'
      : kind === 'error'
        ? 'ck-alert'
        : 'ck-status';
}

function renderOptions(config: ChatKitExtensionConfig) {
  const i18n = createI18n(config.locale);
  document.documentElement.lang = i18n.locale;

  const shell = document.createElement('section');
  shell.className = 'ck-options-shell';
  shell.innerHTML = `
    <header class="ck-header">
      <div>
        <h1 class="ck-title">${i18n.t('extensionTitle')}</h1>
        <p class="ck-subtitle">${i18n.t('optionsSubtitle')}</p>
      </div>
    </header>
    <form class="ck-form">
      <section class="ck-section">
        <h2 class="ck-section-title">${i18n.t('connection')}</h2>
        <div class="ck-field-grid">
          <div class="ck-field">
            <label for="frameUrl">${i18n.t('frameUrl')}</label>
            <input id="frameUrl" name="frameUrl" type="url" value="${escapeAttribute(config.frameUrl)}" placeholder="https://app.example.com/chatkit/index.html" />
          </div>
          <div class="ck-field">
            <label for="apiUrl">${i18n.t('apiUrl')}</label>
            <input id="apiUrl" name="apiUrl" type="url" value="${escapeAttribute(config.apiUrl)}" placeholder="https://api.example.com/api/ai" />
          </div>
          <div class="ck-field">
            <label for="xpertId">${i18n.t('xpertId')}</label>
            <input id="xpertId" name="xpertId" type="text" value="${escapeAttribute(config.xpertId ?? '')}" placeholder="your-xpert-id" />
          </div>
        </div>
      </section>
      <section class="ck-section">
        <h2 class="ck-section-title">${i18n.t('credentials')}</h2>
        <div class="ck-field-grid">
          <div class="ck-field">
            <label for="clientSecret">${i18n.t('clientSecret')}</label>
            <input id="clientSecret" name="clientSecret" type="password" value="${escapeAttribute(config.clientSecret)}" autocomplete="off" />
            <p class="ck-field-help">${i18n.t('clientSecretHelp')}</p>
          </div>
        </div>
      </section>
      <section class="ck-section">
        <h2 class="ck-section-title">${i18n.t('appearance')}</h2>
        <div class="ck-field-grid ck-field-grid-two">
          <div class="ck-field">
            <label for="locale">${i18n.t('locale')}</label>
            <select id="locale" name="locale">${createLocaleOptions(config.locale, i18n)}</select>
          </div>
          <div class="ck-field">
            <label for="displayMode">${i18n.t('launchMode')}</label>
            <select id="displayMode" name="displayMode">
              <option value="pet"${config.displayMode === 'pet' ? ' selected' : ''}>${i18n.t('petLauncher')}</option>
              <option value="chat"${config.displayMode === 'chat' ? ' selected' : ''}>${i18n.t('chatPanel')}</option>
            </select>
          </div>
          <div class="ck-field">
            <label for="colorScheme">${i18n.t('colorScheme')}</label>
            <select id="colorScheme" name="colorScheme">
              <option value="light"${config.theme?.colorScheme === 'light' ? ' selected' : ''}>${i18n.t('light')}</option>
              <option value="dark"${config.theme?.colorScheme === 'dark' ? ' selected' : ''}>${i18n.t('dark')}</option>
            </select>
          </div>
        </div>
      </section>
      <section class="ck-section">
        <h2 class="ck-section-title">${i18n.t('surfaces')}</h2>
        <div class="ck-checkbox-grid">
          <label class="ck-checkbox-label">
            <input name="sidePanel" type="checkbox"${config.surfaces.sidePanel ? ' checked' : ''} />
            ${i18n.t('enableSidePanel')}
          </label>
          <label class="ck-checkbox-label">
            <input name="pageOverlay" type="checkbox"${config.surfaces.pageOverlay ? ' checked' : ''} />
            ${i18n.t('enablePageOverlay')}
          </label>
          <label class="ck-checkbox-label">
            <input name="autoPageOverlay" type="checkbox"${config.surfaces.autoPageOverlay ? ' checked' : ''} />
            ${i18n.t('autoPagePet')}
          </label>
        </div>
      </section>
      <section class="ck-section">
        <h2 class="ck-section-title">${i18n.t('overlay')}</h2>
        <div class="ck-field-grid ck-field-grid-two">
          <div class="ck-field">
            <label for="overlayWidth">${i18n.t('width')}</label>
            <input id="overlayWidth" name="overlayWidth" type="number" min="320" max="900" value="${config.overlay.width}" />
          </div>
          <div class="ck-field">
            <label for="overlayHeight">${i18n.t('height')}</label>
            <input id="overlayHeight" name="overlayHeight" type="number" min="360" max="1200" value="${config.overlay.height}" />
          </div>
          <div class="ck-field">
            <label for="overlayPosition">${i18n.t('position')}</label>
            <select id="overlayPosition" name="overlayPosition">${createPositionOptions(config.overlay.position, i18n)}</select>
          </div>
        </div>
      </section>
      <section class="ck-section">
        <h2 class="ck-section-title">${i18n.t('hostAutomation')}</h2>
        <div class="ck-checkbox-grid">
          <label class="ck-checkbox-label">
            <input name="hostAutomation" type="checkbox"${config.hostAutomation.enabled ? ' checked' : ''} />
            ${i18n.t('enableHostAutomation')}
          </label>
        </div>
      </section>
      <section class="ck-section">
        <div class="ck-button-row">
          <button class="ck-button ck-button-primary" type="submit">${i18n.t('save')}</button>
          <button class="ck-button" type="button" data-role="reset">${i18n.t('resetDefaults')}</button>
        </div>
        <p class="ck-status" data-role="status">${i18n.t('ready')}</p>
      </section>
    </form>
  `;

  const form = shell.querySelector<HTMLFormElement>('form');
  if (!form) {
    throw new Error('Missing options form.');
  }

  const fields = collectFields(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const nextConfig = readForm(fields);
    const validation = validateConfig(nextConfig);
    void writeConfig(platform.storage, nextConfig).then(() => {
      renderOptions(nextConfig);
      setStatus(
        validation.ok
          ? createI18n(nextConfig.locale).t('optionsSaved')
          : createI18n(nextConfig.locale).t('optionsSavedIncomplete'),
        validation.ok ? 'success' : 'error',
      );
    });
  });

  shell
    .querySelector<HTMLButtonElement>('[data-role="reset"]')
    ?.addEventListener('click', () => {
      const defaults = normalizeConfig({});
      void writeConfig(platform.storage, defaults).then(() => {
        renderOptions(defaults);
        setStatus(createI18n(defaults.locale).t('defaultsRestored'), 'success');
      });
    });

  appRoot.replaceChildren(shell);
}

async function main() {
  renderOptions(await readConfig(platform.storage));
}

void main();
