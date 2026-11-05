import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { decodeBase64 } from '@xpert-ai/chatkit-web-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatKitElement, registerChatKitElement } from './ChatKitElement';

const frame = vi.hoisted(() => ({
  sendPetOptions: (_payload: { pet: ChatKitOptions['pet'] | null }) => {},
}));
vi.mock('./ChatFrameMessenger', () => ({
  ChatFrameMessenger: class {
    commands = { setOptions: vi.fn(), setPetEnabled: vi.fn() };
    on(event: string, handler: typeof frame.sendPetOptions) {
      if (event === 'pet_options_change') frame.sendPetOptions = handler;
    }
    connect() {}
    disconnect() {}
    setTargetOrigin() {}
  },
}));
registerChatKitElement();

const defaults: ChatKitOptions = {
  displayMode: 'pet',
  api: {
    apiUrl: '/api/ai',
    xpertId: 'assistant',
    getClientSecret: async () => 'fixture',
  },
  sessionKey: 'hosted-session-1',
};
function mount(options = defaults, id = '') {
  const element = document.createElement('xpertai-chatkit') as ChatKitElement;
  element.id = id;
  element.setOptions({ frameUrl: '/chatkit/', ...options });
  document.body.append(element);
  return element;
}
function pet(element: ChatKitElement) {
  return element.shadowRoot!.querySelector<HTMLElement>(
    '[data-chatkit-host-pet]',
  );
}
function close(element: ChatKitElement) {
  pet(element)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
  element
    .shadowRoot!.querySelector<HTMLButtonElement>('[role="menuitem"]')!
    .click();
  expect(pet(element)).toBeNull();
}
function reopenButton(element: ChatKitElement) {
  return Array.from(element.shadowRoot!.querySelectorAll('button')).find(
    (button) => ['Show pet', '显示宠物'].includes(button.textContent ?? ''),
  );
}
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('pet launcher dismissal', () => {
  it('survives option updates, passive frame events and recreation until explicitly reopened', () => {
    let element = mount();
    close(element);
    element.setOptions({
      ...defaults,
      theme: 'dark',
      locale: 'zh-CN',
      request: { context: { workspace: 'updated' } },
    });
    frame.sendPetOptions({ pet: null });
    frame.sendPetOptions({ pet: true });
    expect(pet(element)).toBeNull();
    expect(reopenButton(element)?.textContent).toBe('显示宠物');
    element.remove();

    element = mount();
    expect(pet(element)).toBeNull();
    reopenButton(element)!.click();
    expect(pet(element)).toBeTruthy();
    expect(reopenButton(element)).toBeUndefined();
    element.remove();
    expect(pet(mount())).toBeTruthy();
  });

  it('isolates host sessions, assistants and named instances', () => {
    const element = mount(defaults, 'sidebar');
    close(element);
    expect(
      pet(mount({ ...defaults, sessionKey: 'other-login' }, 'sidebar')),
    ).toBeTruthy();
    expect(pet(mount(defaults, 'second-launcher'))).toBeTruthy();
    element.setOptions({
      ...defaults,
      api: { ...defaults.api, xpertId: 'other' },
    });
    expect(pet(element)).toBeTruthy();
    element.setOptions(defaults);
    expect(pet(element)).toBeNull();
  });

  it('keeps durable user keys separate even when host session keys repeat', () => {
    const options = { ...defaults, pet: { dismissalKey: 'account-a' } };
    const element = mount(options);
    const frameUrl = element.shadowRoot!.querySelector('iframe')!.src;
    expect(decodeBase64(new URL(frameUrl).hash.slice(1))).toHaveProperty(
      'options.pet',
      {},
    );
    close(element);
    element.remove();
    sessionStorage.clear();
    expect(
      pet(mount({ ...defaults, pet: { dismissalKey: 'account-b' } })),
    ).toBeTruthy();
    const restored = mount({ ...options, sessionKey: 'next-visit' });
    expect(pet(restored)).toBeNull();
    reopenButton(restored)!.click();
    restored.remove();
    expect(pet(mount(options))).toBeTruthy();
  });

  it('continues to close and reopen with blocked storage', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    const element = mount();
    close(element);
    element.setOptions({ ...defaults, locale: 'en' });
    expect(pet(element)).toBeNull();
    reopenButton(element)!.click();
    expect(pet(element)).toBeTruthy();
  });

  it('limits unkeyed embeds to the current browser history entry', () => {
    const options = { ...defaults, sessionKey: undefined };
    const navigation = { currentEntry: { key: 'workspace-entry' } };
    vi.stubGlobal('navigation', navigation);
    const element = mount(options);
    close(element);
    element.remove();
    const reloaded = mount(options);
    expect(pet(reloaded)).toBeNull();
    reloaded.remove();
    navigation.currentEntry = { key: 'different-entry' };
    expect(pet(mount(options))).toBeTruthy();
  });
});
