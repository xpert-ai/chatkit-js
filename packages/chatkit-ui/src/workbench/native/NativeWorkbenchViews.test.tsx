import * as React from 'react';
import { Client } from '@xpert-ai/xpert-sdk';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../../i18n';
import { NativeWorkbenchContent } from './NativeWorkbenchViews';
import type { NativeTab } from './useNativeWorkbench';

vi.mock('./files/WorkspaceFiles', () => ({
  WorkspaceFiles: () => <input aria-label="File draft" />,
  fileName: () => 'File',
}));
vi.mock('./files/WorkspaceFileEditor', () => ({
  WorkspaceFileEditor: () => null,
}));
vi.mock('./terminal/WorkbenchTerminal', () => {
  throw new TypeError('Failed to fetch dynamically imported module');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLanguage('en-US');
});

describe('native view loading errors', () => {
  it('shows Computer guidance without mounting a terminal or offering a reconnect', () => {
    const client = new Client({ apiUrl: 'https://example.test/api/ai' });
    const connect = vi.spyOn(client.workbench, 'connectTerminal');
    render(
      <NativeWorkbenchContent
        tabs={[{ kind: 'terminal', key: 'terminal' }]}
        activeKey="terminal"
        visible
        client={client}
        scope={null}
        conversationId="conversation-1"
        register={vi.fn()}
        onOpenFile={vi.fn()}
        revision={0}
        onSaved={vi.fn()}
        terminalUnavailable="computer_desktop_required"
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'use its desktop terminal',
    );
    expect(
      screen.queryByRole('button', { name: 'Reconnect' }),
    ).not.toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
  });
  it.each([
    ['en-US', 'This view could not be opened.', 'Reload chat interface'],
    ['zh-CN', '无法打开此视图。', '刷新聊天界面'],
  ])(
    'isolates a rejected Terminal import in %s',
    async (locale, title, reload) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      setLanguage(locale);
      const client = new Client({ apiUrl: 'https://example.test/api/ai' });
      const connect = vi.spyOn(client.workbench, 'connectTerminal');
      const props = {
        client,
        visible: true,
        scope: null,
        conversationId: 'conversation-1',
        register: vi.fn(),
        onOpenFile: vi.fn(),
        revision: 0,
        onSaved: vi.fn(),
      };
      const files: NativeTab = { kind: 'files', key: 'files' };
      const terminal: NativeTab = { kind: 'terminal', key: 'terminal' };
      const tree = (tabs: NativeTab[], activeKey: string) => (
        <>
          <input aria-label="Chat draft" />
          <NativeWorkbenchContent
            {...props}
            tabs={tabs}
            activeKey={activeKey}
          />
        </>
      );
      const view = render(tree([files], 'files'));
      const chatDraft = screen.getByLabelText('Chat draft');
      const fileDraft = screen.getByLabelText('File draft');
      fireEvent.change(chatDraft, { target: { value: 'Unsent message' } });
      fireEvent.change(fileDraft, { target: { value: 'Unsaved edit' } });

      view.rerender(tree([files, terminal], 'terminal'));
      expect(await screen.findByRole('alert')).toHaveTextContent(title);
      expect(screen.getByRole('button', { name: reload })).toBeEnabled();
      expect(connect).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Chat draft')).toBe(chatDraft);
      expect(chatDraft).toHaveValue('Unsent message');

      view.rerender(tree([files, terminal], 'files'));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByLabelText('File draft')).toBe(fileDraft);
      expect(fileDraft).toHaveValue('Unsaved edit');
      fireEvent.change(fileDraft, { target: { value: 'Continue editing' } });
      expect(fileDraft).toHaveValue('Continue editing');
    },
  );
});
