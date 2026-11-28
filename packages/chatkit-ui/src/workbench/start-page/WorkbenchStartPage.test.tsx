import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../providers/Theme';
import { WorkbenchStartPage } from './WorkbenchStartPage';
import { parsePreview } from '../client-command-payload';

const files: XpertExtensionViewManifest = {
  key: 'files',
  title: { en_US: 'Files' },
  description: { en_US: 'Browse project documents' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  source: { provider: 'tools' },
  workbench: { openMode: 'auto' },
  dataSource: { mode: 'platform' },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'files' },
    dataSource: { mode: 'platform' },
  },
};
const studio: XpertExtensionViewManifest = {
  ...files,
  key: 'studio',
  title: { en_US: 'Studio' },
  description: { en_US: 'Create videos' },
  workbench: { openMode: 'on-demand' as const },
};
const parsedPreview = parsePreview(
  'file',
  {
    name: 'Report.pdf',
    url: 'https://example.test/report.pdf',
    evidence: { text: 'Original evidence', locator: { page: 2 } },
  },
  '/api/ai',
);
if (!parsedPreview) throw new Error('Invalid preview fixture');
const preview = parsedPreview;

function setup(
  overrides: Partial<React.ComponentProps<typeof WorkbenchStartPage>> = {},
) {
  const props = {
    views: [files, studio],
    recent: [{ preview, openedAt: Date.now() }],
    locale: 'en-US',
    apiUrl: '/api/ai',
    loading: false,
    error: null,
    onReload: vi.fn(),
    onOpenTool: vi.fn(),
    onSelectView: vi.fn(),
    onOpenPreview: vi.fn(),
    ...overrides,
  };
  render(
    <ThemeProvider>
      <WorkbenchStartPage {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe('WorkbenchStartPage', () => {
  it('keeps a new start page clear when there is no website or query history', () => {
    setup({ recent: [] });
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Open' })).toBeVisible();
  });

  it('shows recent websites only in the search dropdown and preserves file shortcuts', () => {
    const website = parsePreview(
      'browser',
      { url: 'https://example.test/', title: 'Example website' },
      '/api/ai',
    );
    if (!website) throw new Error('Invalid website fixture');
    const props = setup({
      recent: [
        { preview: website, openedAt: Date.now() },
        { preview, openedAt: 1 },
      ],
    });
    expect(
      screen.queryByRole('button', { name: /Example website/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Report.pdf/ })).toBeVisible();
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: /Example website/ }));
    expect(props.onOpenPreview).toHaveBeenCalledWith(website);
  });

  it('disables a terminal known to be unavailable while keeping other tools usable', () => {
    setup({
      conversationReady: true,
      terminalUnavailable: 'computer_desktop_required',
    });
    expect(
      screen.getByRole('button', {
        name: /Terminal.*This conversation uses Computer/,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Files / folders' }),
    ).toBeEnabled();
  });
  it('opens native tools and exposes all authorized views in the customizable menu', () => {
    const onOpenTool = vi.fn();
    const props = setup({ onOpenTool, conversationReady: true });
    for (const [name, tool] of [
      ['Files / folders', 'files'],
      ['Terminal', 'terminal'],
      ['Side chat', 'side-chat'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(onOpenTool).toHaveBeenLastCalledWith(tool);
    }
    fireEvent.click(screen.getByRole('button', { name: 'More tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin Studio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    expect(
      screen.getByRole('button', { name: 'Move Studio up' }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move Studio up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Studio',
      }),
    );
    expect(props.onSelectView).toHaveBeenCalledWith('studio');
  });

  it('opens recent workspace files and preserves the original file evidence', () => {
    const onOpenFile = vi.fn();
    const file = { filePath: 'reports/budget.xlsx' };
    const props = setup({
      recentFiles: [{ file, openedAt: Date.now() }],
      onOpenFile,
    });
    fireEvent.click(
      screen.getByRole('button', { name: /reports\/budget.xlsx/ }),
    );
    expect(onOpenFile).toHaveBeenCalledWith(file);
    fireEvent.click(screen.getByRole('button', { name: /Report.pdf/ }));
    expect(props.onOpenPreview).toHaveBeenCalledWith(preview);
    expect(
      screen.getAllByRole('heading').map((item) => item.textContent),
    ).toEqual(['Open', 'Recently opened']);
  });

  it('filters names and descriptions without navigating on a plain-text search', () => {
    const props = setup();
    const search = screen.getByRole('combobox');
    fireEvent.change(search, { target: { value: 'VIDEOS' } });
    expect(screen.getByRole('button', { name: /Studio/ })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Files' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Report.pdf/ }),
    ).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole('search'));
    expect(props.onOpenPreview).not.toHaveBeenCalled();
    fireEvent.change(search, { target: { value: 'report' } });
    expect(screen.getByRole('button', { name: /Report.pdf/ })).toBeVisible();
  });

  it('opens an HTTP(S) address and rejects local URLs and embedded credentials', () => {
    const props = setup();
    const search = screen.getByRole('combobox');
    for (const value of [
      'file:///etc/passwd',
      'https://user:password@example.test/',
    ]) {
      fireEvent.change(search, { target: { value } });
      fireEvent.submit(screen.getByRole('search'));
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Enter a valid HTTP or HTTPS URL',
      );
    }
    expect(props.onOpenPreview).not.toHaveBeenCalled();
    fireEvent.change(search, { target: { value: 'https://example.test/' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open website' }));
    expect(props.onOpenPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'browser',
        title: 'example.test',
        url: 'https://example.test/',
      }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows discovery failures with retry while retaining recent items', () => {
    const props = setup({ views: [], error: 'Views unavailable' });
    expect(screen.getByRole('alert')).toHaveTextContent('Views unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onReload).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: /Report.pdf/ })).toBeVisible();
  });
});
