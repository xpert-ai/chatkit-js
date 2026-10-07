import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryThread: null as string | null,
  isParentAvailable: false,
  getThread: vi.fn(),
  watchActivity: vi.fn(),
  getRun: vi.fn(),
  releaseDisplayPause: vi.fn(),
  getConversation: vi.fn(),
  searchMessages: vi.fn(),
  searchConversations: vi.fn(),
  listRuns: vi.fn(),
  joinStream: vi.fn(),
  runStream: vi.fn(),
  cancelRun: vi.fn(),
  pauseRun: vi.fn(),
  resumeRun: vi.fn(),
  clearActivities: vi.fn(),
  refreshServices: vi.fn(),
  sendEvent: vi.fn(),
  sendCommand: vi.fn(),
}));

vi.mock('@xpert-ai/xpert-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xpert-ai/xpert-sdk')>();
  class Client {
    threads = {
      get: mocks.getThread,
      watchActivity: mocks.watchActivity,
      releaseDisplayPause: mocks.releaseDisplayPause,
    };
    conversations = {
      get: mocks.getConversation,
      search: mocks.searchConversations,
      searchMessages: mocks.searchMessages,
    };
    runs = {
      get: mocks.getRun,
      list: mocks.listRuns,
      joinStream: mocks.joinStream,
      stream: mocks.runStream,
      cancel: mocks.cancelRun,
      pause: mocks.pauseRun,
      resume: mocks.resumeRun,
    };
  }
  return { ...actual, Client };
});
vi.mock('nuqs', async () => {
  const react = await import('react');
  return { useQueryState: () => react.useState(mocks.queryThread) };
});
vi.mock('../../../hooks/useParentMessenger', () => ({
  useParentMessenger: () => ({
    isParentAvailable: mocks.isParentAvailable,
    sendCommand: mocks.sendCommand,
    sendEvent: mocks.sendEvent,
  }),
}));
vi.mock('../../runtime-activities', () => ({
  logRuntimeActivity: vi.fn(),
  useRuntimeActivities: () => ({
    runtimeActivities: {},
    clearRuntimeActivities: mocks.clearActivities,
    refreshSandboxServices: mocks.refreshServices,
    handleRuntimeActivityTrigger: mocks.clearActivities,
    stopRuntimeActivityItem: mocks.clearActivities,
  }),
}));

import {
  StreamProvider as StreamProviderComponent,
  useStreamContext,
  type StreamContextType,
} from '../../Stream';

export let stream: StreamContextType;
export function useTestStream() {
  stream = useStreamContext();
  return stream;
}
export function Probe() {
  useTestStream();
  return null;
}
export function provider(
  initialThread?: string,
  apiKey = 'cs-x-test',
  projectId = 'project-1',
) {
  return (
    <StreamProvider
      apiKey={apiKey}
      apiUrl="https://api.example.test/api/ai"
      xpertId="assistant-1"
      projectId={projectId}
      initialThread={initialThread}
      threadStateMode={mocks.queryThread ? 'url' : 'memory'}
    >
      <Probe />
    </StreamProvider>
  );
}
export function history(threadId: string) {
  return {
    items: [
      { id: `${threadId}-human`, role: 'human', content: 'Question' },
      {
        id: `${threadId}-ai`,
        role: 'ai',
        content: 'Saved reply',
        executionId: `${threadId}-run`,
      },
    ],
    total: 2,
  };
}
export function savedDisplay(
  messages = [{ id: 'visible-ai', type: 'ai', content: 'Visible prefix' }],
) {
  return {
    executionId: 'run',
    pauseId: 'pause-token',
    createdAt: '2026-09-19T00:00:00Z',
    snapshot: JSON.stringify({ version: 1, messages }),
  };
}

export function readStepStatus(message: { content?: unknown } | undefined) {
  const content = message?.content;
  if (!Array.isArray(content)) return undefined;
  const step = content.find(
    (part): part is { data: { status?: unknown } } =>
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      part.type === 'component',
  );
  return step?.data?.status;
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Bind after Vitest registers the fixture's hoisted mocks.
export const StreamProvider = StreamProviderComponent;
export { mocks };

export function setupHistoryTests() {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryThread = null;
    mocks.isParentAvailable = false;
    mocks.sendCommand.mockReset();
    mocks.getThread.mockImplementation(async (id: string) => ({
      metadata: { id: `conversation-${id}` },
    }));
    mocks.watchActivity.mockReset().mockImplementation(async function* () {});
    mocks.getConversation.mockImplementation(async (id: string) => ({
      id,
      status: 'idle',
    }));
    mocks.searchMessages.mockImplementation(
      async (_id: string, query: { where: { threadId: string } }) =>
        history(query.where.threadId),
    );
    mocks.listRuns.mockResolvedValue([]);
    mocks.getRun.mockReset().mockResolvedValue({ metadata: {} });
    mocks.refreshServices.mockResolvedValue(undefined);
    mocks.cancelRun.mockResolvedValue(undefined);
    mocks.releaseDisplayPause.mockReset().mockResolvedValue(undefined);
    mocks.pauseRun
      .mockReset()
      .mockImplementation(async (_thread, run) => ({
        state: 'pausing',
        executionId: run,
        pauseId: 'pause-token',
      }));
    mocks.runStream.mockReset().mockImplementation(async function* () {});
  });
  afterEach(cleanup);
}
