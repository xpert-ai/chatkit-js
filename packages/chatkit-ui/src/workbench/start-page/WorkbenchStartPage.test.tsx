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
  it('opens native tools and reserves More tools for future integrations', () => {
    const onOpenTool = vi.fn();
    setup({ onOpenTool, conversationReady: true });
    for (const [name, tool] of [
      ['Files / folders', 'files'],
      ['Terminal', 'terminal'],
      ['Side chat', 'side-chat'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(onOpenTool).toHaveBeenLastCalledWith(tool);
    }
    fireEvent.click(screen.getByRole('button', { name: 'More tools' }));
    expect(screen.getByRole('status')).toHaveTextContent(/MCP/);
  });

  it('recommends dynamic views and closed fixed views, and opens recent workspace files', () => {
    const onOpenFile = vi.fn();
    const file = { filePath: 'reports/budget.xlsx' };
    setup({
      openedViewKeys: ['files', 'studio'],
      recentFiles: [{ file, openedAt: Date.now() }],
      onOpenFile,
    });
    const recommended = within(
      screen.getByRole('region', { name: 'Recommended' }),
    );
    expect(
      recommended.queryByRole('button', { name: /Files/ }),
    ).not.toBeInTheDocument();
    expect(recommended.getByRole('button', { name: /Studio/ })).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: /reports\/budget.xlsx/ }),
    );
    expect(onOpenFile).toHaveBeenCalledWith(file);
    expect(screen.getByRole('button', { name: 'Terminal' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Side chat' })).toBeDisabled();
  });

  it('orders tools, dynamic views and recent items and opens the original file evidence', () => {
    const props = setup();
    expect(
      screen.getAllByRole('heading').map((item) => item.textContent),
    ).toEqual(['Common tools', 'Recommended', 'Recently opened']);
    expect(
      within(screen.getByRole('region', { name: 'Common tools' })).getByRole(
        'button',
        { name: 'Files / folders' },
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Recommended' })).getByRole(
        'button',
        { name: /Studio/ },
      ),
    );
    expect(props.onSelectView).toHaveBeenCalledWith('studio');
    fireEvent.click(screen.getByRole('button', { name: /Report.pdf/ }));
    expect(props.onOpenPreview).toHaveBeenCalledWith(preview);
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
