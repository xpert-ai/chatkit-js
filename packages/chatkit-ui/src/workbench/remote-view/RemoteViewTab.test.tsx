import * as React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { EditorLifecycleContext } from '../editors/context';
import { EditorLifecycle } from '../editors/editor-lifecycle';
import { RemoteEditor } from '../editors/remote-editor';
import { RemoteViewTab } from './RemoteViewTab';

afterEach(cleanup);
const view: XpertExtensionViewManifest = {
  key: 'markdown',
  title: { en_US: 'Markdown', zh_Hans: 'Markdown 文档' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  source: { provider: 'markdown' },
  dataSource: { mode: 'platform' },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'markdown' },
    dataSource: { mode: 'platform' },
  },
};

describe('remote editor tab presentation', () => {
  it('shows the document name and localized unsaved marker, keeping close available', () => {
    const editors = new EditorLifecycle();
    const remote = new RemoteEditor(
      editors,
      'frame',
      view.key,
      'doc',
      () => {},
    );
    const close = vi.fn();
    render(
      <EditorLifecycleContext.Provider value={editors}>
        <RemoteViewTab
          view={view}
          resourceId="doc"
          locale="en-US"
          selected
          onSelect={vi.fn()}
          onClose={close}
        />
      </EditorLifecycleContext.Provider>,
    );
    expect(screen.getByRole('tab', { name: 'Markdown' })).toBeInTheDocument();
    const title =
      'A long document title that must remain available in full on hover';
    act(() => {
      remote.status('doc', true, title);
    });
    expect(screen.getByRole('tab')).toHaveAttribute('title', title);
    expect(screen.getByText(title)).toHaveClass('truncate');
    expect(screen.getByRole('img', { name: 'Unsaved changes' })).toHaveClass(
      'bg-current',
      'shrink-0',
    );
    fireEvent.click(
      screen.getByRole('button', { name: `Close views: ${title}` }),
    );
    expect(close).toHaveBeenCalledOnce();
    act(() => {
      remote.status('doc', false, 'Renamed document');
    });
    expect(
      screen.getByRole('tab', { name: 'Renamed document' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
    act(() => remote.dispose());
    expect(screen.getByRole('tab', { name: 'Markdown' })).toBeInTheDocument();
  });

  it('never reuses a previous resource or Workbench title and dirty state', () => {
    const editors = new EditorLifecycle();
    const remote = new RemoteEditor(
      editors,
      'frame',
      view.key,
      'doc',
      () => {},
    );
    remote.status('doc', true, 'Original document');
    const tab = (resourceId: string, context = editors) => (
      <EditorLifecycleContext.Provider value={context}>
        <RemoteViewTab
          view={view}
          resourceId={resourceId}
          selected={false}
          onSelect={vi.fn()}
        />
      </EditorLifecycleContext.Provider>
    );
    const rendered = render(tab('doc'));
    expect(screen.getByRole('tab')).toHaveAttribute(
      'title',
      'Original document',
    );
    rendered.rerender(tab('other'));
    expect(screen.getByRole('tab', { name: 'Markdown' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rendered.rerender(tab('doc', new EditorLifecycle()));
    expect(screen.getByRole('tab', { name: 'Markdown' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
