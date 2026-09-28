import { StrictMode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import type { PendingHITLRequest } from '../../lib/hitl';
import { useInlineApproval } from './use-inline-approval';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));
vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({ theme: { radius: 'soft' } }),
}));

const makeRequest = (): PendingHITLRequest => ({
  id: 'approval-1',
  createdAt: Date.now(),
  request: {
    toolCallId: 'tool-1',
    host: {
      kind: 'test-action',
      id: 'permit-1',
      expiresAt: Date.now() + 60000,
    },
    actionRequests: [
      {
        name: 'test-action',
        args: { command: 'pwd' },
        display: {
          title: 'Allow this action?',
          summary: 'My computer',
          sections: [{ type: 'code', label: 'Command', code: 'pwd' }],
        },
      },
    ],
    reviewConfigs: [
      { actionName: 'test-action', allowedDecisions: ['approve', 'reject'] },
    ],
  },
});
function Harness({
  request = makeRequest(),
  options,
  submit,
  threadId = 'thread-1',
}: {
  request?: PendingHITLRequest;
  options?: ChatKitOptions['approvals'];
  submit: ReturnType<typeof vi.fn>;
  threadId?: string;
}) {
  const { card } = useInlineApproval({
    request,
    options,
    submit,
    threadId,
    messenger: null,
  });
  return card;
}
const approve = () =>
  screen.getByRole('button', { name: 'approvals.approveOnce' });
const reject = () => screen.getByRole('button', { name: 'approvals.reject' });

describe('inline host approvals', () => {
  it('waits for host acceptance and suppresses duplicate clicks', async () => {
    let resolve!: (value: { accepted: boolean }) => void;
    const onDecision = vi.fn(
      () =>
        new Promise<{ accepted: boolean }>((done) => {
          resolve = done;
        }),
    );
    const submit = vi.fn();
    render(
      <Harness options={{ placement: 'inline', onDecision }} submit={submit} />,
    );
    fireEvent.click(approve());
    fireEvent.click(approve());
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    expect(reject()).toBeDisabled();
    await act(async () => resolve({ accepted: true }));
    expect(submit).toHaveBeenCalledWith([{ type: 'approve' }]);
    expect(approve()).toBeDisabled();
  });
  it('keeps the card retryable when host authorization fails', async () => {
    const onDecision = vi
      .fn()
      .mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValue({ accepted: true });
    const submit = vi.fn();
    render(
      <Harness options={{ placement: 'inline', onDecision }} submit={submit} />,
    );
    fireEvent.click(approve());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Connection lost',
    );
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(approve());
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });
  it('fails closed without a host callback and does not fall back to composer submission', async () => {
    const submit = vi.fn();
    render(<Harness submit={submit} />);
    fireEvent.click(approve());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'approvals.hostRejected',
    );
    expect(submit).not.toHaveBeenCalled();
  });
  it('allows rejecting an expired request but never allows execution', async () => {
    const request = makeRequest();
    request.request.host!.expiresAt = 1;
    const submit = vi.fn(),
      onDecision = vi.fn().mockResolvedValue({ accepted: true });
    render(
      <Harness request={request} options={{ onDecision }} submit={submit} />,
    );
    expect(approve()).toBeDisabled();
    expect(reject()).not.toBeDisabled();
    fireEvent.click(reject());
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith([{ type: 'reject' }]),
    );
  });
  it('does not resume a different thread after a late host callback', async () => {
    let resolve!: (value: { accepted: boolean }) => void;
    const options = {
      onDecision: vi.fn(
        () =>
          new Promise<{ accepted: boolean }>((done) => {
            resolve = done;
          }),
      ),
    };
    const request = makeRequest(),
      submit = vi.fn();
    const view = render(
      <Harness request={request} options={options} submit={submit} />,
    );
    fireEvent.click(approve());
    view.rerender(
      <Harness
        request={request}
        options={options}
        submit={submit}
        threadId="thread-2"
      />,
    );
    await act(async () => resolve({ accepted: true }));
    expect(submit).not.toHaveBeenCalled();
  });
  it('does not resume after the chat unmounts while native approval is pending', async () => {
    let resolve!: (value: { accepted: boolean }) => void;
    const options = {
      onDecision: () =>
        new Promise<{ accepted: boolean }>((done) => {
          resolve = done;
        }),
    };
    const submit = vi.fn();
    const view = render(<Harness options={options} submit={submit} />);
    fireEvent.click(approve());
    view.unmount();
    await act(async () => resolve({ accepted: true }));
    expect(submit).not.toHaveBeenCalled();
  });
  it('keeps approval functional under StrictMode effect replay', async () => {
    const submit = vi.fn();
    render(
      <StrictMode>
        <Harness
          options={{ onDecision: async () => ({ accepted: true }) }}
          submit={submit}
        />
      </StrictMode>,
    );
    fireEvent.click(approve());
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });
  it('supports generic inline approvals without a native host', async () => {
    const request = makeRequest();
    delete request.request.host;
    const submit = vi.fn();
    render(
      <Harness
        request={request}
        options={{ placement: 'inline' }}
        submit={submit}
      />,
    );
    fireEvent.click(approve());
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith([{ type: 'approve' }]),
    );
  });
});
