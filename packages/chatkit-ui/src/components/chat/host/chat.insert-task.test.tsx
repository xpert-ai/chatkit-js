import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  mocks,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';
import { composerInsertPayload } from '../../../workbench/composer-insert';
describe('example task composer handoff', () => {
  setupChatTest();
  it('preserves existing draft, adds removable workspace data and skill, and sends only on manual click', async () => {
    const catalog = {
      skills: [
        {
          id: 'skill-docs',
          workspaceId: 'workspace-1',
          label: 'live-dashboard',
        },
      ],
      plugins: [],
    };
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValue(
      catalog,
    );
    renderChat();
    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );
    setComposerText(screen.getByRole('textbox'), 'Keep my draft.');
    await act(async () =>
      mocks.parentMessengerOptions?.onSetComposerValue?.(
        composerInsertPayload(
          {
            text: 'Create hotel dashboard.',
            skillNames: ['live-dashboard'],
            workspaceFiles: [
              {
                path: '/workspace/hotel.json',
                name: '酒店预订.json',
                mimeType: 'application/json',
                size: 100,
              },
            ],
          },
          catalog,
        ),
      ),
    );
    expect(screen.getByRole('textbox').textContent).toContain('Keep my draft.');
    expect(screen.getByRole('textbox').textContent).toContain(
      'Create hotel dashboard.',
    );
    expect(screen.getByRole('textbox').textContent).toContain('live-dashboard');
    expect(screen.getByText('酒店预订.json')).toBeInTheDocument();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledOnce());
    expect(JSON.stringify(mocks.stream.submit.mock.calls[0])).toContain(
      '/workspace/hotel.json',
    );
    expect(JSON.stringify(mocks.stream.submit.mock.calls[0])).toContain(
      'skill-docs',
    );
  });
});
