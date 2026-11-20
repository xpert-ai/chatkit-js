import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { A2UIProvider, useA2UI } from '@xpert-ai/a2ui-react';
import { describe, expect, it, vi } from 'vitest';
import { StreamContext } from '../../../providers/stream/context';
import type { StreamContextType } from '../../../providers/stream/types';
import { WidgetActions } from './widget-actions';

function Buttons() {
  const { sendAction } = useA2UI();
  return (
    <>
      {['report.approve', 'help.open'].map((actionId) => (
        <button
          key={actionId}
          onClick={() =>
            sendAction({
              type: 'a2ui.action',
              actionId,
              context: { choice: 'yes' },
            })
          }
        >
          {actionId}
        </button>
      ))}
    </>
  );
}

function setup(submit = vi.fn().mockResolvedValue({ refresh: 'thread' })) {
  const loadThread = vi.fn().mockResolvedValue(undefined);
  const host = vi.fn();
  function tree(threadId: string, loading = false, requiresIdleThread = false) {
    const stream = {
      threadId,
      isLoading: loading,
      loadThread,
      client: { threads: { submitWidgetAction: submit } },
    };
    return (
      <StreamContext.Provider value={stream as unknown as StreamContextType}>
        <A2UIProvider onAction={host}>
          <WidgetActions
            messageId="message"
            widgetId="widget"
            serverActions={['report.approve']}
            requiresIdleThread={requiresIdleThread}
          >
            <Buttons />
          </WidgetActions>
        </A2UIProvider>
      </StreamContext.Provider>
    );
  }
  const view = render(tree('original'));
  return { view, tree, submit, loadThread, host };
}

describe('Widget action destinations', () => {
  it('preserves host actions and routes declared actions directly to their message', async () => {
    const { submit, loadThread, host } = setup();
    fireEvent.click(screen.getByText('help.open'));
    expect(host).toHaveBeenCalledExactlyOnceWith({
      type: 'a2ui.action',
      actionId: 'help.open',
      context: { choice: 'yes' },
    });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('report.approve'));
    await waitFor(() =>
      expect(loadThread).toHaveBeenCalledExactlyOnceWith('original'),
    );
    expect(submit).toHaveBeenCalledExactlyOnceWith('original', {
      messageId: 'message',
      widgetId: 'widget',
      action: 'report.approve',
      context: { choice: 'yes' },
    });
    expect(host).toHaveBeenCalledTimes(1);
  });

  it('submits once and ignores a refresh for a thread the user has left', async () => {
    let resolve!: (value: { refresh: string }) => void;
    const { view, tree, loadThread, submit } = setup(
      vi.fn(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    );
    const button = screen.getByText('report.approve');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    view.rerender(tree('other'));
    await act(async () => resolve({ refresh: 'thread' }));
    expect(loadThread).not.toHaveBeenCalled();
  });

  it('waits for the active run only when the surface requires an idle thread', async () => {
    const { view, tree, submit } = setup();
    view.rerender(tree('original', true, true));
    const button = screen.getByText('report.approve');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(submit).not.toHaveBeenCalled();
    view.rerender(tree('original', true));
    fireEvent.click(button);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });

  it('surfaces a rejection, permits retry, and honors a result requiring no refresh', async () => {
    const { loadThread, host } = setup(
      vi
        .fn()
        .mockRejectedValueOnce(new Error('Select a value'))
        .mockResolvedValue({}),
    );
    const button = screen.getByText('report.approve');
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Select a value',
    );
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(host).not.toHaveBeenCalled();
    expect(loadThread).not.toHaveBeenCalled();
  });
});
