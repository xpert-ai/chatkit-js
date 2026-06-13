import { describe, expect, it, vi } from 'vitest';

import { normalizeConfig } from './config';
import { mountChatKitHost } from './host';

describe('mountChatKitHost assistant switcher', () => {
  it('renders a header switcher and writes the selected assistant', async () => {
    const root = document.createElement('main');
    const writeConfig = vi.fn();
    const config = normalizeConfig({
      frameUrl: 'https://chat.example/frame',
      apiUrl: 'https://api.example/api/ai',
      displayMode: 'chat',
      assistants: [
        { id: 'assistant-1', name: 'Researcher', clientSecret: 'secret-1' },
        { id: 'assistant-2', name: 'Writer', clientSecret: 'secret-2' },
      ],
      activeAssistantId: 'assistant-1',
    });

    const host = mountChatKitHost(root, config, 'sidePanel', {
      openOptionsPage: vi.fn(),
      writeConfig,
    });

    const select = root.querySelector<HTMLSelectElement>(
      'select[name="activeAssistantId"]',
    );
    expect(select).not.toBeNull();
    expect(select?.value).toBe('assistant-1');
    expect(select?.options).toHaveLength(2);
    expect(Array.from(select!.options).map((option) => option.text)).toEqual([
      'Researcher',
      'Writer',
    ]);

    select!.value = 'assistant-2';
    select!.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();

    expect(writeConfig).toHaveBeenCalledWith(
      expect.objectContaining({ activeAssistantId: 'assistant-2' }),
    );

    host.destroy();
  });

  it('does not render the host switcher for pet overlay mode', () => {
    const root = document.createElement('main');
    const config = normalizeConfig({
      frameUrl: 'https://chat.example/frame',
      apiUrl: 'https://api.example/api/ai',
      displayMode: 'pet',
      assistants: [
        { id: 'assistant-1', clientSecret: 'secret-1' },
        { id: 'assistant-2', clientSecret: 'secret-2' },
      ],
      activeAssistantId: 'assistant-1',
    });

    const host = mountChatKitHost(root, config, 'pageOverlay', {
      openOptionsPage: vi.fn(),
      writeConfig: vi.fn(),
    });

    expect(root.querySelector('.ck-host-header')).toBeNull();
    expect(root.querySelector('select[name="activeAssistantId"]')).toBeNull();

    host.destroy();
  });
});
