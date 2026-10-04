import { describe, expect, it, vi } from 'vitest';
import {
  executeWorkbenchCommand,
  type WorkbenchCommandHost,
} from './client-commands';
import type { ChatKitWorkbenchClientCommandRequest } from '@xpert-ai/chatkit-types';

function fixture(result: unknown = { success: false, code: 'unsupported' }) {
  const host: WorkbenchCommandHost = {
    apiUrl: 'https://xpert.example/api/ai',
    openView: vi.fn().mockReturnValue(true),
    openPreview: vi.fn(),
    revealChat: vi.fn(),
    updateComposer: vi.fn().mockResolvedValue(undefined),
    focusComposer: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn(),
    forward: vi.fn().mockResolvedValue(result),
  };
  const execute = (commandKey: string, payload: unknown) =>
    executeWorkbenchCommand(
      {
        commandKey,
        payload,
        hostType: 'agent',
        hostId: 'assistant',
        viewKey: 'source',
      },
      host,
    );
  return { host, execute };
}
describe('Workbench built-in commands', () => {
  it('discards a navigation authorization that completes after the context changes', async () => {
    const { host, execute } = fixture();
    let current = true;
    let complete!: (result: unknown) => void;
    host.isCurrent = () => current;
    host.forward = vi.fn(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const pending = execute('workbench.navigation.open', {
      target: 'assistant.conversation',
      conversationId: 'old',
    });
    current = false;
    complete({ success: true, status: 'opened' });
    expect(await pending).toEqual({ success: false, code: 'stale_context' });
    expect(host.navigate).not.toHaveBeenCalled();
  });
  it.each(['assistant.execution', 'assistant.conversation'])(
    'opens %s execution anchors internally without a host navigator',
    async (target) => {
      const { host, execute } = fixture();
      host.navigate = undefined;
      host.openExecution = vi
        .fn()
        .mockResolvedValue({ success: true, status: 'opened' });
      expect(
        await execute('workbench.navigation.open', {
          target,
          conversationId: 'conversation',
          threadId: 'thread',
          executionId: 'attempt-2',
          projectId: 'project',
        }),
      ).toEqual({ success: true, status: 'opened' });
      expect(host.openExecution).toHaveBeenCalledWith({
        conversationId: 'conversation',
        threadId: 'thread',
        executionId: 'attempt-2',
        projectId: 'project',
      });
      expect(host.forward).not.toHaveBeenCalled();
    },
  );
  it.each([
    'forbidden',
    'execution_unavailable',
    'execution_load_failed',
    'stale_context',
  ])(
    'does not fall back to host navigation after a local %s failure',
    async (code) => {
      const { host, execute } = fixture();
      host.openExecution = vi.fn().mockResolvedValue({ success: false, code });
      expect(
        await execute('workbench.navigation.open', {
          target: 'assistant.execution',
          conversationId: 'conversation',
          executionId: 'attempt',
        }),
      ).toEqual({ success: false, code });
      expect(host.forward).not.toHaveBeenCalled();
    },
  );
  it('falls back once using the compatible host contract for a different conversation', async () => {
    const { host, execute } = fixture({ success: true, status: 'opened' });
    host.openExecution = vi
      .fn()
      .mockResolvedValue({ success: false, code: 'unsupported' });
    await execute('workbench.navigation.open', {
      target: 'assistant.execution',
      conversationId: 'other',
      threadId: 'branch',
      executionId: 'attempt',
    });
    expect(host.openExecution).toHaveBeenCalledOnce();
    expect(host.forward).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          target: 'assistant.conversation',
          conversationId: 'other',
          threadId: 'branch',
          executionId: 'attempt',
        }),
      }),
    );
  });
  it('keeps plain conversation navigation host-owned and validates execution targets', async () => {
    const { host, execute } = fixture({ success: true, status: 'opened' });
    host.openExecution = vi.fn();
    expect(
      await execute('workbench.navigation.open', {
        target: 'assistant.execution',
        conversationId: 'conversation',
      }),
    ).toMatchObject({ code: 'bad_request' });
    expect(
      await execute('workbench.navigation.open', {
        target: 'assistant.conversation',
        conversationId: 'conversation',
      }),
    ).toMatchObject({ success: true });
    expect(host.openExecution).not.toHaveBeenCalled();
    expect(host.forward).toHaveBeenCalledOnce();
  });
  it('opens a registered view with sanitized selection and parameters without forwarding', async () => {
    const { host, execute } = fixture();
    expect(
      await execute('workbench.navigation.open', {
        target: 'workbench.view',
        viewKey: 'target',
        selectionId: 'item',
        parameters: { year: 2026, ids: ['a'], invalid: {} },
      }),
    ).toMatchObject({ success: true, status: 'opened' });
    expect(host.openView).toHaveBeenCalledWith('target', {
      selectionId: 'item',
      parameters: { year: 2026, ids: ['a'] },
    });
    expect(host.forward).not.toHaveBeenCalled();
    vi.mocked(host.openView).mockReturnValue(false);
    expect(
      await execute('workbench.navigation.open', {
        target: 'workbench.view',
        viewKey: 'missing',
      }),
    ).toMatchObject({ code: 'view_unavailable' });
  });
  it('appends references without replacing composer text and tolerates focus failures', async () => {
    const { host, execute } = fixture();
    vi.mocked(host.focusComposer).mockRejectedValue(new Error('hidden'));
    expect(
      await execute('assistant.composer.append_references', {
        references: [{ type: 'quote', text: 'Evidence' }],
      }),
    ).toEqual({ success: true, status: 'appended', focused: false });
    expect(host.updateComposer).toHaveBeenCalledWith({
      appendReferences: true,
      references: [
        expect.objectContaining({ type: 'quote', text: 'Evidence' }),
      ],
    });
    expect(host.revealChat).toHaveBeenCalledOnce();
    expect(
      await execute('assistant.composer.append_references', {
        references: [{ type: 'unknown' }],
      }),
    ).toMatchObject({ code: 'bad_request' });
    expect(host.updateComposer).toHaveBeenCalledOnce();
  });
  it('opens a file with evidence, stable identity and a relative signed preview URL', async () => {
    const { host, execute } = fixture();
    await execute('workbench.file.open', {
      fileAssetId: 'asset',
      name: 'Evidence.pdf',
      url: '/preview/report.pdf?grant=short',
      evidence: {
        text: 'Excerpt',
        locator: { page: 7, box: { x: 1, y: 2, width: 3, height: 4 } },
      },
    });
    expect(host.openPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'chatkit.preview.file:asset',
        url: 'https://xpert.example/preview/report.pdf?grant=short',
        file: expect.objectContaining({
          evidence: expect.objectContaining({
            text: 'Excerpt',
            locator: expect.objectContaining({ page: 7 }),
          }),
        }),
      }),
    );
    await execute('workbench.browser.open', {
      deploymentUrl: 'https://preview.example/app',
      title: 'App',
    });
    expect(host.openPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 'browser',
        title: 'App',
        url: 'https://preview.example/app',
      }),
    );
  });
  it.each([
    'javascript:alert(1)',
    'file:///etc/passwd',
    'data:text/html,hello',
    'https://user:password@example.org',
  ])('rejects unsafe preview URL %s', async (url) => {
    const { host, execute } = fixture();
    expect(await execute('workbench.file.open', { url })).toMatchObject({
      code: 'bad_request',
    });
    expect(host.openPreview).not.toHaveBeenCalled();
  });
  it('consumes authorized navigation credentials without exposing them to the remote view', async () => {
    const session = {
      assistantId: 'canonical',
      projectId: null,
      conversationId: 'conversation',
      threadId: 'thread',
      secret: 'never-return-to-plugin',
      organizationId: 'org',
    };
    const { host, execute } = fixture({ success: true, session });
    const result = await execute('workbench.navigation.open', {
      target: 'assistant.conversation',
      conversationId: 'conversation',
      xpertId: 'untrusted',
    });
    expect(result).toEqual({
      success: true,
      status: 'opened',
      target: 'assistant.conversation',
      conversationId: 'conversation',
      threadId: 'thread',
      xpertId: 'canonical',
      projectId: null,
    });
    expect(host.navigate).toHaveBeenCalledWith(session, expect.any(Object));
    expect(JSON.stringify(result)).not.toContain(session.secret);
    expect(
      await execute('workbench.navigation.open', {
        target: 'assistant.conversation',
        conversationId: 'different',
      }),
    ).toMatchObject({ code: 'navigation_mismatch' });
    expect(host.navigate).toHaveBeenCalledOnce();
  });
  it('keeps host-owned navigation compatible and rejects incomplete credentials', async () => {
    const { host, execute } = fixture({ success: true, status: 'opened' });
    const payload = { target: 'assistant.project', projectId: 'project' };
    expect(await execute('workbench.navigation.open', payload)).toMatchObject({
      success: true,
    });
    expect(host.navigate).not.toHaveBeenCalled();
    vi.mocked(host.forward).mockResolvedValue({
      success: true,
      session: { secret: 'private' },
    });
    expect(await execute('workbench.navigation.open', payload)).toEqual({
      success: false,
      code: 'invalid_session',
    });
  });
  it('preserves a host navigation failure so a view can display why it did not open', async () => {
    const failure = {
      success: false,
      code: 'forbidden',
      message: 'This execution is not accessible.',
    };
    const { host, execute } = fixture(failure);
    expect(
      await execute('workbench.navigation.open', {
        target: 'assistant.conversation',
        conversationId: 'conversation',
      }),
    ).toEqual(failure);
    expect(host.navigate).not.toHaveBeenCalled();
  });
  it('forwards platform commands unchanged', async () => {
    const { host, execute } = fixture({
      success: true,
      status: 'created',
      dataSourceId: 'source',
    });
    expect(await execute('platform.data-source.create', {})).toMatchObject({
      status: 'created',
      dataSourceId: 'source',
    });
    expect(host.forward).toHaveBeenCalledWith(
      expect.objectContaining<Partial<ChatKitWorkbenchClientCommandRequest>>({
        commandKey: 'platform.data-source.create',
      }),
    );
  });
});
