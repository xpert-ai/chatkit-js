import * as React from 'react';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { extractAssistantAvatar } from '../../../components/ui/chatkit-avatar';
import { useAssistantInfo } from '../../../hooks/useAssistantInfo';
import { useHostCredentials } from '../../../hooks/useHostCredentials';
import { RemoteViewFrame } from '../../../workbench/remote-view/RemoteViewFrame';
import {
  manifest,
  runtimeScope,
} from '../../../workbench/remote-view/RemoteViewFrame.test-fixture';
import { ThemeProvider } from '../../Theme';
import { useStreamCredentials } from './useStreamCredentials';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('replaces standalone clients when the caller supplies a different key in the same organization', () => {
  const getClientSecret = vi.fn();
  const sendCommand = vi.fn();
  const { result, rerender } = renderHook(
    (apiKey: string) =>
      useStreamCredentials({
        apiKey,
        organizationId: 'org',
        getClientSecret,
        apiUrl: 'https://fixture.test/api/ai',
        locale: 'en-US',
        isParentAvailable: false,
        sendCommand,
        clientRef: React.useRef(null),
        lastEventIdRef: React.useRef(null),
      }),
    { initialProps: 'account-one-key' },
  );
  const { client, readClient } = result.current;
  rerender('account-two-key');
  expect(result.current.client).not.toBe(client);
  expect(result.current.readClient).not.toBe(readClient);
});

it('retains the Assistant profile and open View when the host echoes a renewed credential', async () => {
  const apiUrl = 'https://fixture.test/api/ai';
  const assistantId = 'assistant-1';
  const sendCommand = vi
    .fn()
    .mockResolvedValueOnce({ secret: 'first', organizationId: 'org' })
    .mockResolvedValueOnce({ secret: 'renewed', organizationId: 'org' })
    .mockResolvedValueOnce({ secret: 'next-account', organizationId: 'org' });
  const reads: string[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : String(input))
      .pathname;
    const authorization = new Headers(init?.headers).get('Authorization') ?? '';
    if (path.endsWith('/assistants/' + assistantId)) {
      const url =
        authorization === 'Bearer next-account' ? '/next.png' : '/order.png';
      return Response.json({
        name: 'Order Assistant',
        metadata: { avatar: { url } },
      });
    }
    if (path.endsWith('/manifest')) return Response.json(manifest);
    if (path.endsWith('/remote-component/entry'))
      return new Response('<main>Project tasks</main>');
    if (path.endsWith('/data')) {
      reads.push(authorization);
      return authorization === 'Bearer first'
        ? new Response(null, { status: 401 })
        : Response.json({ items: [] });
    }
    throw new Error('Unexpected request: ' + path);
  });
  vi.stubGlobal('fetch', fetch);
  const avatars: Array<string | undefined> = [];
  let readTasks: () => Promise<unknown>;

  function HostedView({ sessionKey }: { sessionKey: string }) {
    const host = useHostCredentials({
      initialClientSecret: '',
      apiUrl,
      assistantId,
      sessionKey,
      isParentAvailable: true,
      sendCommand,
    });
    const stream = useStreamCredentials({
      apiKey: host.clientSecret,
      organizationId: host.organizationId,
      getClientSecret: host.getClientSecret,
      apiUrl,
      locale: 'en-US',
      isParentAvailable: true,
      sendCommand,
      clientRef: React.useRef(null),
      lastEventIdRef: React.useRef(null),
    });
    const assistant = useAssistantInfo(
      host.clientSecret ? stream.client : null,
      assistantId,
    );
    avatars.push(
      assistant ? extractAssistantAvatar(assistant)?.url : undefined,
    );
    const viewHosts = stream.client.viewHosts;
    readTasks = () =>
      viewHosts.getData(
        'agent',
        assistantId,
        manifest.key,
        {},
        { runtimeScope },
      );
    if (!host.clientSecret) return null;
    return (
      <ThemeProvider>
        <RemoteViewFrame
          manifest={manifest}
          hostId={assistantId}
          runtimeScope={runtimeScope}
          locale="en-US"
          title="Project tasks"
          viewHosts={viewHosts}
          hostEvent={null}
          onNotify={vi.fn()}
          onClientCommand={vi.fn()}
        />
      </ThemeProvider>
    );
  }

  const { rerender } = render(<HostedView sessionKey="account-one" />);
  const frame = await screen.findByTitle('Project tasks');
  await waitFor(() =>
    expect(frame.parentElement).toHaveAttribute('aria-busy', 'false'),
  );
  await waitFor(() => expect(avatars.at(-1)).toBe('/order.png'));
  avatars.length = 0;
  fetch.mockClear();

  await act(async () => {
    await readTasks();
  });
  expect(reads).toEqual(['Bearer first', 'Bearer renewed']);
  expect(sendCommand).toHaveBeenCalledTimes(2);
  expect(sendCommand).toHaveBeenLastCalledWith('onGetClientSecret', 'first');
  expect(avatars).toContain('/order.png');
  expect(avatars).not.toContain(undefined);
  expect(screen.getByTitle('Project tasks')).toBe(frame);
  expect(fetch).toHaveBeenCalledTimes(2);

  avatars.length = 0;
  rerender(<HostedView sessionKey="account-two" />);
  await waitFor(() => expect(avatars.at(-1)).toBe('/next.png'));
  expect(avatars).not.toContain('/order.png');
  expect(await screen.findByTitle('Project tasks')).not.toBe(frame);
  expect(sendCommand).toHaveBeenLastCalledWith('onGetClientSecret', null);
});
