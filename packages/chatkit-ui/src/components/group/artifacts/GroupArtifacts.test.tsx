import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  Client,
  type ChatGroupSnapshot,
  type GroupArtifactReference,
  type GroupArtifactView,
} from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../../providers/Theme';
import { GroupArtifacts } from './GroupArtifacts';
import { GroupArtifactViewer } from './GroupArtifactViewer';
import { isolatePresentationHtml } from './presentation-bridge';

const translation = vi.hoisted(() => ({
  t: (key: string) => key,
  i18n: { language: 'en-US' },
}));
vi.mock('../../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => translation,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const group: ChatGroupSnapshot = {
  id: 'g',
  title: 'Group',
  threadId: 't',
  xpertId: 'assistant',
  viewerParticipantId: 'owner',
  revision: 1,
  hasMore: false,
  messages: [],
  runs: [],
  members: [
    {
      id: 'owner',
      subjectId: 'u',
      name: 'Owner',
      kind: 'user',
      role: 'owner',
      active: true,
    },
  ],
};
const reference: GroupArtifactReference = {
  id: 'r',
  grantId: 'grant',
  artifactId: 'a',
  versionId: 'v1',
  ownerProjectId: 'authoring',
  runtimeProjectId: 'runtime',
  groupId: 'g',
  title: 'Inventory',
  versionNumber: 1,
  revision: 1,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  readOnly: true,
  url: 'https://example.test/artifacts/library/r',
};
const view: GroupArtifactView = {
  reference,
  title: reference.title,
  revision: 1,
  content: {
    kind: 'presentation',
    presentation: {
      schemaVersion: 1,
      target: { artifactId: 'a', versionId: 'v1' },
      title: 'Inventory',
      versionNumber: 1,
      readOnly: true,
      entry: { html: '<html><head></head><body>Inventory</body></html>' },
      data: { meta: {} },
      operations: ['query'],
      expiresAt: reference.expiresAt,
    },
  },
};
function client() {
  return new Client({ apiUrl: 'https://example.test/api/ai' });
}

it.each([false, true])(
  'requires explicit group-owner consent for analysis: %s',
  async (consent) => {
    const c = client(),
      api = c.groups.artifacts;
    vi.spyOn(api, 'list').mockResolvedValue({ items: [], nextOffset: null });
    vi.spyOn(api, 'offers').mockResolvedValue({
      items: [
        {
          ...reference,
          id: 'grant',
          targetGroupId: 'g',
          targetProjectId: 'runtime',
          permission: 'read',
          status: 'offered',
          analysis: {
            mode: 'explore',
            datasets: [
              {
                key: 'inventory',
                fields: ['plant', 'value'],
                filters: [{ field: 'plant', operator: 'eq', values: ['A'] }],
              },
            ],
            allowDetails: false,
            maxRows: 20,
          },
        },
      ],
      nextOffset: null,
    });
    const accept = vi.spyOn(api, 'accept').mockResolvedValue(reference);
    render(
      <ThemeProvider>
        <GroupArtifacts
          client={c}
          group={group}
          onClose={() => {}}
          onOpen={() => {}}
        />
      </ThemeProvider>,
    );
    const checkbox = await screen.findByRole('checkbox', {
      name: 'group.artifacts.acceptAnalysis',
    });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText('plant eq A')).toBeTruthy();
    if (consent) fireEvent.click(checkbox);
    fireEvent.click(screen.getByText('group.artifacts.accept'));
    await waitFor(() =>
      expect(accept).toHaveBeenCalledWith(
        'g',
        { grantId: 'grant', expectedRevision: 1, acceptAnalysis: consent },
        expect.anything(),
      ),
    );
  },
);

it('accepts an offer with its revision and refreshes the group references, including StrictMode remount', async () => {
  const c = client(),
    api = c.groups.artifacts;
  const list = vi
    .spyOn(api, 'list')
    .mockResolvedValue({ items: [], nextOffset: null });
  vi.spyOn(api, 'offers').mockResolvedValue({
    items: [
      {
        ...reference,
        id: 'grant',
        targetGroupId: 'g',
        targetProjectId: 'runtime',
        permission: 'read',
        status: 'offered',
      },
    ],
    nextOffset: null,
  });
  const accept = vi.spyOn(api, 'accept').mockImplementation(async () => {
    list.mockResolvedValue({ items: [reference], nextOffset: null });
    return reference;
  });
  render(
    <React.StrictMode>
      <ThemeProvider>
        <GroupArtifacts
          client={c}
          group={group}
          onClose={() => {}}
          onOpen={() => {}}
        />
      </ThemeProvider>
    </React.StrictMode>,
  );
  fireEvent.click(await screen.findByText('group.artifacts.accept'));
  await screen.findByText('group.artifacts.open');
  expect(accept).toHaveBeenCalledWith(
    'g',
    { grantId: 'grant', expectedRevision: 1 },
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

it('does not request offers or show accept/remove controls to an ordinary member', async () => {
  const c = client();
  vi.spyOn(c.groups.artifacts, 'list').mockResolvedValue({
    items: [reference],
    nextOffset: null,
  });
  const offers = vi.spyOn(c.groups.artifacts, 'offers');
  render(
    <ThemeProvider>
      <GroupArtifacts
        client={c}
        group={{ ...group, members: [{ ...group.members[0], role: 'member' }] }}
        onClose={() => {}}
        onOpen={() => {}}
      />
    </ThemeProvider>,
  );
  await screen.findByText('group.artifacts.open');
  expect(offers).not.toHaveBeenCalled();
  expect(screen.queryByText('group.artifacts.remove')).toBeNull();
});

it('isolates published HTML and rejects host/file/network authority', () => {
  expect(
    isolatePresentationHtml(view.content.presentation.entry.html),
  ).toContain("connect-src 'none'");
  expect(() =>
    isolatePresentationHtml('<script>fetch("/private")</script>'),
  ).toThrow();
});

it('revalidates data, restricts operations and removes the iframe on query revocation', async () => {
  const c = client(),
    read = vi.spyOn(c.groups.artifacts, 'read').mockResolvedValue(view);
  const query = vi
    .spyOn(c.groups.artifacts, 'query')
    .mockRejectedValue(new Error('revoked'));
  const mounted = render(
    <ThemeProvider
      theme={{ radius: 'sharp', density: 'compact', colorScheme: 'light' }}
    >
      <GroupArtifactViewer client={c} groupId="g" referenceId="r" />
    </ThemeProvider>,
  );
  const frame = await screen.findByTitle<HTMLIFrameElement>('Inventory');
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
  const frameWindow = frame.contentWindow;
  if (!frameWindow) throw new Error('Presentation iframe is not mounted');
  const post = vi.spyOn(frameWindow, 'postMessage');
  const message = (data: object, source: Window | null = frame.contentWindow) =>
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source,
          data: {
            channel: 'xpertai.remote_component',
            protocolVersion: 1,
            ...data,
          },
        }),
      );
    });
  message({ type: 'ready' }, window);
  expect(post).not.toHaveBeenCalled();
  message({ type: 'ready' });
  const init = post.mock.calls[0][0];
  message({
    type: 'executeAction',
    instanceId: init.instanceId,
    requestId: 'bad',
    actionKey: 'export',
    input: {},
  });
  expect(query).not.toHaveBeenCalled();
  message({
    type: 'requestData',
    instanceId: init.instanceId,
    requestId: 'read',
  });
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  mounted.rerender(
    <ThemeProvider
      theme={{ radius: 'round', density: 'spacious', colorScheme: 'dark' }}
    >
      <GroupArtifactViewer client={c} groupId="g" referenceId="r" />
    </ThemeProvider>,
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'init',
        theme: expect.objectContaining({ mode: 'dark' }),
      }),
      '*',
    ),
  );
  message({
    type: 'executeAction',
    instanceId: init.instanceId,
    requestId: 'query',
    actionKey: 'query',
    input: {},
  });
  await screen.findByText('workbench.presentation.unavailable');
  expect(screen.queryByTitle('Inventory')).toBeNull();
  expect(query).toHaveBeenCalledWith(
    'g',
    'r',
    { target: view.content.presentation.target, operation: 'query', input: {} },
    expect.any(Object),
  );
});

it('opens a reference through the Workbench callback instead of loading a dialog viewer', async () => {
  const c = client(),
    onOpen = vi.fn();
  vi.spyOn(c.groups.artifacts, 'list').mockResolvedValue({
    items: [reference],
    nextOffset: null,
  });
  vi.spyOn(c.groups.artifacts, 'offers').mockResolvedValue({
    items: [],
    nextOffset: null,
  });
  const read = vi.spyOn(c.groups.artifacts, 'read');
  render(
    <ThemeProvider>
      <GroupArtifacts
        client={c}
        group={group}
        onOpen={onOpen}
        onClose={() => {}}
      />
    </ThemeProvider>,
  );
  fireEvent.click(await screen.findByText('group.artifacts.open'));
  expect(onOpen).toHaveBeenCalledWith(reference);
  expect(read).not.toHaveBeenCalled();
  expect(document.querySelector('iframe')).toBeNull();
});
