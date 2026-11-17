import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type TMessageContentComponent,
  type TMessageComponentStep,
} from '@xpert-ai/chatkit-types';
import { AssistantMessage } from './ai';
import { ThemeProvider } from '../../../providers/Theme';
import {
  WorkbenchContext,
  disabledWorkbenchContext,
} from '../../../workbench/context';
import type { AssistantMessageWithAgentRuns } from '../../../lib/agent-run-render-tree';

type ToolEvent = TMessageContentComponent<
  Pick<TMessageComponentStep, 'tool' | 'title' | 'status' | 'error'> &
    Partial<
      Pick<
        TMessageComponentStep,
        'toolset' | 'icon' | 'input' | 'output' | 'toolPresentation'
      >
    >
>;

const delegate: ToolEvent = {
  id: 'delegate-call',
  type: 'component',
  executionId: 'root',
  data: {
    category: 'Tool',
    toolset: 'ExampleAgentProvider',
    tool: 'opaque-expert-slug',
    title: 'opaque-expert-slug',
    status: 'success',
  },
};
const prepare: ToolEvent = {
  id: 'prepare-call',
  type: 'component',
  executionId: 'root',
  data: {
    category: 'Tool',
    toolset: 'BidAssistantCoordinator',
    tool: 'bid_prepare_role_task',
    title: 'Prepare role task',
    status: 'success',
  },
};
const roleOutput: ToolEvent = {
  id: 'role-read',
  type: 'component',
  executionId: 'external',
  parentExecutionId: 'root',
  data: {
    category: 'Tool',
    toolset: 'Skills',
    tool: 'read_skill_file',
    title: 'Read role skill',
    status: 'success',
  },
};

function message(
  content = [prepare, delegate, roleOutput],
): AssistantMessageWithAgentRuns {
  return {
    id: 'reply',
    type: 'assistant',
    executionId: 'root',
    status: 'success',
    content,
    agentRuns: [
      {
        id: 'external',
        parentId: 'root',
        invocationKind: 'external_assistant',
        sourceToolCallId: 'delegate-call',
        xpertName: 'Outline specialist',
        status: 'success',
      },
    ],
  };
}

function view(value: AssistantMessageWithAgentRuns, open = vi.fn()) {
  return (
    <ThemeProvider>
      <WorkbenchContext.Provider
        value={{
          ...disabledWorkbenchContext,
          externalAssistantsEnabled: true,
          openExternalAssistant: open,
        }}
      >
        <AssistantMessage message={{ ...value, type: 'assistant' }} />
      </WorkbenchContext.Provider>
    </ThemeProvider>
  );
}

describe('external Assistant tool event presentation', () => {
  it.each(['bid_submit_role_task', 'sandbox_shell'])(
    'opens the redacted input and output of %s',
    (tool) => {
      const step: ToolEvent = {
        ...roleOutput,
        executionId: 'root',
        data: {
          category: 'Tool',
          tool,
          title: tool,
          status: 'success',
          toolPresentation: 'redacted',
          icon: { type: 'emoji', value: '📄' },
          input: { taskId: '•••5785' },
          output: { accepted: false, draftSaved: true },
        },
      };
      render(view({ ...message([step]), agentRuns: [] }));
      const row = screen.getByRole('button', { name: tool });
      expect(
        row.querySelector('[data-slot="tool-step-icon"]'),
      ).toHaveTextContent('📄');
      fireEvent.click(row);
      expect(row).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Input')).toBeVisible();
      expect(screen.getByText('Output')).toBeVisible();
      expect(screen.getByText(/•••5785/)).toBeVisible();
      expect(screen.getByText(/draftSaved/)).toBeVisible();
    },
  );

  it('shows the registered localized title, tool identifier and SVG for an undeclared call', () => {
    const step: ToolEvent = {
      ...roleOutput, executionId: 'root',
      data: { category: 'Tool', tool: 'lookup', title: '查询状态', status: 'success', toolPresentation: 'redacted',
        icon: { type: 'svg', value: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3"/></svg>' } },
    };
    render(view({ ...message([step]), agentRuns: [] }));
    const row = screen.getByRole('button', { name: /查询状态.*lookup/ });
    expect(row).toBeDisabled();
    const src = row.querySelector('img')?.getAttribute('src');
    expect(src).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(src!)).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('shows a failed preview with its receipt, public error and a local fallback icon', () => {
    const step: ToolEvent = {
      ...roleOutput,
      executionId: 'root',
      data: {
        category: 'Tool',
        tool: 'bid_submit_role_task',
        title: 'bid_submit_role_task',
        toolset: 'mcp',
        status: 'fail',
        toolPresentation: 'redacted',
        output: { draftSaved: true },
        error: 'FORM_INVALID',
      },
    };
    render(view({ ...message([step]), agentRuns: [] }));
    const row = screen.getByRole('button', { name: 'bid_submit_role_task' });
    const providerIcon = row.querySelector('img')!;
    expect(providerIcon).toHaveAttribute('src', '/api/xpert-toolset/builtin-provider/mcp/icon');
    fireEvent.error(providerIcon);
    expect(row.querySelector('[data-slot="tool-step-icon"]')).toHaveClass(
      'lucide-wrench',
    );
    fireEvent.click(row);
    expect(screen.getByText(/draftSaved/)).toBeVisible();
    expect(screen.getByText('FORM_INVALID')).toBeVisible();
  });

  it('renders a shadowless child and a named tool with no declared details', () => {
    const progress: ToolEvent = {
      ...roleOutput,
      data: {
        category: 'Tool',
        tool: 'lookup',
        title: 'Lookup',
        toolPresentation: 'redacted',
        status: 'fail',
      },
    };
    const value = message([progress]);
    render(
      view({
        ...value,
        agentRuns: [
          {
            id: 'external',
            parentId: 'root',
            title: 'Reviewer',
            status: 'success',
          },
        ],
      }),
    );

    const child = screen.getByRole('button', { name: /Reviewer/ });
    expect(child.parentElement).toHaveClass('rounded-chat-panel');
    expect(child.parentElement).not.toHaveClass('shadow-sm');
    if (child.getAttribute('aria-expanded') !== 'true') fireEvent.click(child);
    const row = screen.getByRole('button', { name: 'Lookup lookup' });
    expect(row.querySelector('[data-slot="tool-step-icon"]')).toHaveClass(
      'lucide-wrench',
    );
    expect(row).toBeDisabled();
    expect(row).not.toHaveAttribute('aria-expanded');
  });

  it('shows one clickable expert card and counts only the remaining preparation tool', () => {
    const open = vi.fn();
    render(view(message(), open));
    const group = screen.getByRole('button', { name: /Processed 1 task/ });
    fireEvent.click(group);
    expect(screen.getByText('Prepare role task')).toBeVisible();
    expect(screen.queryByText('opaque-expert-slug')).not.toBeInTheDocument();
    const card = screen.getByRole('button', { name: /Outline specialist/ });
    fireEvent.click(card);
    expect(open).toHaveBeenCalledWith('external');
  });

  it('keeps the dispatch visible until its correlated execution arrives', () => {
    const live = {
      ...message([
        { ...delegate, data: { ...delegate.data, status: 'running' } },
      ]),
      status: 'running',
      agentRuns: [],
    };
    const rendered = render(view(live));
    const pending = screen.getByRole('button', { name: /1 tool/ });
    if (pending.getAttribute('aria-expanded') !== 'true') fireEvent.click(pending);
    expect(screen.getByText('opaque-expert-slug')).toBeVisible();
    rendered.rerender(view(message()));
    expect(
      screen.getAllByRole('button', { name: /Outline specialist/ }),
    ).toHaveLength(1);
    expect(screen.queryByText('opaque-expert-slug')).not.toBeInTheDocument();
  });

  it('also hides duplicate events in saved branch history while retaining role tools', () => {
    render(view({ ...message(), historical: true }));
    const buttons = screen.getAllByRole('button', {
      name: /Processed 1 (task|file)/,
    });
    buttons.forEach((button) => {
      if (button.getAttribute('aria-expanded') !== 'true')
        fireEvent.click(button);
    });
    expect(screen.queryByText('opaque-expert-slug')).not.toBeInTheDocument();
    expect(screen.getByText('Prepare role task')).toBeVisible();
    expect(screen.getByText('Read role skill')).toBeVisible();
  });

  it('keeps unrelated tools with the same name and failures before dispatch', () => {
    const ordinary = {
      ...delegate,
      id: 'ordinary',
      data: { ...delegate.data, toolset: 'OtherTools' },
    };
    const failure: ToolEvent = {
      ...delegate,
      data: { ...delegate.data, status: 'fail', error: 'Expert unavailable' },
    };
    render(
      view({ ...message([ordinary, failure]), status: 'error', agentRuns: [] }),
    );
    const group = screen.getByRole('button', { name: /2 tools/ });
    if (group.getAttribute('aria-expanded') !== 'true') fireEvent.click(group);
    expect(screen.getAllByText('opaque-expert-slug')).toHaveLength(2);
  });
});
