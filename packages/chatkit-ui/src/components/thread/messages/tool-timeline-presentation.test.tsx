import * as React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createToolComponent,
  render,
  chatkitLanguage,
  writeTextMock,
} from './ai.test-fixture';
import { ToolComponentGroup } from './tool-component-group';
import { getToolGroupStatus } from './tool-group/status/group-status';
import { buildToolComponentRenderUnits } from './tool-group/grouping/render-units';
import { ThemeProvider } from '../../../providers/Theme';
import type {
  ToolActivity,
  ToolDetailReference,
  TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
const read = vi.hoisted(() => vi.fn());
vi.mock('../../../providers/Stream', async () => ({
  default: (await import('react')).createContext({
    client: { conversations: { getToolDetail: read } },
  }),
}));
const ref: ToolDetailReference = {
  conversationId: '10000000-0000-4000-8000-000000000001',
  executionId: '20000000-0000-4000-8000-000000000001',
  id: '30000000-0000-4000-8000-000000000001',
  toolCallId: 'call',
  phase: 'output',
  sha256: 'a'.repeat(64),
};
const activityCall = (
  id: string,
  activity?: ToolActivity,
): TMessageContentComponent =>
  createToolComponent(id, {
    title: `Operation ${id}`,
    presentation: { version: 1, activity },
  });
const longCall = createToolComponent('call', {
  tool: 'read_skill_file',
  title: 'Read skill file',
  toolPresentation: 'redacted',
  presentation: {
    version: 1,
    activity: { kind: 'skill', action: 'read' },
    target: 'live-dashboard/SKILL.md',
    output: {
      state: 'available',
      mode: 'summary',
      summary: 'File read',
      byteLength: 16390,
      truncated: true,
      format: 'text',
      detail: ref,
    },
  },
});
beforeEach(() => {
  read.mockReset();
});
describe('declared tool timeline semantics', () => {
  it.each([
    [
      [
        { kind: 'file', action: 'read' },
        { kind: 'file', action: 'read' },
      ],
      /Read files.*2 calls/,
    ],
    [
      [
        { kind: 'file', action: 'read' },
        { kind: 'file', action: 'write' },
      ],
      /File operations.*2 calls/,
    ],
    [
      [
        { kind: 'browser', action: 'navigate' },
        { kind: 'command', action: 'execute' },
      ],
      /Browser operations and Command execution.*2 calls/i,
    ],
    [
      [{ kind: 'file', action: 'read' }, undefined],
      /File operations and Other tools.*2 calls/i,
    ],
    [
      [
        { kind: 'skill', action: 'read' },
        { kind: 'data', action: 'query' },
        undefined,
      ],
      /Tool activity.*3 calls/i,
    ],
    [[undefined, undefined], /Tool calls.*2 calls/],
  ] as [Array<ToolActivity | undefined>, RegExp][])(
    'aggregates %j without title/name inference',
    (activities, label) => {
      render(
        <ToolComponentGroup
          items={activities.map((activity, i) =>
            activityCall(String(i), activity),
          )}
          hasFollowingItem={false}
        />,
      );
      expect(screen.getByRole('button', { name: label })).toBeVisible();
    },
  );
  it('deduplicates updates, preserves activity and separates execution boundaries', () => {
    const first = activityCall('same', { kind: 'file', action: 'read' });
    const update = activityCall('same', { kind: 'command', action: 'execute' });
    render(
      <ToolComponentGroup items={[first, update]} hasFollowingItem={false} />,
    );
    expect(
      screen.getByRole('button', { name: /Read files.*1 call/ }),
    ).toBeVisible();
    const units = buildToolComponentRenderUnits([
      { ...first, executionId: 'one' },
      { ...first, executionId: 'two' },
    ]);
    expect(units).toHaveLength(2);
  });
  it('localizes activities while keeping call counts distinct from resource counts', () => {
    chatkitLanguage.value = 'zh-CN';
    render(
      <ToolComponentGroup
        items={[
          activityCall('a', { kind: 'skill', action: 'read' }),
          activityCall('b', { kind: 'file', action: 'read' }),
        ]}
        hasFollowingItem={false}
      />,
    );
    expect(
      screen.getByRole('button', { name: /技能读取与文件操作.*2 次调用/ }),
    ).toBeVisible();
  });
  it('does not count one failed call as both success and failure', () => {
    const call = createToolComponent('failed', {
      status: 'success',
      error: 'nonzero exit',
    });
    expect(getToolGroupStatus([call], false)).toMatchObject({
      status: 'fail',
      failedCount: 1,
    });
  });
});
describe('lazy complete tool details', () => {
  it('does not expose withheld content through a different detail tab', async () => {
    const call = createToolComponent('withheld', {
      title: 'Read report',
      input: { path: 'report.json' },
      output: 'withheld content',
      presentation: {
        version: 1,
        output: { state: 'not-public', truncated: false, detail: ref },
      },
    });
    render(<ToolComponentGroup items={[call]} hasFollowingItem={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Read report/ }));
    expect(screen.queryByText('withheld content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View full content' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).queryByRole('tab', { name: 'Output' }),
    ).not.toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
  });

  it('cancels a pending detail read when Escape closes the dialog', async () => {
    read.mockImplementation(() => new Promise(() => {}));
    render(<ToolComponentGroup items={[longCall]} hasFollowingItem={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Read skill file/ }));
    const trigger = screen.getByRole('button', { name: 'View full content' });
    fireEvent.click(trigger);
    await screen.findByRole('dialog');
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    const signal = read.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(signal.aborted).toBe(true));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('shows a complete legacy JSON snapshot as a tree without parsing its partial preview', async () => {
    const full = JSON.stringify({
      schema: 'dataset',
      rows: [{ region: 'East', amount: 12000 }],
    });
    read.mockResolvedValue({
      content: full,
      format: 'text',
      offset: 0,
      nextOffset: null,
      totalCharacters: full.length,
      byteLength: full.length,
    });
    const call = createToolComponent('call', {
      title: 'Validate dataset',
      output: full.slice(0, 36),
      presentation: {
        version: 1,
        output: {
          state: 'available',
          format: 'text',
          truncated: true,
          detail: ref,
        },
      },
    });
    render(<ToolComponentGroup items={[call]} hasFollowingItem={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Validate dataset/ }));
    expect(screen.queryByRole('tab', { name: 'Tree' })).not.toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'View full content' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByRole('tab', { name: 'Tree' }),
    ).toBeVisible();
    expect(within(dialog).getByText('schema:')).toBeVisible();
    expect(within(dialog).getByText('"dataset"')).toBeVisible();
    fireEvent.click(
      within(dialog)
        .getAllByRole('button', { name: 'Copy full content' })
        .at(-1)!,
    );
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith(full));
  });
  it('fetches only on request, pages across Unicode, copies complete content and retries', async () => {
    const first = 'a'.repeat(16383),
      second = '🙂end';
    read.mockImplementation(async (_ref, options) => ({
      content: options.offset === 0 ? first : second,
      format: 'text',
      offset: options.offset,
      nextOffset: options.offset === 0 ? 16383 : null,
      totalCharacters: 16388,
      byteLength: 16390,
    }));
    render(<ToolComponentGroup items={[longCall]} hasFollowingItem={false} />);
    expect(read).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Read skill file/ }));
    expect(screen.getByText('File read')).toBeVisible();
    expect(read).not.toHaveBeenCalled();
    expect(screen.queryByText('read_skill_file')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View full content' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByText(first)).toBeVisible());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(within(dialog).getByText(second)).toBeVisible());
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Previous page' }),
    );
    await waitFor(() => expect(read.mock.lastCall?.[1].offset).toBe(0));
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Copy full content' }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Copy full content' }),
    );
    await waitFor(() =>
      expect(writeTextMock).toHaveBeenCalledWith(first + second),
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Close tool details' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'View full content' }),
      ).toHaveFocus(),
    );
    read.mockRejectedValueOnce(new Error('access revoked'));
    fireEvent.click(screen.getByRole('button', { name: 'View full content' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
  });
  it('propagates theme changes into the open portal', async () => {
    read.mockResolvedValue({
      content: 'safe',
      format: 'text',
      offset: 0,
      nextOffset: null,
      totalCharacters: 4,
      byteLength: 4,
    });
    const view = (dark: boolean) => (
      <ThemeProvider
        theme={{
          colorScheme: dark ? 'dark' : 'light',
          radius: dark ? 'sharp' : 'round',
          density: dark ? 'compact' : 'spacious',
        }}
      >
        <ToolComponentGroup items={[longCall]} hasFollowingItem={false} />
      </ThemeProvider>
    );
    const { rerender } = render(view(false));
    fireEvent.click(screen.getByRole('button', { name: /Read skill file/ }));
    fireEvent.click(screen.getByRole('button', { name: 'View full content' }));
    const dialog = await screen.findByRole('dialog');
    const before = dialog.getAttribute('style');
    rerender(view(true));
    expect(dialog.getAttribute('style')).not.toBe(before);
    expect(dialog.getAttribute('style')).toContain('--chat-panel-radius: 0');
  });
});
