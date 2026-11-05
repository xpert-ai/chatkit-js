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
function clickClose(element: ChatKitElement) {
  pet(element)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
  element
    .shadowRoot!.querySelector<HTMLButtonElement>('[role="menuitem"]')!
    .click();
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
});

describe('pet launcher dismissal', () => {
  it('keeps an uncontrolled dismissal on the element through options and frame updates', () => {
    const element = mount();
    const changes = vi.fn();
    element.addEventListener('chatkit.pet.launcher.visibility.change', changes);
    clickClose(element);
    element.setOptions({ ...defaults, locale: 'zh-CN', theme: 'dark' });
    frame.sendPetOptions({ pet: true });
    expect(pet(element)).toBeNull();
    expect(reopenButton(element)?.textContent).toBe('显示宠物');
    reopenButton(element)!.click();
    expect(pet(element)).toBeTruthy();
    expect(changes.mock.calls.map(([event]) => event.detail)).toEqual([
      { visible: false },
      { visible: true },
    ]);
    clickClose(element);
    expect(pet(mount())).toBeTruthy();
    element.setOptions({ ...defaults, sessionKey: 'another-session' });
    expect(pet(element)).toBeTruthy();
  });

  it('accepts the boolean pet shorthand in launcher mode and keeps chat mode disabled without a restore button', () => {
    const element = mount({ ...defaults, pet: false });
    expect(pet(element)).toBeNull();
    expect(reopenButton(element)).toBeDefined();
    element.setOptions({ ...defaults, pet: true });
    expect(pet(element)).toBeTruthy();
    expect(reopenButton(element)).toBeUndefined();
    element.setOptions({ ...defaults, pet: false, displayMode: 'chat' });
    expect(pet(element)).toBeNull();
    expect(reopenButton(element)).toBeUndefined();
  });

  it('uses host visibility on mount and updates, and emits only explicit user requests', () => {
    const options = (enabled: boolean) => ({
      ...defaults,
      pet: { enabled },
    });
    const element = mount(options(false));
    expect(pet(element)).toBeNull();
    const frameUrl = element.shadowRoot!.querySelector('iframe')!.src;
    expect(decodeBase64(new URL(frameUrl).hash.slice(1))).toHaveProperty(
      'options.pet',
      { enabled: false },
    );
    const changes = vi.fn();
    element.addEventListener('chatkit.pet.launcher.visibility.change', changes);
    frame.sendPetOptions({ pet: true });
    expect(pet(element)).toBeNull();
    reopenButton(element)!.click();
    expect(pet(element)).toBeNull();
    expect(changes).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: { visible: true } }),
    );
    element.setOptions(options(true));
    expect(pet(element)).toBeTruthy();
    clickClose(element);
    expect(changes).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: { visible: false } }),
    );
    element.setOptions(options(false));
    expect(pet(element)).toBeNull();
    expect(changes).toHaveBeenCalledTimes(2);
  });
});
