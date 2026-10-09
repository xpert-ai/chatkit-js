import { CHATKIT_INTERNAL_PARENT_EVENT } from './host-events';
import * as React from 'react';
import {
  act,
  fireEvent,
  render as renderUI,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import type {
  XpertExtensionViewManifest,
  XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import type { StateType } from '../providers/Stream';

const mocks = vi.hoisted(() => ({
  listSlotViews: vi.fn(),
  updateComposer: vi.fn(),
  focusComposer: vi.fn(),
  submit: vi.fn(),
  copyThread: vi.fn(),
  deleteThread: vi.fn(),
  sideChatProps: null as null | {
    referenceRequest?: { reference?: { text?: string } };
  },
  sideChatMounts: 0,
  sideChatUnmounts: 0,
  remoteUnmounts: 0,
  resizeCallback: null as ResizeObserverCallback | null,
  remoteViewProps: null as {
    initialQuery?: XpertViewQuery;
    onClientCommand: (
      commandKey: string,
      payload: unknown,
      manifest: XpertExtensionViewManifest,
    ) => Promise<unknown>;
  } | null,
  stream: {
    client: {
      viewHosts: {
        listSlotViews: vi.fn(),
        getManifest: vi.fn(),
        getData: vi.fn(),
        getRemoteComponentEntry: vi.fn(),
        getParameterOptions: vi.fn(),
        executeAction: vi.fn(),
        executeFileAction: vi.fn(),
        createFileAccessSession: vi.fn(),
        createFileAccessGrant: vi.fn(),
        readFileAccess: vi.fn(),
        revokeFileAccessSession: vi.fn(),
      },
      threads: {
        copy: vi.fn(),
        delete: vi.fn(),
      },
      workbench: { listFiles: vi.fn(), downloadArtifact: vi.fn() },
      conversations: { listTaskSummaryItems: vi.fn() },
      runs: { get: vi.fn() },
    },
    apiKey: 'cs-x-secret',
    apiUrl: '/api/ai',
    authenticatedFetch: vi.fn(),
    assistantId: 'agent-1',
    projectId: 'project-1',
    organizationId: 'organization-1',
    threadId: 'thread-1',
    conversationId: 'conversation-1',
    isLoading: false,
    messages: [] as StateType['messages'],
    submit: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock('../providers/Stream', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../providers/Stream')>()),
  useStreamContext: () => mocks.stream,
  StreamProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/chat', () => ({
  Chat: (props: { referenceRequest?: { reference?: { text?: string } } }) => {
    React.useEffect(() => {
      mocks.sideChatMounts += 1;
      return () => {
        mocks.sideChatUnmounts += 1;
      };
    }, []);
    mocks.sideChatProps = props;
    return <div data-testid="side-chat" />;
  },
}));

vi.mock('../hooks/useParentMessenger', () => ({
  useParentMessenger: () => ({
    isParentAvailable: false,
    updateComposer: mocks.updateComposer,
    focusComposer: mocks.focusComposer,
    sendCommand: vi.fn(),
  }),
}));

vi.mock('./native/terminal/WorkbenchTerminal', () => ({
  default: () => <div data-testid="terminal">Terminal content</div>,
}));

vi.mock('./remote-view/RemoteViewFrame', () => ({
  RemoteViewFrame: (props: {
    title: string;
    onClientCommand: (
      commandKey: string,
      payload: unknown,
      manifest: XpertExtensionViewManifest,
    ) => Promise<unknown>;
  }) => {
    React.useEffect(
      () => () => {
        mocks.remoteUnmounts += 1;
      },
      [],
    );
    mocks.remoteViewProps = props;
    return <div data-testid="remote-view">{props.title}</div>;
  },
}));

import {
  WorkbenchShell,
  WorkbenchToggleButton,
  useWorkbench,
} from './WorkbenchShell';
import { SIDE_CHAT_CLOSE_CONFIRMATION_STORAGE_KEY } from './side-chat/SideChatCloseDialog';
import { workbenchLayoutKey, writeWorkbenchLayout } from './layout-storage';
import { AssistantMessage } from '../components/thread/messages/ai';
import { toWorkbenchMessages } from './external-assistant/external-assistant-runs';
import { ThemeProvider } from '../providers/Theme';

const render = (ui: React.ReactElement) =>
  renderUI(ui, { wrapper: ThemeProvider });

function ExternalTranscript() {
  return (
    <>
      {toWorkbenchMessages(mocks.stream.messages).map((message) => (
        <AssistantMessage
          key={message.id}
          message={{ ...message, type: 'assistant' }}
        />
      ))}
    </>
  );
}

function externalMessages(text = 'External response'): StateType['messages'] {
  return [
    {
      id: 'message-1',
      type: 'ai',
      executionId: 'root',
      content: [
        { type: 'text', text: 'Main response' },
        {
          type: 'text',
          text,
          executionId: 'external-1',
          parentExecutionId: 'root',
        },
        {
          type: 'text',
          text: 'Unchanged sub-agent output',
          executionId: 'sub-1',
          parentExecutionId: 'root',
        },
      ],
      agentRuns: [
        {
          id: 'external-1',
          parentId: 'root',
          invocationKind: 'external_assistant',
          title: 'External review',
          model: 'model-review',
          status: 'running',
        },
        {
          id: 'sub-1',
          parentId: 'root',
          invocationKind: 'sub_agent',
          title: 'Internal reviewer',
          status: 'running',
        },
      ],
    },
  ];
}

const manifest: XpertExtensionViewManifest = {
  key: 'provider__documents',
  title: { en_US: 'Documents', zh_Hans: '文档' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  order: 10,
  source: { provider: 'provider' },
  workbench: { openMode: 'auto', menu: { enabled: true, order: 10 } },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: {
      isolation: 'iframe',
      entry: 'documents',
    },
    dataSource: { mode: 'platform' },
  },
  dataSource: { mode: 'platform' },
};

const baseOptions = {
  api: {
    apiUrl: '/api/ai',
    xpertId: 'agent-1',
    getClientSecret: async () => 'secret',
  },
} satisfies ChatKitOptions;

class ResizeObserverMock {
  constructor(private callback: ResizeObserverCallback) {}
  observe(element: Element) {
    if (element.getAttribute('data-testid') === 'html-preview-viewport') {
      Object.defineProperties(element, {
        clientWidth: { value: 800, configurable: true },
        clientHeight: { value: 600, configurable: true },
      });
    }
    if (element.hasAttribute('data-chatkit-workbench-root')) {
      mocks.resizeCallback = this.callback;
    }
  }
  disconnect() {}
  unobserve() {}
}

export function setupWorkbenchTests() {
  beforeEach(() => {
    mocks.listSlotViews.mockReset();
    mocks.updateComposer.mockReset().mockResolvedValue(undefined);
    mocks.focusComposer.mockReset().mockResolvedValue(undefined);
    mocks.submit.mockReset();
    mocks.copyThread.mockReset();
    mocks.deleteThread.mockReset();
    mocks.stream.client.viewHosts.listSlotViews = mocks.listSlotViews;
    mocks.stream.client.threads.copy = mocks.copyThread;
    mocks.stream.client.threads.delete = mocks.deleteThread;
    mocks.stream.submit = mocks.submit;
    mocks.resizeCallback = null;
    mocks.remoteViewProps = null;
    mocks.sideChatProps = null;
    mocks.sideChatMounts = 0;
    mocks.sideChatUnmounts = 0;
    mocks.remoteUnmounts = 0;
    mocks.stream.reset.mockReset();
    mocks.stream.client.workbench.listFiles.mockReset().mockResolvedValue([]);
    mocks.stream.client.runs.get
      .mockReset()
      .mockImplementation(async (threadId: string, runId: string) => ({
        run_id: runId,
        thread_id: threadId,
        status: 'running',
      }));
    mocks.stream.isLoading = false;
    mocks.stream.apiKey = 'cs-x-secret';
    mocks.stream.apiUrl = '/api/ai';
    mocks.stream.assistantId = 'agent-1';
    mocks.stream.projectId = 'project-1';
    mocks.stream.organizationId = 'organization-1';
    mocks.stream.messages = [];
    mocks.stream.threadId = 'thread-1';
    mocks.stream.conversationId = 'conversation-1';
    window.localStorage.clear();
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });
}

function setObservedWidth(width: number) {
  act(() => {
    mocks.resizeCallback?.(
      [
        {
          contentRect: { width },
        } as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
  });
}

export const fixture = {
  React,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  vi,
  mocks,
  WorkbenchShell,
  WorkbenchToggleButton,
  useWorkbench,
  SIDE_CHAT_CLOSE_CONFIRMATION_STORAGE_KEY,
  workbenchLayoutKey,
  writeWorkbenchLayout,
  AssistantMessage,
  toWorkbenchMessages,
  ThemeProvider,
  ExternalTranscript,
  externalMessages,
  manifest,
  baseOptions,
  setObservedWidth,
  CHATKIT_INTERNAL_PARENT_EVENT,
};
export type { ChatKitOptions, XpertExtensionViewManifest, StateType };
