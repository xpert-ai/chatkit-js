import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import {
  Chat,
  baseChatOptions,
  mocks,
  setupChatTest,
} from '../testing/chat-fixture';

setupChatTest();
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterAll(() => vi.unstubAllGlobals());
afterEach(() => {
  mocks.stream.client.assistants.get.mockReset().mockResolvedValue(null);
});

describe('Assistant character integration', () => {
  it('shares the avatar and summary trigger panel, routes customization to the current Assistant, and preserves transcript mode', async () => {
    mocks.stream.client.assistants.get.mockResolvedValue({
      name: 'Bosi',
      config: {},
    });
    const options: ChatKitOptions = {
      ...baseChatOptions,
      messagePresentation: { mode: 'bubbles' },
      header: { character: { enabled: true, customizable: true } },
      taskSummary: { enabled: true },
    };
    const view = render(<Chat clientSecret="secret" options={options} />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'assistantPresence.open' }),
      ).toBeVisible(),
    );
    expect(
      screen.queryByRole('button', { name: 'assistantPresence.customize' }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'assistantPresence.open' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'assistantPresence.customize' }),
    );
    expect(mocks.parentSendEvent).toHaveBeenCalledWith('public_event', [
      'effect',
      { name: 'assistant.customize', data: { assistantId: 'assistant-1' } },
    ]);
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: 'assistantPresence.details' }),
      ).toBeVisible(),
    );
    expect(
      screen.queryByRole('button', { name: 'assistantPresence.open' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'taskSummary.open' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const summaryTrigger = screen.getByRole('button', {
      name: 'taskSummary.open',
    });
    summaryTrigger.focus();
    fireEvent.click(summaryTrigger);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(summaryTrigger).toHaveFocus());
    view.rerender(
      <Chat
        clientSecret="secret"
        options={{ ...options, messagePresentation: { mode: 'transcript' } }}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'assistantPresence.open' }),
    ).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
