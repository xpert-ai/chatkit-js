import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { WorkbenchViewRail } from './WorkbenchViewRail';

const view: XpertExtensionViewManifest = {
  key: 'documents',
  title: { en_US: 'Documents', zh_Hans: '文档' },
  description: { en_US: 'Browse project files', zh_Hans: '浏览项目文件' },
  icon: { type: 'emoji', value: '📂' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  source: { provider: 'documents' },
  dataSource: { mode: 'platform' },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'documents' },
    dataSource: { mode: 'platform' },
  },
};

describe('WorkbenchViewRail', () => {
  it('shows localized details on focus and uses the menu icon and label', async () => {
    const onSelect = vi.fn();
    render(
      <WorkbenchViewRail
        views={[
          {
            ...view,
            workbench: {
              menu: {
                label: { en_US: 'Library', zh_Hans: '资料中心' },
                icon: { type: 'emoji', value: '📚' },
              },
            },
          },
        ]}
        locale="zh-Hans"
        onSelect={onSelect}
      />,
    );
    const button = screen.getByRole('button', { name: '资料中心' });
    expect(within(button).getByText('📚')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(button);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('资料中心');
    expect(tooltip).toHaveTextContent('浏览项目文件');
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith('documents');
  });

  it('uses a fallback icon and falls back to English when the translation is missing', async () => {
    render(
      <WorkbenchViewRail
        views={[
          {
            ...view,
            title: { en_US: 'Files' },
            description: undefined,
            icon: undefined,
          },
        ]}
        locale="zh-Hans"
        onSelect={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: 'Files' });
    expect(button.querySelector('svg')).toBeInTheDocument();
    fireEvent.pointerMove(button, { pointerType: 'mouse' });
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Files');
  });
});
