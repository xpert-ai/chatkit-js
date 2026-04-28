import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import mermaid from 'mermaid';
import { describe, beforeEach, expect, it, vi } from 'vitest';

vi.mock('./syntax-highlighter', () => ({
  SyntaxHighlighter: ({ children }: { children: string }) => (
    <pre>{children}</pre>
  ),
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (id: string, code: string) => ({
      svg: `<svg xmlns="http://www.w3.org/2000/svg" data-render-id="${id}"><g class="node default"><rect width="100" height="40"></rect><text>${code}</text></g></svg>`,
    })),
  },
}));

import { setLanguage } from '../../i18n';
import { ThemeProvider } from '../../providers/Theme';
import { MarkdownText } from './markdown-text';

type MermaidModule = {
  initialize: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
};

const mermaidMock = mermaid as unknown as MermaidModule;
const writeTextMock = vi.fn<() => Promise<void>>();
let downloadedBlob: Blob | null = null;
let clickedAnchor: HTMLAnchorElement | null = null;
const createObjectURLMock = vi.fn((blob: Blob) => {
  downloadedBlob = blob;
  return 'blob:plan-markdown';
});
const revokeObjectURLMock = vi.fn();
const anchorClickMock = vi
  .spyOn(HTMLAnchorElement.prototype, 'click')
  .mockImplementation(() => {
    clickedAnchor = document.querySelector('a[download="plan.md"]');
  });

function readBlobText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function renderMarkdown(
  markdown: string,
  theme: ChatKitTheme = { colorScheme: 'light' },
) {
  return render(
    <ThemeProvider theme={theme}>
      <MarkdownText>{markdown}</MarkdownText>
    </ThemeProvider>,
  );
}

describe('MarkdownText', () => {
  beforeEach(() => {
    setLanguage('en-US');
    writeTextMock.mockReset();
    writeTextMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    downloadedBlob = null;
    clickedAnchor = null;
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    anchorClickMock.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURLMock,
    });
    mermaidMock.initialize.mockClear();
    mermaidMock.render.mockClear();
    mermaidMock.render.mockImplementation(async (id: string, code: string) => ({
      svg: `<svg xmlns="http://www.w3.org/2000/svg" data-render-id="${id}"><g class="node default"><rect width="100" height="40"></rect><text>${code}</text></g></svg>`,
    }));
  });

  it('keeps non-mermaid fenced code blocks on the regular code path', () => {
    const { container } = renderMarkdown('```ts\nconst answer = 42;\n```');

    expect(container).toHaveTextContent('const answer = 42;');
    expect(screen.queryByText('Mermaid')).not.toBeInTheDocument();
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });

  it('renders proposed_plan tags as a markdown plan card', () => {
    const { container } = renderMarkdown(
      [
        'Intro',
        '',
        '<proposed_plan>',
        '# Plan',
        '',
        '- Build it',
        '',
        '```ts',
        'const answer = 42;',
        '```',
        '</proposed_plan>',
        '',
        'Done',
      ].join('\n'),
    );
    const card = container.querySelector('[data-slot="markdown-plan-card"]');

    expect(card).not.toBeNull();
    expect(card).toHaveClass('rounded-lg', 'border', 'bg-muted/25');
    expect(card).toHaveTextContent('Plan');
    expect(card).toHaveTextContent('Build it');
    expect(card).toHaveTextContent('const answer = 42;');
    expect(card?.querySelector('h1')).toHaveTextContent('Plan');
    expect(card?.querySelector('li')).toHaveTextContent('Build it');
    expect(
      screen.getByRole('button', { name: 'Download Markdown' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Copy' }).length,
    ).toBeGreaterThan(0);
    expect(container).not.toHaveTextContent('<proposed_plan>');
    expect(container).not.toHaveTextContent('</proposed_plan>');
  });

  it('copies and downloads plan markdown content', async () => {
    renderMarkdown(
      ['<proposed_plan>', '# Plan', '', '- Ship it', '</proposed_plan>'].join(
        '\n',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() =>
      expect(writeTextMock).toHaveBeenCalledWith('# Plan\n\n- Ship it'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download Markdown' }));

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(downloadedBlob).not.toBeNull();
    if (!downloadedBlob) {
      throw new Error('Expected markdown download blob');
    }
    await expect(readBlobText(downloadedBlob)).resolves.toBe(
      '# Plan\n\n- Ship it\n',
    );
    expect(anchorClickMock).toHaveBeenCalledTimes(1);
    expect(clickedAnchor?.download).toBe('plan.md');
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:plan-markdown');
  });

  it('unwraps legacy markdown fences inside proposed_plan tags', () => {
    const { container } = renderMarkdown(
      [
        '<proposed_plan>',
        '```markdown',
        '# Legacy Plan',
        '',
        '- Keep rendering',
        '```',
        '</proposed_plan>',
      ].join('\n'),
    );
    const card = container.querySelector('[data-slot="markdown-plan-card"]');

    expect(card).not.toBeNull();
    expect(card?.querySelector('h1')).toHaveTextContent('Legacy Plan');
    expect(card?.querySelector('pre')).toBeNull();
    expect(screen.queryByText('markdown')).not.toBeInTheDocument();
  });

  it('does not split proposed_plan tags inside regular fenced code blocks', () => {
    const { container } = renderMarkdown(
      [
        '```txt',
        '<proposed_plan>',
        '# Not a card',
        '</proposed_plan>',
        '```',
      ].join('\n'),
    );

    expect(
      container.querySelector('[data-slot="markdown-plan-card"]'),
    ).toBeNull();
    expect(container).toHaveTextContent('<proposed_plan>');
    expect(container).toHaveTextContent('</proposed_plan>');
  });

  it('renders mermaid fenced code blocks as diagrams', async () => {
    const { container } = renderMarkdown('```mermaid\ngraph TD; A-->B;\n```');

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    expect(screen.getByText('Mermaid')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Download SVG' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open full screen' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Copy' }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="mermaid-diagram"] svg'),
    ).not.toBeNull();
    expect(mermaidMock.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({
        theme: 'base',
        securityLevel: 'strict',
        secure: expect.arrayContaining(['theme', 'themeVariables']),
      }),
    );
    expect(
      container
        .querySelector('[data-slot="mermaid-block"]')
        ?.closest('.bg-black'),
    ).toBeNull();
  });

  it('switches to the code tab and shows the mermaid source', async () => {
    renderMarkdown('```mermaid\ngraph TD; A-->B;\n```');

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('tab', { name: 'Code' }));

    expect(screen.getByText('graph TD; A-->B;')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Download SVG' }),
    ).not.toBeInTheDocument();
  });

  it('copies the mermaid source from the code tab', async () => {
    renderMarkdown('```mermaid\ngraph TD; A-->B;\n```');

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('tab', { name: 'Code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() =>
      expect(writeTextMock).toHaveBeenCalledWith('graph TD; A-->B;'),
    );
  });

  it('strips diagram-level mermaid config so host theme stays in control', async () => {
    renderMarkdown(`\`\`\`mermaid
---
config:
  theme: dark
---
%%{init: { "theme": "dark", "themeVariables": { "mainBkg": "#000000", "nodeBorder": "#000000" } }}%%
graph TD; A-->B;
\`\`\``);

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    expect(mermaidMock.render).toHaveBeenLastCalledWith(
      expect.any(String),
      'graph TD; A-->B;',
      expect.any(HTMLDivElement),
    );
  });

  it('falls back to the original mermaid source when rendering fails', async () => {
    mermaidMock.render.mockRejectedValueOnce(new Error('boom'));

    renderMarkdown('```mermaid\ngraph TD; A-->B;\n```');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to render diagram',
    );
    expect(
      screen.getByRole('tab', { name: 'Code', selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByText('graph TD; A-->B;')).toBeInTheDocument();
  });

  it('re-renders when the mermaid source changes', async () => {
    const { rerender } = render(
      <ThemeProvider theme={{ colorScheme: 'light' }}>
        <MarkdownText>{'```mermaid\ngraph TD; A-->B;\n```'}</MarkdownText>
      </ThemeProvider>,
    );

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    rerender(
      <ThemeProvider theme={{ colorScheme: 'light' }}>
        <MarkdownText>{'```mermaid\ngraph TD; B-->C;\n```'}</MarkdownText>
      </ThemeProvider>,
    );

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(2));
    expect(mermaidMock.render).toHaveBeenLastCalledWith(
      expect.any(String),
      'graph TD; B-->C;',
      expect.any(HTMLDivElement),
    );
  });

  it('re-renders when the theme changes', async () => {
    const { rerender } = render(
      <ThemeProvider theme={{ colorScheme: 'light' }}>
        <MarkdownText>{'```mermaid\ngraph TD; A-->B;\n```'}</MarkdownText>
      </ThemeProvider>,
    );

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    rerender(
      <ThemeProvider theme={{ colorScheme: 'dark' }}>
        <MarkdownText>{'```mermaid\ngraph TD; A-->B;\n```'}</MarkdownText>
      </ThemeProvider>,
    );

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(2));
    expect(mermaidMock.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({
        securityLevel: 'strict',
        theme: 'base',
      }),
    );
  });

  it('renders markdown tables in a horizontal scroll container and hooks into theme density', () => {
    const { container } = renderMarkdown(
      `| 配置键 | 类型 |
| --- | --- |
| \`room_keyword_regex_list\` | \`list[str]\` |`,
      {
        colorScheme: 'light',
        density: 'compact',
      },
    );

    const themedRoot = container.querySelector('[data-density="compact"]');
    const tableContainer = container.querySelector(
      '[data-slot="markdown-table-container"]',
    );
    const table = tableContainer?.querySelector('table');
    const headerCell = screen.getByRole('columnheader', { name: '配置键' });
    const bodyCell = screen.getByRole('cell', {
      name: 'room_keyword_regex_list',
    });
    const inlineCode = screen.getByText('room_keyword_regex_list');

    expect(themedRoot).not.toBeNull();
    expect(tableContainer).not.toBeNull();
    expect(table).not.toBeNull();
    expect(tableContainer).toHaveClass('overflow-x-auto');
    expect(tableContainer).toHaveClass('max-w-full');
    expect(table).toHaveClass('w-max');
    expect(table).toHaveClass('min-w-full');
    expect(themedRoot).toHaveStyle('--density-padding: 0.5rem');
    expect(themedRoot).toHaveStyle('--density-gap: 0.25rem');
    expect(themedRoot).toHaveStyle('--density-spacing: 0.75');
    expect(table).toHaveStyle({
      lineHeight: 'max(1.375rem, calc(1.5rem * var(--density-spacing, 1)))',
    });
    expect(headerCell).toHaveStyle({
      minWidth: 'max(7rem, calc(8rem * var(--density-spacing, 1)))',
      paddingInline: 'calc(var(--density-padding, 1rem) * 1.25)',
      paddingBlock: 'max(0.5rem, calc(var(--density-padding, 1rem) * 0.75))',
    });
    expect(bodyCell).toHaveStyle({
      minWidth: 'max(7rem, calc(8rem * var(--density-spacing, 1)))',
      paddingInline: 'calc(var(--density-padding, 1rem) * 1.25)',
      paddingBlock: 'max(0.5rem, calc(var(--density-padding, 1rem) * 0.75))',
    });
    expect(inlineCode).toHaveClass('whitespace-pre-wrap');
    expect(inlineCode).toHaveClass('[overflow-wrap:anywhere]');
    expect(inlineCode).not.toHaveClass('break-all');
    expect(inlineCode).toHaveStyle({
      paddingInline: 'max(0.25rem, calc(var(--density-gap, 0.5rem) * 0.75))',
      paddingBlock: 'max(0.125rem, calc(var(--density-gap, 0.5rem) * 0.5))',
    });
  });
});
