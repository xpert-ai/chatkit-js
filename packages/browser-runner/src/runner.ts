import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  ClientToolMessageInput,
  HostPageAutomationClientToolCall,
} from './types.js';

export type BrowserRunnerState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'paused'
  | 'error';

export type BrowserRunnerStatus = {
  state: BrowserRunnerState;
  sessionId?: string;
  invalidatedPageStateId?: string;
  error?: string;
};

export type IsolatedBrowserLaunchOptions = {
  sessionId: string;
  headless: false;
  profileDir: string;
  downloadsDir: string;
  startUrl?: string;
};

export type IsolatedBrowserSession = {
  execute: (
    call: HostPageAutomationClientToolCall,
  ) => Promise<ClientToolMessageInput>;
  close: () => Promise<void>;
  onManualIntervention: (listener: () => void) => void;
  onClosed: (listener: () => void) => void;
};

export type BrowserRunnerOptions = {
  launch: (
    options: IsolatedBrowserLaunchOptions,
  ) => Promise<IsolatedBrowserSession>;
};

function readSnapshotPageStateId(
  response: ClientToolMessageInput,
): string | undefined {
  if (typeof response.content !== 'string') return undefined;
  try {
    const payload = JSON.parse(response.content) as {
      result?: { pageStateId?: unknown };
    };
    return typeof payload.result?.pageStateId === 'string'
      ? payload.result.pageStateId
      : undefined;
  } catch {
    return undefined;
  }
}

function bindLatestNavigationPageState(
  call: HostPageAutomationClientToolCall,
  pageStateId: string | undefined,
): HostPageAutomationClientToolCall {
  if (
    call.name !== 'host_page_navigate' ||
    !pageStateId ||
    Object.prototype.hasOwnProperty.call(call.params ?? {}, 'pageStateId')
  ) {
    return call;
  }

  return {
    ...call,
    params: {
      ...(call.params ?? {}),
      pageStateId,
    },
  };
}

function createPausedToolMessage(
  call: HostPageAutomationClientToolCall,
  pageStateId: string | undefined,
): ClientToolMessageInput {
  return {
    tool_call_id: call.tool_call_id ?? call.id,
    name: call.name,
    status: 'error',
    content: JSON.stringify({
      ok: false,
      code: 'stale_page_state',
      message:
        'The isolated browser was changed manually. Take a fresh snapshot before continuing.',
      recoverable: true,
      dispatched: false,
      outcome: 'rejected_before_execution',
      requiresFreshSnapshot: true,
      ...(pageStateId ? { invalidatedPageStateId: pageStateId } : {}),
    }),
  };
}

export class BrowserRunner {
  private session?: IsolatedBrowserSession;
  private sessionRoot?: string;
  private currentStatus: BrowserRunnerStatus = { state: 'stopped' };
  private pageStateId?: string;
  private stopping?: Promise<void>;

  constructor(private readonly options: BrowserRunnerOptions) {}

  status(): BrowserRunnerStatus {
    return { ...this.currentStatus };
  }

  async start(
    options: { startUrl?: string } = {},
  ): Promise<BrowserRunnerStatus> {
    if (this.session) {
      return this.status();
    }

    const sessionId = randomUUID();
    this.currentStatus = { state: 'starting', sessionId };
    const sessionRoot = await mkdtemp(
      join(tmpdir(), 'chatkit-browser-runner-'),
    );
    const profileDir = join(sessionRoot, 'profile');
    const downloadsDir = join(sessionRoot, 'downloads');
    await Promise.all([
      mkdir(profileDir, { recursive: true }),
      mkdir(downloadsDir, { recursive: true }),
    ]);
    this.sessionRoot = sessionRoot;

    try {
      const session = await this.options.launch({
        sessionId,
        headless: false,
        profileDir,
        downloadsDir,
        ...(options.startUrl ? { startUrl: options.startUrl } : {}),
      });
      this.session = session;
      session.onManualIntervention(() => {
        if (!this.session) return;
        this.currentStatus = {
          state: 'paused',
          sessionId,
          ...(this.pageStateId
            ? { invalidatedPageStateId: this.pageStateId }
            : {}),
        };
      });
      session.onClosed(() => {
        void this.stop({ closeSession: false });
      });
      this.currentStatus = { state: 'running', sessionId };
      return this.status();
    } catch (error) {
      this.currentStatus = {
        state: 'error',
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      };
      await this.cleanupSessionRoot();
      throw error;
    }
  }

  async execute(
    call: HostPageAutomationClientToolCall,
  ): Promise<ClientToolMessageInput> {
    if (!this.session) {
      throw new Error('The isolated browser is not running.');
    }
    if (
      this.currentStatus.state === 'paused' &&
      call.name !== 'host_page_snapshot'
    ) {
      return createPausedToolMessage(call, this.pageStateId);
    }

    const preparedCall = bindLatestNavigationPageState(call, this.pageStateId);
    const response = await this.session.execute(preparedCall);
    if (call.name === 'host_page_snapshot' && response.status !== 'error') {
      this.pageStateId = readSnapshotPageStateId(response);
      this.currentStatus = {
        state: 'running',
        ...(this.currentStatus.sessionId
          ? { sessionId: this.currentStatus.sessionId }
          : {}),
      };
    }
    return response;
  }

  async stop(options: { closeSession?: boolean } = {}): Promise<void> {
    if (this.stopping) {
      return this.stopping;
    }
    this.stopping = (async () => {
      const session = this.session;
      this.session = undefined;
      this.pageStateId = undefined;
      try {
        if (session && options.closeSession !== false) {
          await session.close();
        }
      } finally {
        await this.cleanupSessionRoot();
        this.currentStatus = { state: 'stopped' };
        this.stopping = undefined;
      }
    })();
    return this.stopping;
  }

  private async cleanupSessionRoot() {
    const sessionRoot = this.sessionRoot;
    this.sessionRoot = undefined;
    if (sessionRoot) {
      await rm(sessionRoot, { recursive: true, force: true });
    }
  }
}
