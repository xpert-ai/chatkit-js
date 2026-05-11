import React from 'react';
import {
  REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION,
  REQUEST_USER_INPUT_RESULT_TYPE,
  type ChatkitMessage,
  type TMessageComponentStep,
  type TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeAgentRunInfo,
  type AgentRunInfo,
} from '../../../lib/agent-runs';

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
        case 'message.requestUserInputResult.title':
          return 'Selections confirmed';
        case 'message.requestUserInputResult.option':
          return 'Option';
        case 'message.requestUserInputResult.other':
          return 'Other';
        case 'message.agentRun.defaultTitle':
          return 'Sub-agent';
        case 'message.agentRun.inputLabel':
          return 'Input';
        case 'message.agentRun.errorLabel':
          return 'Error';
        case 'message.agentRun.status.running':
          return 'Running';
        case 'message.agentRun.status.success':
          return 'Done';
        case 'message.agentRun.status.error':
          return 'Error';
        case 'message.agentRun.status.replied':
          return 'Replied';
        case 'message.agentRun.status.pending':
          return 'Pending';
        case 'message.agentRun.counts.messages.one':
          return `${count} message`;
        case 'message.agentRun.counts.messages.other':
          return `${count} messages`;
        case 'message.agentRun.counts.tools.one':
          return `${count} tool`;
        case 'message.agentRun.counts.tools.other':
          return `${count} tools`;
        case 'message.agentRun.counts.events.one':
          return `${count} event`;
        case 'message.agentRun.counts.events.other':
          return `${count} events`;
        case 'message.agentRun.counts.children.one':
          return `${count} child agent`;
        case 'message.agentRun.counts.children.other':
          return `${count} child agents`;
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
        case 'message.toolGroup.sourcesTitle':
          return 'Sources';
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

type AssistantChatkitMessage = ChatkitMessage & { type: 'assistant' };

type ToolComponentDataOverride = Partial<
  Omit<TMessageComponentStep, 'message' | 'title' | 'type'>
> & {
  category?: 'Tool' | 'Computer';
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

function renderAssistant(
  content: ChatkitMessage['content'],
  overrides: Partial<ChatkitMessage> & {
    executionId?: string;
    agentRuns?: AgentRunInfo[];
  } = {},
) {
  return render(
    <AssistantMessage
      message={
        {
          ...overrides,
          id: 'assistant-1',
          type: 'assistant',
          content,
        } as ChatkitMessage & { type: 'assistant' }
      }
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
    expect(screen.getByText('Read package.json')).toBeInTheDocument();
    expect(screen.getByText('Searched docs')).toBeInTheDocument();

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
    expect(
      screen.queryByRole('button', { name: /Processing/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Ran pnpm test')).toBeInTheDocument();
    expect(screen.getByText('Read ai.tsx')).toBeInTheDocument();
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
    const toggles = screen.getAllByRole('button', {
      name: /Processed 2 tools/,
    });
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText('The assistant answered between tools.'),
    ).toBeInTheDocument();
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
        input: {
          path: 'packages/chatkit-ui/src/components/thread/messages/ai.tsx',
        },
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
      screen.getByText(
        /packages\/chatkit-ui\/src\/components\/thread\/messages\/ai.tsx/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('file contents')).toBeInTheDocument();
  });

  it('preserves expanded tool row state when appending to the same group', () => {
    const firstTool = createToolComponent('read_file', {
      input: {
        path: 'packages/chatkit-ui/src/components/thread/messages/ai.tsx',
      },
      output: 'file contents',
    });
    const secondTool = createToolComponent('run_command');
    const { rerender } = renderAssistant([firstTool]);

    fireEvent.click(screen.getByRole('button', { name: /read_file/ }));

    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('file contents')).toBeInTheDocument();

    rerender(
      <AssistantMessage
        message={
          {
            id: 'assistant-1',
            type: 'assistant',
            content: [{ ...firstTool }, secondTool],
          } as AssistantChatkitMessage
        }
      />,
    );

    expect(
      screen.getByRole('button', { name: /Processed 2 tools/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('file contents')).toBeInTheDocument();
    expect(screen.getByText('run_command')).toBeInTheDocument();
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
        message: {
          en_US: 'Updating project tasks',
          zh_Hans: '正在更新项目任务',
        },
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
        message: {
          en_US: 'Updating project tasks',
          zh_Hans: '正在更新项目任务',
        },
        status: 'success',
      }),
      createToolComponent('dispatchRunnableTasks'),
    ]);

    expect(screen.getByText('更新项目任务')).toBeInTheDocument();
    expect(screen.queryByText('正在更新项目任务')).not.toBeInTheDocument();
  });

  it('uses message before generated tool-name titles for completed tool labels', () => {
    renderAssistant([
      createToolComponent('host_page_click', {
        message: 'Click the bottom Execute button',
        status: 'success',
      }),
      createToolComponent('dispatchRunnableTasks'),
    ]);

    expect(
      screen.getByText('Click the bottom Execute button'),
    ).toBeInTheDocument();
    expect(screen.queryByText('host_page_click')).not.toBeInTheDocument();
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

    expect(
      screen.getByRole('button', { name: /Processed 2 tools/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Processing failed 2 tools/ }),
    ).not.toBeInTheDocument();

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

  it('renders computer web search sources in grouped tool details', () => {
    renderAssistant([
      createToolComponent('web-search', {
        category: 'Computer',
        type: 'web_search',
        tool: 'web_search',
        title: 'Web Search',
        message: 'Codex /goal',
        input: {
          query: 'Codex /goal',
          numResults: 4,
        },
        data: [
          {
            title: 'Technical Research - Codex /goal',
            url: 'https://zenn.dev/example/articles/codex-goal',
            content:
              'Codex CLI goal mode keeps a persistent goal-driven workflow.',
            publishedDate: '2026-04-30',
            author: 'npaka',
          },
          {
            title: 'Codex CLI 0.128.0 adds /goal',
            url: 'https://simonwillison.net/example/codex-goal',
            description:
              'A short note about the new persistent goal command.',
          },
        ],
      }),
    ]);

    expect(
      screen.getByRole('button', { name: /Processed 1 search/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Codex \/goal/ }));

    expect(screen.queryByText('Input')).not.toBeInTheDocument();
    expect(screen.getByText('Sources')).toBeInTheDocument();
    const link = screen.getByRole('link', {
      name: /Technical Research - Codex \/goal/,
    });
    expect(link).toHaveAttribute(
      'href',
      'https://zenn.dev/example/articles/codex-goal',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(
      screen.getByText(/persistent goal-driven workflow/),
    ).toBeInTheDocument();
    expect(screen.getByText(/zenn.dev/)).toBeInTheDocument();
  });

  it('does not route web fetch computer messages to the web search source renderer', () => {
    renderAssistant([
      createToolComponent('web-fetch', {
        category: 'Computer',
        type: 'web_search',
        tool: 'web_fetch',
        title: 'Web Fetch',
        message: 'https://docs.xpertai.cn',
      }),
    ]);

    expect(
      screen.queryByRole('button', { name: /Processed 1 search/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('https://docs.xpertai.cn')).toBeInTheDocument();
  });

  it('falls back to raw output when web search sources are missing', () => {
    renderAssistant([
      createToolComponent('web-search-empty', {
        category: 'Computer',
        type: 'web_search',
        tool: 'web_search',
        title: 'Web Search',
        data: [{ title: 'Missing URL' }],
        output: 'raw web search output',
      }),
    ]);

    expect(
      screen.getByRole('button', { name: /Processed 1 search/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Web Search/ }));

    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('raw web search output')).toBeInTheDocument();
  });

  it('renders request_user_input tool results as a confirmation card', () => {
    renderAssistant(
      [
        {
          id: 'call-request-input',
          type: 'component',
          data: {
            status: 'success',
            end_date: '2026-04-28T11:13:02.019Z',
            output: JSON.stringify({
              answers: [
                {
                  id: 'website_type',
                  question: '您想开发什么类型的网站？',
                  type: 'option',
                  value: '企业官网/展示型网站',
                  label: '企业官网/展示型网站',
                  description: '用于展示公司信息、产品或服务',
                },
                {
                  id: 'tech_stack',
                  question: '您对技术栈有偏好吗？',
                  type: 'other',
                  value: 'Angular',
                },
              ],
            }),
          },
        } as unknown as TMessageContentComponent,
      ],
      {
        clientToolCalls: [
          {
            id: 'call-request-input',
            name: 'request_user_input',
          },
        ] as any,
      } as Partial<ChatkitMessage>,
    );

    expect(screen.getByLabelText('Selections confirmed')).toBeInTheDocument();
    expect(screen.getByText('您想开发什么类型的网站？')).toBeInTheDocument();
    expect(screen.getByText('企业官网/展示型网站')).toBeInTheDocument();
    expect(
      screen.getByText('用于展示公司信息、产品或服务'),
    ).toBeInTheDocument();
    expect(screen.getByText('您对技术栈有偏好吗？')).toBeInTheDocument();
    expect(screen.getByText('Angular')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Processed 1 tool/ }),
    ).not.toBeInTheDocument();
  });

  it('renders explicitly typed request_user_input results without id inference', () => {
    renderAssistant([
      {
        id: 'component-without-original-tool-call',
        type: 'component',
        data: {
          status: 'success',
          output: JSON.stringify({
            type: REQUEST_USER_INPUT_RESULT_TYPE,
            purpose: REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION,
            answers: [
              {
                id: 'site_type',
                question: '你希望这个网站是什么类型的？',
                type: 'option',
                value: '产品展示官网 (Recommended)',
                label: '产品展示官网 (Recommended)',
                description:
                  '展示产品特性、功能介绍、下载/使用入口的营销型网站',
              },
            ],
          }),
        },
      } as unknown as TMessageContentComponent,
    ]);

    expect(screen.getByLabelText('Selections confirmed')).toBeInTheDocument();
    expect(
      screen.getByText('你希望这个网站是什么类型的？'),
    ).toBeInTheDocument();
    expect(screen.getByText('产品展示官网 (Recommended)')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Processed 1 tool/ }),
    ).not.toBeInTheDocument();
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

  it('treats component messages with an empty category as tool components', () => {
    renderAssistant([
      createToolComponent('host_page_snapshot', {
        category: undefined,
        type: undefined,
        tool: 'host_page_snapshot',
        title: 'host_page_snapshot',
        output: JSON.stringify({
          url: 'https://docs.xpertai.cn',
          title: 'Docs',
        }),
      }),
    ]);

    expect(
      screen.getByRole('button', { name: /Processed 1 tool/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('host_page_snapshot')).toBeInTheDocument();
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
        message={
          {
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
          } as AssistantChatkitMessage
        }
      />,
    );

    expect(screen.getByText('1.5s')).toBeInTheDocument();
  });

  it('shows the tool icon for completed tool rows instead of a status check', () => {
    const { container } = renderAssistant([
      createToolComponent('run-command', {
        type: 'program',
        title: 'run-command',
        status: 'success',
      }),
    ]);

    expect(
      container.querySelector('[data-slot="tool-step-icon"]'),
    ).toBeInTheDocument();
  });

  it('uses smaller density-aware text for grouped tool rows', () => {
    renderAssistant([
      createToolComponent('run-command', {
        type: 'program',
        title: 'run-command',
        status: 'success',
      }),
    ]);

    expect(screen.getByRole('button', { name: /run-command/ })).toHaveClass(
      'text-xs',
      'leading-5',
      'in-data-[density=compact]:text-[11px]',
      'in-data-[density=compact]:leading-4',
      'in-data-[density=spacious]:text-[13px]',
      'in-data-[density=spacious]:leading-5',
    );
  });

  it('adds a shimmer text effect to running grouped tool rows', () => {
    renderAssistant([
      createToolComponent('run-command', {
        type: 'program',
        title: 'run-command',
        status: 'running',
        end_date: undefined,
      }),
    ]);

    expect(screen.getByText('run-command')).toHaveClass(
      'ck-tool-call-running-text',
    );
  });

  it('uses the tool icon for running tool rows instead of a loading indicator', () => {
    const { container } = renderAssistant([
      createToolComponent('run-command', {
        type: 'program',
        title: 'run-command',
        status: 'running',
        end_date: undefined,
      }),
    ]);

    expect(
      container.querySelector('[data-slot="tool-step-icon"]'),
    ).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  it('uses the builtin provider icon URL for provider toolsets', () => {
    const { container } = render(
      <AssistantMessage
        message={
          {
            id: 'assistant-1',
            type: 'assistant',
            content: [
              createToolComponent('search-web', {
                type: 'tool',
                toolset: 'tavily',
                title: 'search-web',
                status: 'success',
              }),
            ],
          } as AssistantChatkitMessage
        }
        apiUrl="https://api.example.com/api/ai"
        organizationId="org-1"
      />,
    );

    expect(
      container.querySelector('img[data-slot="tool-step-icon"]'),
    ).toHaveAttribute(
      'src',
      'https://api.example.com/api/xpert-toolset/builtin-provider/tavily/icon?org=org-1',
    );
  });

  it('uses the provider icon URL for middleware toolsets before the step type icon', () => {
    const { container } = render(
      <AssistantMessage
        message={
          {
            id: 'assistant-1',
            type: 'assistant',
            content: [
              createToolComponent('host_page_snapshot', {
                type: 'program',
                toolset: 'browser-automation',
                title: 'host_page_snapshot',
                status: 'success',
              }),
            ],
          } as AssistantChatkitMessage
        }
        apiUrl="https://api.example.com/api/ai"
        organizationId="org-1"
      />,
    );

    expect(
      container.querySelector('img[data-slot="tool-step-icon"]'),
    ).toHaveAttribute(
      'src',
      'https://api.example.com/api/xpert-toolset/builtin-provider/browser-automation/icon?org=org-1',
    );
  });

  it('falls back to the step type icon when the provider icon URL fails', async () => {
    const { container } = render(
      <AssistantMessage
        message={
          {
            id: 'assistant-1',
            type: 'assistant',
            content: [
              createToolComponent('host_page_snapshot', {
                type: 'program',
                toolset: 'browser-automation',
                title: 'host_page_snapshot',
                status: 'success',
              }),
            ],
          } as AssistantChatkitMessage
        }
        apiUrl="https://api.example.com/api/ai"
      />,
    );

    const icon = container.querySelector('img[data-slot="tool-step-icon"]');
    if (!(icon instanceof HTMLImageElement)) {
      throw new Error('Expected a provider icon image.');
    }
    fireEvent.error(icon);

    await waitFor(() => {
      expect(
        container.querySelector('img[data-slot="tool-step-icon"]'),
      ).not.toBeInTheDocument();
    });
    expect(
      container.querySelector('svg[data-slot="tool-step-icon"]'),
    ).toBeInTheDocument();
  });

  it('marks stale running tools as failed and freezes their duration when the thread is idle', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    render(
      <AssistantMessage
        message={
          {
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
                  message: 'Writing todos',
                  created_date: '2026-04-24T12:24:52.898Z',
                  status: 'running',
                },
              },
            ],
          } as any
        }
        isThreadRunning={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Processed 1 task/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Processing failed 1 task/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Writing todos')).toBeInTheDocument();
    expect(screen.queryByText('write_todos')).not.toBeInTheDocument();
    expect(screen.getByText('1.5s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('1.5s')).toBeInTheDocument();
    expect(screen.queryByText('2.5s')).not.toBeInTheDocument();
  });

  it('updates the running tool duration over time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    render(
      <AssistantMessage
        message={
          {
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
          } as any
        }
      />,
    );

    expect(screen.getByText('1.5s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('2.5s')).toBeInTheDocument();
  });

  it('groups interleaved sub-agent output by execution id', () => {
    renderAssistant(
      [
        {
          id: 'a-text',
          type: 'text',
          text: 'A found the source.',
          executionId: 'exec-a',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_A',
          xpertName: 'demo-files',
        },
        {
          id: 'b-text',
          type: 'text',
          text: 'B wrote the summary.',
          executionId: 'exec-b',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_B',
          xpertName: 'demo-files',
        },
        {
          ...createToolComponent('read_a', {
            type: 'files',
            title: 'Read A file',
          }),
          executionId: 'exec-a',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_A',
          xpertName: 'demo-files',
        },
        {
          id: 'a-text-2',
          type: 'text',
          text: 'A finished.',
          executionId: 'exec-a',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_A',
          xpertName: 'demo-files',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'exec-a',
            parentId: 'root-exec',
            title: 'Researcher',
            status: 'success',
          },
          {
            id: 'exec-b',
            parentId: 'root-exec',
            title: 'Writer',
            status: 'success',
          },
        ],
      },
    );

    const researcherToggle = screen.getByRole('button', {
      name: /Researcher/,
    });
    const writerToggle = screen.getByRole('button', { name: /Writer/ });

    expect(researcherToggle).toHaveAttribute('aria-expanded', 'false');
    expect(writerToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('demo-files')).not.toBeInTheDocument();
    expect(screen.getByText('B wrote the summary.')).toBeInTheDocument();
    expect(screen.queryByText('A found the source.')).not.toBeInTheDocument();

    fireEvent.click(researcherToggle);

    expect(screen.getByText('A found the source.')).toBeInTheDocument();
    expect(screen.getByText('A finished.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Processed 1 file/ }),
    ).toBeInTheDocument();
  });

  it('uses density-aware spacing for sub-agent render trees', () => {
    renderAssistant(
      [
        {
          id: 'a-text',
          type: 'text',
          text: 'A found the source.',
          executionId: 'exec-a',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_A',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'exec-a',
            parentId: 'root-exec',
            agentKey: 'Agent_A',
            status: 'success',
          },
        ],
      },
    );

    expect(
      screen.getByRole('button', { name: /Agent_A/ }).closest('.space-y-3'),
    ).toHaveClass(
      'in-data-[density=compact]:space-y-2',
      'in-data-[density=spacious]:space-y-4',
    );
  });

  it('uses agent event titles and xpert names before agent keys in run headers', () => {
    renderAssistant(
      [
        {
          id: 'named-agent-text',
          type: 'text',
          text: 'Named agent output.',
          executionId: 'exec-named',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_InternalKey',
          xpertName: 'Readable Agent',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'exec-titled',
            parentId: 'root-exec',
            agentKey: 'web_search',
            title: '网络搜索',
            status: 'success',
          },
        ],
      },
    );

    expect(
      screen.getByRole('button', { name: /Readable Agent/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /网络搜索/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Agent_InternalKey')).not.toBeInTheDocument();
    expect(screen.queryByText('web_search')).not.toBeInTheDocument();
  });

  it('ignores top-level event names when resolving agent run titles', () => {
    const runWithToolName: AgentRunInfo & { name: string } = {
      id: 'exec-name',
      parentId: 'root-exec',
      agentKey: 'Agent_NameTrap',
      name: 'web_search',
      status: 'success',
    };

    renderAssistant(
      [],
      {
        executionId: 'root-exec',
        agentRuns: [runWithToolName],
      },
    );

    expect(
      screen.getByRole('button', { name: /Agent_NameTrap/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('web_search')).not.toBeInTheDocument();
  });

  it('normalizes nested agent titles before xpert names', () => {
    expect(
      normalizeAgentRunInfo({
        id: 'exec-agent-title',
        agentKey: 'web_search',
        xpert: { name: 'Team Name' },
        agent: {
          name: 'web_search',
          title: '网络搜索',
        },
      })?.xpertName,
    ).toBe('网络搜索');
  });

  it('keeps simultaneous runs with the same agent key separate', () => {
    renderAssistant(
      [
        {
          id: 'worker-1-text',
          type: 'text',
          text: 'First worker output.',
          executionId: 'worker-run-1',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_Worker',
        },
        {
          id: 'worker-2-text',
          type: 'text',
          text: 'Second worker output.',
          executionId: 'worker-run-2',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_Worker',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'worker-run-1',
            parentId: 'root-exec',
            agentKey: 'Agent_Worker',
            title: 'Worker pass 1',
            status: 'success',
          },
          {
            id: 'worker-run-2',
            parentId: 'root-exec',
            agentKey: 'Agent_Worker',
            title: 'Worker pass 2',
            status: 'success',
          },
        ],
      },
    );

    const firstToggle = screen.getByRole('button', { name: /Worker pass 1/ });
    const secondToggle = screen.getByRole('button', { name: /Worker pass 2/ });

    expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
    expect(secondToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Second worker output.')).toBeInTheDocument();
    expect(screen.queryByText('First worker output.')).not.toBeInTheDocument();

    fireEvent.click(firstToggle);

    expect(screen.getByText('First worker output.')).toBeInTheDocument();
  });

  it('renders nested sub-agent runs recursively', () => {
    renderAssistant(
      [
        {
          id: 'parent-text',
          type: 'text',
          text: 'Parent planned the work.',
          executionId: 'parent-run',
          parentExecutionId: 'root-exec',
        },
        {
          id: 'child-text',
          type: 'text',
          text: 'Child completed the task.',
          executionId: 'child-run',
          parentExecutionId: 'parent-run',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'parent-run',
            parentId: 'root-exec',
            title: 'Planner',
            status: 'success',
          },
          {
            id: 'child-run',
            parentId: 'parent-run',
            title: 'Executor',
            status: 'success',
          },
        ],
      },
    );

    expect(screen.getByRole('button', { name: /Planner/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /Executor/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Parent planned the work.')).toBeInTheDocument();
    expect(screen.getByText('Child completed the task.')).toBeInTheDocument();
  });

  it('keeps tool component groups inside a sub-agent group', () => {
    renderAssistant(
      [
        {
          ...createToolComponent('read_file', {
            type: 'files',
            title: 'Read file',
          }),
          executionId: 'tool-agent-run',
          parentExecutionId: 'root-exec',
        },
        {
          ...createToolComponent('run_tests', {
            type: 'program',
            title: 'Run tests',
          }),
          executionId: 'tool-agent-run',
          parentExecutionId: 'root-exec',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'tool-agent-run',
            parentId: 'root-exec',
            title: 'Tool worker',
            status: 'success',
          },
        ],
      },
    );

    expect(screen.getByRole('button', { name: /Tool worker/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(
      screen.getByRole('button', { name: /Processed 1 file, 1 command/ }),
    ).toBeInTheDocument();
  });

  it('expands running sub-agent groups while keeping older completed groups collapsed', () => {
    renderAssistant(
      [
        {
          id: 'done-text',
          type: 'text',
          text: 'Completed output.',
          executionId: 'done-run',
          parentExecutionId: 'root-exec',
        },
        {
          id: 'running-text',
          type: 'text',
          text: 'Streaming output.',
          executionId: 'running-run',
          parentExecutionId: 'root-exec',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'done-run',
            parentId: 'root-exec',
            title: 'Finished worker',
            status: 'success',
          },
          {
            id: 'running-run',
            parentId: 'root-exec',
            title: 'Active worker',
            status: 'running',
          },
        ],
      },
    );

    expect(
      screen.getByRole('button', { name: /Finished worker/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', { name: /Active worker/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Completed output.')).not.toBeInTheDocument();
    expect(screen.getByText('Streaming output.')).toBeInTheDocument();
    expect(
      screen.getByText('Streaming output.').closest('.text-sm'),
    ).toBeInTheDocument();
  });

  it('keeps sub-agent input and message counts in header icon tooltips only', () => {
    renderAssistant(
      [
        {
          id: 'input-text',
          type: 'text',
          text: 'Input scoped output.',
          executionId: 'input-run',
          parentExecutionId: 'root-exec',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'input-run',
            parentId: 'root-exec',
            title: 'Input worker',
            status: 'success',
            inputs: { input: 'Write a horse joke' },
          },
        ],
      },
    );

    expect(
      screen.getByRole('button', { name: /Input worker/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Input')).toBeInTheDocument();
    expect(screen.getByLabelText('1 message')).toBeInTheDocument();
    expect(screen.queryByText(/Input:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Write a horse joke/)).not.toBeInTheDocument();
  });

  it('labels pending sub-agent groups with output as replied', () => {
    renderAssistant(
      [
        {
          id: 'reply-text',
          type: 'text',
          text: 'Reply is ready.',
          executionId: 'reply-run',
          parentExecutionId: 'root-exec',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'reply-run',
            parentId: 'root-exec',
            title: 'Reply worker',
            status: 'pending',
          },
        ],
      },
    );

    expect(screen.getByRole('button', { name: /Reply worker/ })).toHaveTextContent(
      'Replied',
    );
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });
});
