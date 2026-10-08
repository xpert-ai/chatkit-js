import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createResourceCardContent,
  type ChatkitMessage,
} from '@xpert-ai/chatkit-types';
import {
  ResourceCardContext,
  unavailableResourceCardActions,
} from '../../../../resource-cards/context';
import { MessageResourceCards } from './index';

const content = createResourceCardContent({
  resource: { namespace: 'platform', type: 'task', id: 'task' },
  title: 'Morning briefing',
  description: 'Daily at 09:00',
  open: {
    target: 'workbench.view',
    viewKey: 'platform.scheduler__detail',
    selectionId: 'task',
  },
});
const message: ChatkitMessage = {
  id: 'reply',
  type: 'assistant',
  content: [content],
};
describe('resource card interaction', () => {
  it('opens only on a user click, including a reloaded history message', async () => {
    const openResourceCard = vi
      .fn()
      .mockResolvedValue({ success: true as const, status: 'opened' as const });
    const ui = render(
      <ResourceCardContext.Provider
        value={{ ...unavailableResourceCardActions, openResourceCard }}
      >
        <MessageResourceCards message={JSON.parse(JSON.stringify(message))} />
      </ResourceCardContext.Provider>,
    );
    expect(openResourceCard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Morning briefing/ }));
    await waitFor(() =>
      expect(openResourceCard).toHaveBeenCalledWith(content, 'reply'),
    );
    ui.unmount();
  });
  it('shows one card for duplicate persisted resource entries', () => {
    render(
      <MessageResourceCards
        message={{ ...message, content: [content, content] }}
      />,
    );
    expect(screen.getAllByTestId('resource-card')).toHaveLength(1);
    expect(screen.getByRole('button')).toBeDisabled();
  });
  it('shows access failures and allows retry', async () => {
    const openResourceCard = vi
      .fn()
      .mockResolvedValue({ success: false, code: 'forbidden' });
    render(
      <ResourceCardContext.Provider
        value={{ ...unavailableResourceCardActions, openResourceCard }}
      >
        <MessageResourceCards message={message} />
      </ResourceCardContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(screen.getByRole('button')).not.toBeDisabled();
  });
});
