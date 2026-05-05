import '@xpert-ai/chatkit-web-component';

import type { ChatKitOptions, XpertAIChatKit } from '@xpert-ai/chatkit-types';

import { createChatKitOptions } from './chatkit-options';
import { validateConfig } from './config';
import { createI18n, formatConfigIssues, type I18n } from './i18n';
import type { ChatKitDisplayMode, ChatKitExtensionConfig } from './types';

type HostSurface = 'sidePanel' | 'pageOverlay';

type HostActions = {
  openOptionsPage: () => Promise<void> | void;
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
    root.replaceChildren(element);

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
          displayMode: resolveSurfaceDisplayMode(surface, config),
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
