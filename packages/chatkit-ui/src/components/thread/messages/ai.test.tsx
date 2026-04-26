import React from 'react';
import type {
  ChatkitMessage,
  TMessageComponentStep,
  TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const chatkitLanguage = vi.hoisted(() => ({ value: 'en-US' }));
const writeTextMock = vi.fn(() => Promise.resolve());

vi.mock('../../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    i18n: {
      get language() {
        return chatkitLanguage.value;
      },
    },
    t: (key: string, values?: Record<string, unknown>) => {
      const count = Number(values?.count ?? 0);

      switch (key) {
        case 'message.toolGroup.status.running':
          return 'Processing';
        case 'message.toolGroup.status.success':
          return 'Processed';
        case 'message.toolGroup.status.fail':
          return 'Processing failed';
        case 'message.toolGroup.inputTitle':
          return 'Input';
        case 'message.toolGroup.outputTitle':
          return 'Output';
        case 'message.toolGroup.errorTitle':
          return 'Error';
        case 'message.toolGroup.jsonTitle':
          return 'JSON';
        case 'message.toolGroup.jsonTree':
          return 'Tree';
        case 'message.toolGroup.jsonRaw':
          return 'Raw';
        case 'message.toolGroup.copy':
          return 'Copy';
        case 'message.toolGroup.copied':
          return 'Copied';
        case 'message.toolGroup.separator':
          return ', ';
        case 'message.toolGroup.categories.files.one':
          return `${count} file`;
        case 'message.toolGroup.categories.files.other':
          return `${count} files`;
        case 'message.toolGroup.categories.searches.one':
          return `${count} search`;
        case 'message.toolGroup.categories.searches.other':
          return `${count} searches`;
        case 'message.toolGroup.categories.commands.one':
          return `${count} command`;
        case 'message.toolGroup.categories.commands.other':
          return `${count} commands`;
        case 'message.toolGroup.categories.lists.one':
          return `${count} list`;
        case 'message.toolGroup.categories.lists.other':
          return `${count} lists`;
        case 'message.toolGroup.categories.tasks.one':
          return `${count} task`;
        case 'message.toolGroup.categories.tasks.other':
          return `${count} tasks`;
        case 'message.toolGroup.categories.knowledges.one':
          return `${count} knowledge result`;
        case 'message.toolGroup.categories.knowledges.other':
          return `${count} knowledge results`;
        case 'message.toolGroup.categories.tools.one':
          return `${count} tool`;
        case 'message.toolGroup.categories.tools.other':
          return `${count} tools`;
        default:
          return key;
      }
    },
  }),
}));

import { AssistantMessage } from './ai';

type ToolComponentDataOverride = Partial<Omit<TMessageComponentStep, 'message' | 'title' | 'type'>> & {
  category?: 'Tool';
  type?: string;
  title?: string | Record<string, string>;
  message?: string | Record<string, string>;
};

function createToolComponent(
  id: string,
  data: ToolComponentDataOverride = {},
): TMessageContentComponent {
  return {
    id,
    type: 'component',
    data: {
      category: 'Tool',
      toolset: 'testToolset',
      toolset_id: 'test-toolset',
      type: 'tool',
      tool: id,
      title: id,
      status: 'success',
      created_date: '2026-04-24T12:24:52.898Z',
      end_date: '2026-04-24T12:24:54.398Z',
      ...data,
    },
  };
}

function renderAssistant(content: ChatkitMessage['content']) {
  return render(
    <AssistantMessage
      message={{
        id: 'assistant-1',
        type: 'assistant',
        content,
      }}
    />,
  );
}

describe('AssistantMessage tool components', () => {
  beforeEach(() => {
    chatkitLanguage.value = 'en-US';
    writeTextMock.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('expands the latest completed tool group by default', () => {
    renderAssistant([
      createToolComponent('read-file', {
        type: 'files',
        message: 'Read package.json',
      }),
      createToolComponent('search-docs', {
        type: 'web_search',
        message: 'Searched docs',
      }),
    ]);

    const toggle = screen.getByRole('button', {
      name: /Processed 1 file, 1 search/,
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('read-file')).toBeInTheDocument();
    expect(screen.getByText('search-docs')).toBeInTheDocument();

    const content = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(content).toHaveClass('max-h-[200px]', 'overflow-y-auto');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('read-file')).not.toBeInTheDocument();
  });

  it('expands the latest grouped tool components by default', () => {
    renderAssistant([
      createToolComponent('run-tests', {
        type: 'program',
        message: 'Ran pnpm test',
        status: 'running',
      }),
      createToolComponent('read-file', {
        type: 'files',
        message: 'Read ai.tsx',
      }),
    ]);

    const toggle = screen.getByRole('button', {
      name: /Processed 1 file, 1 command/,
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: /Processing/ })).not.toBeInTheDocument();
    expect(screen.getByText('Ran pnpm test')).toBeInTheDocument();
    expect(screen.getByText('read-file')).toBeInTheDocument();
  });

  it('uses text content to break consecutive tool component groups', () => {
    renderAssistant([
      createToolComponent('first-tool'),
      createToolComponent('second-tool'),
      { type: 'text', text: 'The assistant answered between tools.' },
      createToolComponent('third-tool'),
      createToolComponent('fourth-tool'),
    ]);

    expect(
      screen.getAllByRole('button', { name: /Processed 2 tools/ }),
    ).toHaveLength(2);
    const toggles = screen.getAllByRole('button', { name: /Processed 2 tools/ });
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('The assistant answered between tools.')).toBeInTheDocument();
    expect(screen.queryByText('first-tool')).not.toBeInTheDocument();
    expect(screen.getByText('third-tool')).toBeInTheDocument();
  });

  it('collapses a tool group when a later non-group item appears', () => {
    renderAssistant([
      createToolComponent('first-tool'),
      createToolComponent('second-tool'),
      { type: 'text', text: 'Tools are done for now.' },
    ]);

    const toggle = screen.getByRole('button', { name: /Processed 2 tools/ });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('first-tool')).not.toBeInTheDocument();
    expect(screen.getByText('Tools are done for now.')).toBeInTheDocument();
  });

  it('ignores empty text and reasoning items between consecutive tool components', () => {
    renderAssistant([
      createToolComponent('first-tool'),
      { type: 'text', text: '   ' },
      { type: 'reasoning', text: '' },
      createToolComponent('second-tool'),
    ]);

    expect(
      screen.getByRole('button', { name: /Processed 2 tools/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('first-tool')).toBeInTheDocument();
    expect(screen.getByText('second-tool')).toBeInTheDocument();
  });

  it('keeps each grouped tool component expandable with input and output details', () => {
    renderAssistant([
      createToolComponent('read_file', {
        input: { path: 'packages/chatkit-ui/src/components/thread/messages/ai.tsx' },
        output: 'file contents',
      }),
      createToolComponent('run_command'),
    ]);

    const toolToggle = screen.getByRole('button', { name: /read_file/ });
    expect(toolToggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toolToggle);

    expect(toolToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText(/JSON · Object\(1\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/packages\/chatkit-ui\/src\/components\/thread\/messages\/ai.tsx/),
    ).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('file contents')).toBeInTheDocument();
  });

  it('does not treat tool message text as output details', () => {
    renderAssistant([
      createToolComponent('updateProjectTasks', {
        title: 'Update project tasks',
        message: 'Updating project tasks',
        status: 'running',
      }),
      createToolComponent('dispatchRunnableTasks'),
    ]);

    const toolToggle = screen.getByRole('button', {
      name: /Updating project tasks/,
    });

    expect(toolToggle).toBeDisabled();
    expect(toolToggle).not.toHaveAttribute('aria-expanded');
    expect(screen.queryByText('Output')).not.toBeInTheDocument();
  });

  it('copies grouped tool input and output values', async () => {
    renderAssistant([
      createToolComponent('updateProjectTasks', {
        input: { tasks: [{ id: 'task-1' }] },
        output: [{ id: 'task-1', status: 'done' }],
      }),
      createToolComponent('dispatchRunnableTasks'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /updateProjectTasks/ }));

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        JSON.stringify({ tasks: [{ id: 'task-1' }] }, null, 2),
      );
    });

    fireEvent.click(copyButtons[1]);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        JSON.stringify([{ id: 'task-1', status: 'done' }], null, 2),
      );
    });
  });

  it('uses localized message before title for running tool labels', () => {
    chatkitLanguage.value = 'zh-CN';

    renderAssistant([
      createToolComponent('updateProjectTasks', {
        title: { en_US: 'Update project tasks', zh_Hans: '更新项目任务' },
        message: { en_US: 'Updating project tasks', zh_Hans: '正在更新项目任务' },
        status: 'running',
      }),
      createToolComponent('dispatchRunnableTasks'),
    ]);

    expect(screen.getByText('正在更新项目任务')).toBeInTheDocument();
    expect(screen.queryByText('更新项目任务')).not.toBeInTheDocument();
  });

  it('uses localized title before message for completed tool labels', () => {
    chatkitLanguage.value = 'zh-CN';

    renderAssistant([
      createToolComponent('updateProjectTasks', {
        title: { en_US: 'Update project tasks', zh_Hans: '更新项目任务' },
        message: { en_US: 'Updating project tasks', zh_Hans: '正在更新项目任务' },
        status: 'success',
      }),
      createToolComponent('dispatchRunnableTasks'),
    ]);

    expect(screen.getByText('更新项目任务')).toBeInTheDocument();
    expect(screen.queryByText('正在更新项目任务')).not.toBeInTheDocument();
  });

  it('renders json string outputs with tree and raw views', () => {
    renderAssistant([
      createToolComponent('read_json', {
        output: '{"status":"ok","items":[{"id":1}]}',
      }),
      createToolComponent('run_command'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /read_json/ }));

    expect(screen.getByText(/JSON · Object\(2\)/)).toBeInTheDocument();
    expect(screen.getByText('status:')).toBeInTheDocument();
    expect(screen.getByText('"ok"')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Raw' }));

    expect(screen.getByText(/"items": \[/)).toBeInTheDocument();
  });

  it('labels grouped tool errors before rendering the error details', () => {
    renderAssistant([
      createToolComponent('read_file', {
        error: 'Permission denied',
        status: 'fail',
      }),
      createToolComponent('run_command'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /read_file/ }));

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Permission denied')).toBeInTheDocument();
  });

  it('renders a single tool component with the grouped tool UI', () => {
    renderAssistant([
      createToolComponent('read_file', {
        type: 'files',
        title: 'Read file',
      }),
    ]);

    const toggle = screen.getByRole('button', { name: /Processed 1 file/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Read file')).toBeInTheDocument();
  });

  it('does not group across widget components', () => {
    renderAssistant([
      createToolComponent('first-tool'),
      {
        id: 'widget-1',
        type: 'component',
        data: {
          category: 'Tool',
          type: 'Widget',
          widgets: [],
        },
      },
      createToolComponent('second-tool'),
    ]);

    const toggles = screen.getAllByRole('button', { name: /Processed 1 tool/ });
    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggles[0]);

    expect(screen.getByText('first-tool')).toBeInTheDocument();
    expect(screen.getByText('second-tool')).toBeInTheDocument();
  });

  it('summarizes grouped tool components by category priority', () => {
    renderAssistant([
      createToolComponent('read-files', { type: 'files' }),
      createToolComponent('search-code', { type: 'web_search' }),
      createToolComponent('run-command', { type: 'program' }),
    ]);

    expect(
      screen.getByRole('button', {
        name: /Processed 1 file, 1 search, 1 command/,
      }),
    ).toBeInTheDocument();
  });

  it('shows a finished tool duration from created_date to end_date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    render(
      <AssistantMessage
        message={{
          id: 'assistant-1',
          type: 'assistant',
          content: [
            {
              id: 'tool-1',
              type: 'component',
              data: {
                category: 'Tool',
                toolset: 'todoListMiddleware',
                tool: 'write_todos',
                title: 'write_todos',
                created_date: '2026-04-24T12:24:52.898Z',
                end_date: '2026-04-24T12:24:54.398Z',
                status: 'success',
              },
            },
          ],
        } as any}
      />,
    );

    expect(screen.getByText('1.5s')).toBeInTheDocument();
  });

  it('updates the running tool duration over time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    render(
      <AssistantMessage
        message={{
          id: 'assistant-1',
          type: 'assistant',
          content: [
            {
              id: 'tool-1',
              type: 'component',
              data: {
                category: 'Tool',
                toolset: 'todoListMiddleware',
                tool: 'write_todos',
                title: 'write_todos',
                created_date: '2026-04-24T12:24:52.898Z',
                status: 'running',
              },
            },
          ],
        } as any}
      />,
    );

    expect(screen.getByText('1.5s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('2.5s')).toBeInTheDocument();
  });
});
