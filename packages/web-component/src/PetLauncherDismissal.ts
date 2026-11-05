import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

type StorageKind = 'localStorage' | 'sessionStorage';

function currentEntryKey(
  page: Window & { navigation?: { currentEntry?: { key: string } | null } },
) {
  return page.navigation?.currentEntry?.key;
}

export class PetLauncherDismissal {
  dismissed = false;
  #key = '';
  #storage?: StorageKind;

  bind(options: ChatKitOptions, elementId: string) {
    const accountKey =
      typeof options.pet === 'object' ? options.pet?.dismissalKey : undefined;
    const sessionKey = options.sessionKey;
    // A browser history entry survives a reload without sharing a default across logins.
    const entryKey =
      !accountKey && !sessionKey ? currentEntryKey(window) : undefined;
    const storage = accountKey
      ? 'localStorage'
      : sessionKey || entryKey
        ? 'sessionStorage'
        : undefined;
    let endpoint: string | undefined;
    try {
      const api = new URL(options.api.apiUrl, window.location.href);
      endpoint = api.origin + api.pathname;
    } catch {
      // Leave URL validation to the API client.
    }
    const key =
      'chatkit:pet:launcher:v1:' +
      JSON.stringify([
        endpoint,
        options.api.xpertId,
        'projectId' in options.api ? options.api.projectId : null,
        options.group?.id,
        elementId,
        accountKey || sessionKey,
        entryKey,
      ]);
    if (key === this.#key && storage === this.#storage) return false;
    this.#key = key;
    this.#storage = storage;
    this.dismissed = false;
    try {
      if (storage) this.dismissed = window[storage].getItem(key) === '1';
    } catch {
      // Restricted hosts can still close and reopen this element.
    }
    return true;
  }

  set(dismissed: boolean) {
    this.dismissed = dismissed;
    if (!this.#storage) return;
    try {
      const storage = window[this.#storage];
      if (dismissed) storage.setItem(this.#key, '1');
      else storage.removeItem(this.#key);
    } catch {
      // Keep the in-memory choice if storage is unavailable.
    }
  }
}
