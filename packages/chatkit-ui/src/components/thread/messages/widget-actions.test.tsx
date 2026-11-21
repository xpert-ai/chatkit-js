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
import { WidgetMessage } from './widget';
import {
  encodeWidgetAgentAction,
  parseWidgetAgentAction,
} from '@xpert-ai/chatkit-types';
import { WidgetActionReceipt } from './widget-action-receipt';
import { widgetActionText } from '../../../lib/widget-action-text';

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

function setup(
  submit = vi.fn().mockResolvedValue({ refresh: 'thread' }),
  generated = false,
) {
  const loadThread = vi.fn().mockResolvedValue(undefined);
  const host = vi.fn();
  const agentSubmit = vi
    .fn<StreamContextType['submit']>()
    .mockImplementation(async (_input, options) => {
      options?.onRunAccepted?.();
    });
  function tree(
    threadId: string,
    loading = false,
    requiresIdleThread = false,
    messages: StreamContextType['messages'] = [],
  ) {
    const stream = {
      threadId,
      isLoading: loading,
      loadThread,
      submit: agentSubmit,
      messages,
      client: { threads: { submitWidgetAction: submit } },
    };
    return (
      <StreamContext.Provider value={stream as unknown as StreamContextType}>
        <A2UIProvider onAction={host}>
          {generated ? (
            <WidgetMessage
              messageId="message"
              widgetId="widget"
              data={{
                type: 'Widget',
                widgets: [
                  {
                    name: 'form',
                    agentActions: ['submit_form'],
                    requiresIdleThread: true,
                    messages: [
                      {
                        dataModelUpdate: {
                          surfaceId: '@default',
                          contents: [{ key: 'name', valueString: '' }],
                        },
                      },
                      {
                        surfaceUpdate: {
                          surfaceId: '@default',
                          components: [
                            {
                              id: 'root',
                              component: {
                                Column: {
                                  children: {
                                    explicitList: ['field', 'submit'],
                                  },
                                },
                              },
                            },
                            {
                              id: 'field',
                              component: {
                                TextField: {
                                  label: { literalString: 'Name' },
                                  text: { path: '/name' },
                                },
                              },
                            },
                            {
                              id: 'label',
                              component: {
                                Text: {
                                  text: { literalString: 'Submit form' },
                                },
                              },
                            },
                            {
                              id: 'submit',
                              component: {
                                Button: {
                                  child: 'label',
                                  action: {
                                    name: 'submit_form',
                                    context: [
                                      { key: 'name', value: { path: '/name' } },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                      {
                        beginRendering: { surfaceId: '@default', root: 'root' },
                      },
                    ],
                  },
                ],
              }}
            />
          ) : (
            <WidgetActions
              messageId="message"
              widgetId="widget"
              serverActions={['report.approve']}
              requiresIdleThread={requiresIdleThread}
            >
              <Buttons />
            </WidgetActions>
          )}
        </A2UIProvider>
      </StreamContext.Provider>
    );
  }
  const view = render(tree('original'));
  return { view, tree, submit, agentSubmit, loadThread, host };
}

describe('Widget action destinations', () => {
  it('recognizes persisted submissions and shows values without internal routing fields', async () => {
    const action = {
      name: 'submit_form',
      messageId: 'message',
      widgetId: 'widget',
      widgetName: 'form',
      surfaceId: 'widget-message:widget',
      timestamp: '2026-11-20T00:00:00Z',
      context: { name: 'Ada' },
    };
    const content = encodeWidgetAgentAction(action);
    expect(parseWidgetAgentAction(content)).toEqual(action);
    expect(widgetActionText(content)).toBe('name: Ada');
    expect(parseWidgetAgentAction('[A2UI action] {"action":{}}')).toBeNull();
    expect(parseWidgetAgentAction('Ordinary text')).toBeNull();
    const { view, tree, agentSubmit } = setup(undefined, true);
    view.unmount();
    const restored = render(
      tree('original', false, false, [
        { id: 'receipt', type: 'human', content },
      ]),
    );
    expect(
      await screen.findByRole('button', { name: 'Submit form' }),
    ).toBeDisabled();
    expect(screen.getByRole('textbox')).toHaveValue('Ada');
    expect(agentSubmit).not.toHaveBeenCalled();
    restored.unmount();
    render(<WidgetActionReceipt action={action} />);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.queryByText('widget-message:widget')).toBeNull();
  });

  it('does not disable a different conversation when an earlier submission is accepted', async () => {
    const { agentSubmit, view, tree } = setup(undefined, true);
    let accept: (() => void) | undefined;
    agentSubmit.mockImplementationOnce(
      (_input, options) =>
        new Promise<void>((resolve) => {
          accept = () => {
            options?.onRunAccepted?.();
            resolve();
          };
        }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Submit form' }));
    view.rerender(tree('other'));
    await act(async () => accept?.());
    expect(screen.getByRole('button', { name: 'Submit form' })).toBeEnabled();
    expect(agentSubmit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ threadId: 'original' }),
    );
  });

  it('keeps input local and submits the edited value once to the originating conversation', async () => {
    const { agentSubmit, submit, host, view, tree } = setup(undefined, true);
    const field = await screen.findByRole('textbox');
    fireEvent.change(field, { target: { value: 'Ada' } });
    expect(agentSubmit).not.toHaveBeenCalled();
    view.rerender(tree('original'));
    expect(field).toHaveValue('Ada');
    const button = screen.getByRole('button', { name: 'Submit form' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(agentSubmit).toHaveBeenCalledTimes(1);
    expect(agentSubmit).toHaveBeenCalledWith(
      { input: { input: expect.stringContaining('"context":{"name":"Ada"}') } },
      expect.objectContaining({ threadId: 'original' }),
    );
    expect(JSON.stringify(agentSubmit.mock.calls[0][0])).toContain(
      'submit_form',
    );
    expect(submit).not.toHaveBeenCalled();
    expect(host).not.toHaveBeenCalled();
  });

  it('permits retry after Agent rejection and never auto-submits restored cards', async () => {
    const { agentSubmit, view, tree } = setup(undefined, true);
    agentSubmit.mockRejectedValueOnce(new Error('Disconnected'));
    const button = await screen.findByRole('button', { name: 'Submit form' });
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Disconnected');
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    view.rerender(tree('other'));
    expect(screen.getByRole('button', { name: 'Submit form' })).toBeEnabled();
    expect(agentSubmit).toHaveBeenCalledTimes(2);
  });

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
