import '@xpert-ai/chatkit-web-component';

import type { ChatKitOptions, XpertAIChatKit } from '@xpert-ai/chatkit-types';

import { createChatKitOptions } from './chatkit-options';
import { getActiveAssistant, validateConfig } from './config';
import { createI18n, formatConfigIssues, type I18n } from './i18n';
import type { ChatKitDisplayMode, ChatKitExtensionConfig } from './types';

type HostSurface = 'sidePanel' | 'pageOverlay';

type HostActions = {
  openOptionsPage: () => Promise<void> | void;
  writeConfig?: (config: ChatKitExtensionConfig) => Promise<void> | void;
  onClientTool?: ChatKitOptions['onClientTool'];
};

type HostController = {
  update: (config: ChatKitExtensionConfig) => void;
  destroy: () => void;
};

function createButton(i18n: I18n, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ck-button ck-button-primary';
  button.textContent = i18n.t('openOptions');
  button.addEventListener('click', onClick);
  return button;
}

function renderMessage(
  root: HTMLElement,
  title: string,
  message: string,
  i18n: I18n,
  actions: HostActions,
) {
  const shell = document.createElement('section');
  shell.className = 'ck-empty-state';

  const heading = document.createElement('h1');
  heading.textContent = title;

  const body = document.createElement('p');
  body.textContent = message;

  shell.append(
    heading,
    body,
    createButton(i18n, () => {
      void actions.openOptionsPage();
    }),
  );
  root.replaceChildren(shell);
}

function shouldRenderSurface(
  surface: HostSurface,
  config: ChatKitExtensionConfig,
) {
  return surface === 'sidePanel'
    ? config.surfaces.sidePanel
    : config.surfaces.pageOverlay;
}

function resolveSurfaceDisplayMode(
  surface: HostSurface,
  config: ChatKitExtensionConfig,
): ChatKitDisplayMode {
  return surface === 'sidePanel' ? 'chat' : config.displayMode;
}

function getAssistantLabel(assistant: { id: string; name?: string }): string {
  return assistant.name ?? assistant.id;
}

function shouldShowAssistantSwitcher(
  surface: HostSurface,
  config: ChatKitExtensionConfig,
): boolean {
  return (
    config.assistants.length > 1 &&
    resolveSurfaceDisplayMode(surface, config) === 'chat'
  );
}

function createAssistantSwitcher(
  config: ChatKitExtensionConfig,
  i18n: I18n,
  actions: HostActions,
): HTMLElement {
  const header = document.createElement('header');
  header.className = 'ck-host-header';

  const field = document.createElement('label');
  field.className = 'ck-host-assistant-switcher';

  const label = document.createElement('span');
  label.textContent = i18n.t('activeAssistant');

  const select = document.createElement('select');
  select.name = 'activeAssistantId';
  select.setAttribute('aria-label', i18n.t('activeAssistant'));

  const activeAssistant = getActiveAssistant(config);
  for (const assistant of config.assistants) {
    const option = document.createElement('option');
    option.value = assistant.id;
    option.textContent = getAssistantLabel(assistant);
    option.selected = assistant.id === activeAssistant?.id;
    select.append(option);
  }

  select.addEventListener('change', () => {
    const nextConfig = {
      ...config,
      activeAssistantId: select.value,
    };
    void Promise.resolve(actions.writeConfig?.(nextConfig)).catch((error) => {
      console.warn(
        '[chatkit-browser-extension] Failed to switch assistant:',
        error,
      );
    });
  });

  field.append(label, select);
  header.append(field);
  return header;
}

export function mountChatKitHost(
  root: HTMLElement,
  initialConfig: ChatKitExtensionConfig,
  surface: HostSurface,
  actions: HostActions,
): HostController {
  let active = true;
  let applyOptionsCleanup: (() => void) | null = null;

  const update = (config: ChatKitExtensionConfig) => {
    const i18n = createI18n(config.locale);
    document.documentElement.lang = i18n.locale;
    applyOptionsCleanup?.();
    applyOptionsCleanup = null;

    if (!shouldRenderSurface(surface, config)) {
      renderMessage(
        root,
        i18n.t('disabledTitle'),
        i18n.t('disabledBody'),
        i18n,
        actions,
      );
      return;
    }

    const validation = validateConfig(config);
    if (!validation.ok) {
      renderMessage(
        root,
        i18n.t('configureTitle'),
        formatConfigIssues(validation.issues, i18n),
        i18n,
        actions,
      );
      return;
    }

    const element = document.createElement('xpertai-chatkit') as XpertAIChatKit;
    element.className = 'ck-chatkit';
    const displayMode = resolveSurfaceDisplayMode(surface, config);

    if (shouldShowAssistantSwitcher(surface, config)) {
      const shell = document.createElement('section');
      shell.className = 'ck-host-shell';
      shell.append(createAssistantSwitcher(config, i18n, actions), element);
      root.replaceChildren(shell);
    } else {
      root.replaceChildren(element);
    }

    let current = true;
    applyOptionsCleanup = () => {
      current = false;
    };

    const apply = () => {
      if (!active || !current) {
        return;
      }

      element.setOptions(
        createChatKitOptions(config, {
          displayMode,
          onClientTool: actions.onClientTool,
        }),
      );
    };

    if (customElements.get('xpertai-chatkit')) {
      apply();
    } else {
      void customElements.whenDefined('xpertai-chatkit').then(apply);
    }
  };

  update(initialConfig);

  return {
    update,
    destroy() {
      active = false;
      applyOptionsCleanup?.();
      applyOptionsCleanup = null;
      root.replaceChildren();
    },
  };
}
