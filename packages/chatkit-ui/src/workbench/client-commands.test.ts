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
