import * as React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createToolComponent, render } from './ai.test-fixture';
import { ToolComponentGroup } from './tool-component-group';

const call = (status: 'running' | 'success' | 'fail', output?: unknown) =>
  createToolComponent('validate', {
    tool: 'dashboard_preview_binding',
    title: 'Validate sales data',
    toolPresentation: 'redacted',
    status,
    input: { region: 'East' },
    output,
  });

describe('tool timeline disclosure and evidence', () => {
  it.each([
    [
      'path',
      '/Users/user/project/.xpert/skills/xpert/live-dashboard/SKILL.md',
      'live-dashboard/SKILL.md',
    ],
    ['file_path', 'reports/sales.csv', 'reports/sales.csv'],
    ['dir_path', '.', '.'],
    ['path', 'C:\\workspace\\skills\\research\\SKILL.md', 'research/SKILL.md'],
  ])(
    'shows a concise %s while retaining full input in details',
    (key, path, summary) => {
      const input = { [key]: path, limit: 20 };
      const item = createToolComponent('path-preview', {
        title: 'Read source',
        presentation: { version: 1, target: summary },
        toolPresentation: 'redacted',
        input: JSON.stringify(input),
        output: 'Read successfully',
      });
      render(<ToolComponentGroup items={[item]} hasFollowingItem={false} />);
      const row = screen.getByRole('button', { name: /Read source/ });
      expect(row.querySelector('code')?.textContent).toBe(summary);
      fireEvent.click(row);
      const details = screen.getByRole('region', { name: 'Tool call details' });
      expect(details).toHaveTextContent(JSON.stringify(path));
      expect(details).toHaveTextContent('limit:');
      expect(details).toHaveTextContent('20');
    },
  );

  it('does not invent an input target or expose raw parameters on the row', () => {
    const item = createToolComponent('preview', {
      title: 'Read source',
      toolPresentation: 'redacted',
      input: {
        region: 'East',
        image: `data:image/png;base64,${'PRIVATE_IMAGE'.repeat(500)}`,
        note: 'x'.repeat(300),
      },
    });
    render(<ToolComponentGroup items={[item]} hasFollowingItem={false} />);
    const row = screen.getByRole('button', { name: /Read source/ });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(row).not.toHaveTextContent('East');
    expect(row).not.toHaveTextContent('PRIVATE_IMAGE');
    expect(row.querySelector('code')).toBeNull();
  });

  it('keeps a manual group choice when following prose arrives', () => {
    const items = [call('success')];
    const { rerender } = render(
      <ToolComponentGroup items={items} hasFollowingItem={false} />,
    );
    const group = screen.getByRole('button', { name: /Processed/ });
    fireEvent.click(group);
    fireEvent.click(group);
    rerender(<ToolComponentGroup items={items} hasFollowingItem />);
    expect(group).toHaveAttribute('aria-expanded', 'true');
  });

  it('retains the group when the reader opened a call before following prose arrived', () => {
    const items = [call('success', 'Verified East: 12000')];
    const { rerender } = render(
      <ToolComponentGroup items={items} hasFollowingItem={false} />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Validate sales data/ }),
    );
    rerender(<ToolComponentGroup items={items} hasFollowingItem />);
    expect(screen.getByRole('button', { name: /Processed/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Verified East: 12000')).toBeVisible();
  });

  it('keeps a manual row collapse during streamed output and group toggles', () => {
    const { rerender } = render(
      <ToolComponentGroup
        items={[call('running', 'First row')]}
        hasFollowingItem={false}
        isThreadRunning
      />,
    );
    const row = screen.getByRole('button', { name: /Validate sales data/ });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(row);
    fireEvent.click(row);
    rerender(
      <ToolComponentGroup
        items={[call('running', 'Second row')]}
        hasFollowingItem={false}
        isThreadRunning
      />,
    );
    expect(row).toHaveAttribute('aria-expanded', 'false');
    const group = screen.getByRole('button', {
      name: /Tool calls.*1 call.*Processing/,
    });
    fireEvent.click(group);
    fireEvent.click(group);
    expect(
      screen.getByRole('button', { name: /Validate sales data/ }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps a manually opened row visible when streaming finishes', () => {
    const { rerender } = render(
      <ToolComponentGroup
        items={[call('running')]}
        hasFollowingItem={false}
        isThreadRunning
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Validate sales data/ }),
    );
    rerender(
      <ToolComponentGroup
        items={[call('success', '12000')]}
        hasFollowingItem={false}
        isThreadRunning={false}
      />,
    );
    expect(screen.getByText('12000')).toBeVisible();
  });

  it('reports partial failure even when the user collapses a running group', () => {
    const items = [
      call('running'),
      createToolComponent('failed', {
        status: 'fail',
        error: 'Invalid binding',
      }),
    ];
    render(
      <ToolComponentGroup items={items} hasFollowingItem isThreadRunning />,
    );
    expect(screen.getByText('Invalid binding')).toBeVisible();
    const group = screen.getByRole('button', { name: /Tool calls.*1 failed/ });
    fireEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('1 failed')).toBeVisible();
    expect(screen.getByText('Invalid binding')).not.toBeVisible();
  });

  it('distinguishes pending, empty and unrecorded output', () => {
    const { rerender } = render(
      <ToolComponentGroup
        items={[call('running')]}
        hasFollowingItem={false}
        isThreadRunning
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Validate sales data/ }),
    );
    expect(screen.getByText('Waiting for tool output…')).toBeVisible();
    rerender(
      <ToolComponentGroup
        items={[call('success', '')]}
        hasFollowingItem={false}
        isThreadRunning={false}
      />,
    );
    expect(screen.getByText('Empty content')).toBeVisible();
    rerender(
      <ToolComponentGroup
        items={[call('success')]}
        hasFollowingItem={false}
        isThreadRunning={false}
      />,
    );
    expect(
      screen.getByText('Output was not recorded for this call.'),
    ).toBeVisible();
  });

  it.each([null, false, 0])(
    'keeps the recorded output %j distinct from missing output',
    (output) => {
      render(
        <ToolComponentGroup
          items={[call('success', output)]}
          hasFollowingItem={false}
        />,
      );
      fireEvent.click(
        screen.getByRole('button', { name: /Validate sales data/ }),
      );
      expect(screen.getByText(String(output))).toBeVisible();
      expect(
        screen.queryByText('Output was not recorded for this call.'),
      ).not.toBeInTheDocument();
    },
  );

  it('allows inspecting legacy calls without payloads and labels the missing evidence', () => {
    render(
      <ToolComponentGroup
        items={[createToolComponent('legacy')]}
        hasFollowingItem={false}
      />,
    );
    const row = screen.getByRole('button', { name: /^Tool call Completed/ });
    expect(row).toBeEnabled();
    fireEvent.click(row);
    expect(
      screen.getByText('Input was not recorded for this call.'),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Tool call details' }),
    ).toHaveAttribute('tabindex', '0');
  });

  it('preserves paused steps rather than labeling them completed or failed', () => {
    render(
      <ToolComponentGroup
        items={[call('running')]}
        hasFollowingItem={false}
        isThreadRunning={false}
        isThreadPaused
      />,
    );
    expect(
      screen.getByRole('button', { name: /Tool calls.*1 call.*Paused/ }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: /Validate sales data/ }),
    );
    expect(screen.getByText('Paused; waiting to resume.')).toBeVisible();
  });
});
