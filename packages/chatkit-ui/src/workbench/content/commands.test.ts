import { describe, expect, it, vi } from 'vitest';
import { ContentClient } from '@xpert-ai/xpert-sdk';
import { EditorLifecycle } from '../editors/editor-lifecycle';
import {
  executeContentCommand,
  resourceLink,
  type ContentCommandHost,
} from './commands';
const resourceId = 'cef1b690-fde3-4cc0-982a-e930e6206d8d';
function setup() {
  const api = new ContentClient({ json: vi.fn() });
  vi.spyOn(api, 'resolve').mockResolvedValue({
    viewKey: 'markdown.editor',
    parameters: { contentProvider: 'files' },
  });
  const host: ContentCommandHost = {
    api,
    scope: { assistantId: 'assistant', projectId: 'project' },
    editors: new EditorLifecycle(),
    viewKey: 'spaces',
    isCurrent: () => true,
    close: vi.fn(),
    review: vi.fn(),
    copy: vi.fn(async () => true),
    linkBaseUrl: 'https://example.test/chat/x/assistant/p/{projectId}/c',
  };
  return host;
}
describe('ChatKit content commands', () => {
  it('resolves through SDK without saving unrelated documents or opening a host view', async () => {
    const host = setup(),
      save = vi.fn(async () => false);
    host.editors.register('other', {
      tabKey: 'other',
      dirty: true,
      prepare: save,
    });
    const result = await executeContentCommand(
      'workbench.content.resolve',
      { resourceId, providerKey: 'files' },
      host,
    );
    expect(host.api.resolve).toHaveBeenCalledWith(host.scope, {
      resourceId,
      providerKey: 'files',
    });
    expect(result).toEqual({
      success: true,
      navigation: {
        target: 'workbench.view',
        viewKey: 'markdown.editor',
        selectionId: resourceId,
        parameters: { contentProvider: 'files' },
      },
    });
    expect(save).not.toHaveBeenCalled();
    expect(host.close).not.toHaveBeenCalled();
  });
  it('never forwards removed/unsupported commands and rejects invalid resource payloads', async () => {
    const host = setup();
    expect(
      await executeContentCommand(
        'workbench.content.open',
        { resourceId },
        host,
      ),
    ).toEqual({ success: false, code: 'unsupported' });
    expect(
      await executeContentCommand(
        'workbench.content.resolve',
        { resourceId: '../secret' },
        host,
      ),
    ).toEqual({ success: false, code: 'invalid_payload' });
    expect(host.api.resolve).not.toHaveBeenCalled();
  });
  it('does not return authorized results after a scope switch', async () => {
    const host = setup();
    vi.mocked(host.api.resolve).mockImplementation(async () => {
      host.isCurrent = () => false;
      return { viewKey: 'editor' };
    });
    expect(
      await executeContentCommand(
        'workbench.content.resolve',
        { resourceId },
        host,
      ),
    ).toEqual({ success: false, code: 'stale_context' });
  });
  it('keeps a failed-save tab open', async () => {
    const host = setup();
    host.editors.register('frame', {
      tabKey: 'spaces',
      dirty: true,
      prepare: async () => false,
    });
    expect(
      await executeContentCommand('workbench.content.close', {}, host),
    ).toEqual({ success: false, code: 'unsaved_changes' });
    expect(host.close).not.toHaveBeenCalled();
  });
  it('uses the authorized resolved provider when creating a public link', async () => {
    const host = setup();
    await executeContentCommand(
      'workbench.content.copyLink',
      { resourceId },
      host,
    );
    const copied = vi.mocked(host.copy).mock.calls[0][0];
    expect(
      JSON.parse(new URL(copied).searchParams.get('viewParameters')!),
    ).toEqual({ contentProvider: 'files' });
  });
  it('preserves provider and anchor in a public project link, omitting private thread and secrets', () => {
    const url = new URL(
      resourceLink(
        'https://example.test/p/{projectId}?secret=private#chat',
        { assistantId: 'a', projectId: 'p' },
        { resourceId, providerKey: 'files', blockId: 'block' },
        'editor',
      ),
    );
    expect(url.pathname).toBe('/p/p');
    expect(url.searchParams.has('secret')).toBe(false);
    expect(JSON.parse(url.searchParams.get('viewParameters')!)).toEqual({
      contentProvider: 'files',
      blockId: 'block',
    });
  });
});
