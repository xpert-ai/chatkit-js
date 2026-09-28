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
  Pick<TMessageComponentStep, 'toolset' | 'tool' | 'title' | 'status' | 'error'>
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
