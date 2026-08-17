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
import { THREAD_CONTEXT_USAGE_EVENT_TYPE } from '../../../lib/thread-context-usage';

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
      const isZh = chatkitLanguage.value.toLowerCase().startsWith('zh');
      const attempt = values?.attempt ?? '';
      const total = values?.total ?? '';

      switch (key) {
        case 'message.contextCompression.running':
          return 'Automatically compressing context';
        case 'message.contextCompression.success':
          return 'Context automatically compressed';
        case 'message.contextCompression.skipped':
          return 'Context not compressed';
        case 'message.contextCompression.fail':
          return 'Context compression failed';
        case 'message.requestUserInputResult.title':
          return 'Selections confirmed';
        case 'message.requestUserInputResult.option':
          return 'Option';
        case 'message.requestUserInputResult.other':
          return 'Other';
        case 'message.knowledgeRetriever.queryTitle':
          return 'Query';
        case 'message.knowledgeRetriever.resultsTitle':
          return `Retrieved results (${count})`;
        case 'message.knowledgeRetriever.rawDataTitle':
          return 'Raw data';
        case 'message.knowledgeRetriever.noResults':
          return 'No knowledge results found';
        case 'message.knowledgeRetriever.scoreLabel':
          return 'Score';
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
        case 'message.middlewareEvent.title.default':
          return isZh ? '中间件' : 'Middleware';
        case 'message.middlewareEvent.title.ModelFallbackMiddleware':
          return isZh ? '模型回退' : 'Model fallback';
        case 'message.middlewareEvent.title.ModelRetryMiddleware':
          return isZh ? '模型重试' : 'Model retry';
        case 'message.middlewareEvent.phase.fallback_started':
          return isZh
            ? `正在尝试备用模型 ${attempt}/${total}`
            : `Trying fallback model ${attempt}/${total}`;
        case 'message.middlewareEvent.phase.fallback_succeeded':
          return isZh
            ? `备用模型调用成功 ${attempt}/${total}`
            : `Fallback model succeeded ${attempt}/${total}`;
        case 'message.middlewareEvent.phase.fallback_failed':
          return isZh
            ? `备用模型调用失败 ${attempt}/${total}`
            : `Fallback model failed ${attempt}/${total}`;
        case 'message.middlewareEvent.phase.retry_scheduled':
          return isZh
            ? `准备重试模型调用 ${attempt}/${total}`
            : `Scheduling model retry ${attempt}/${total}`;
        case 'message.middlewareEvent.phase.retry_started':
          return isZh
            ? `正在重试模型调用 ${attempt}/${total}`
            : `Retrying model call ${attempt}/${total}`;
        case 'message.middlewareEvent.phase.retry_succeeded':
          return isZh
            ? `模型重试成功 ${attempt}/${total}`
            : `Model retry succeeded ${attempt}/${total}`;
        case 'message.middlewareEvent.phase.retry_failed':
          return isZh
            ? `模型重试失败 ${attempt}/${total}`
            : `Model retry failed ${attempt}/${total}`;
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
        case 'message.toolGroup.shell.success':
          return 'Success';
        case 'message.toolGroup.shell.running':
          return 'Running';
        case 'message.toolGroup.shell.failed':
          return 'Failed';
        case 'message.toolGroup.shell.exitCode':
          return `Exit code ${values?.code}`;
        case 'message.toolGroup.shell.ranCommand':
          return `Ran ${values?.command}`;
        case 'message.toolGroup.shell.runningCommand':
          return `Running ${values?.command}`;
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
          return typeof values?.defaultValue === 'string'
            ? values.defaultValue
            : key;
      }
    },
  }),
}));

import { AssistantMessage, type AssistantMessageProps } from './ai';

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

function createContextCompressionComponent(
  data: Record<string, unknown> = {},
): TMessageContentComponent {
  return {
    id: 'context-compression-1',
    type: 'component',
    data: {
      category: 'Tool',
      type: 'context-compression',
      status: 'success',
      message: 'Two-phase compression complete.',
      summary: '<state_snapshot>Compressed history.</state_snapshot>',
      created_date: '2026-05-16T06:40:16.333Z',
      end_date: '2026-05-16T06:40:16.441Z',
      ...data,
    },
  } as TMessageContentComponent;
}

function renderAssistant(
  content: ChatkitMessage['content'],
  overrides: Partial<ChatkitMessage> & {
    executionId?: string;
    agentRuns?: AgentRunInfo[];
  } = {},
  props: Omit<Partial<AssistantMessageProps>, 'message'> = {},
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
      {...props}
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

  it('renders context compression components as standalone separators', () => {
    renderAssistant([
      createContextCompressionComponent(),
      createToolComponent('read-file'),
    ]);

    expect(
      screen.getByText('Context automatically compressed'),
    ).toBeInTheDocument();
    expect(screen.getByText('Processed 1 tool')).toBeInTheDocument();
    expect(screen.queryByText('Processed 2 tools')).not.toBeInTheDocument();
  });

  it('renders skipped context compression as a no-op separator', () => {
    renderAssistant([
      createContextCompressionComponent({
        reason: 'no_unprotected_history',
        message:
          'No unprotected history available to compress. Recent user turns were preserved.',
      }),
    ]);

    expect(screen.getByText('Context not compressed')).toBeInTheDocument();
  });

  it('adds a shimmer text effect to running context compression separators', () => {
    renderAssistant([
      createContextCompressionComponent({
        status: 'running',
        message: 'Generating context summary...',
        end_date: undefined,
      }),
    ]);

    expect(screen.getByText('Automatically compressing context')).toHaveClass(
      'ck-tool-call-running-text',
    );
  });

  it('shows an inline pet next to assistant state controls only while streaming', () => {
    const content: ChatkitMessage['content'] = [
      { id: 'answer', type: 'text', text: 'Drafting the page.' },
    ];
    const reasoning = [
      {
        id: 'reasoning',
        type: 'reasoning' as const,
        text: 'Need layout first.',
      },
    ];

    const { rerender } = renderAssistant(
      content,
      { reasoning, status: 'answering' },
      { isStreaming: true, streamingStatus: 'answering', pet: true },
    );

    expect(screen.getByTestId('chatkit-inline-pet-status')).toHaveAttribute(
      'data-pet-state',
      'review',
    );

    rerender(
      <AssistantMessage
        message={
          {
            id: 'assistant-1',
            type: 'assistant',
            content,
            reasoning,
          } as ChatkitMessage & { type: 'assistant' }
        }
        isStreaming={false}
        pet
      />,
    );

    expect(screen.queryByTestId('chatkit-inline-pet-status')).toBeNull();
  });

  it('uses the running inline pet state before the assistant starts answering', () => {
    renderAssistant(
      '',
      {},
      {
        isStreaming: true,
        streamingStatus: 'loading',
        pet: true,
      },
    );

    expect(screen.getByTestId('chatkit-inline-pet-status')).toHaveAttribute(
      'data-pet-state',
      'running',
    );
  });

  it('does not show an inline pet while streaming when pet is disabled', () => {
    renderAssistant(
      '',
      {},
      {
        isStreaming: true,
        streamingStatus: 'loading',
      },
    );

    expect(screen.queryByTestId('chatkit-inline-pet-status')).toBeNull();
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

  it('shows the stable tool name before the input label when the row uses a summary title', () => {
    renderAssistant([
      createToolComponent('bom_lifecycle_save_observation', {
        title: 'Completed technical agreement extraction',
        input: {
          caseId: 'case-1',
          changeSummary: 'Saved three observations',
        },
      }),
    ]);

    fireEvent.click(
      screen.getByRole('button', {
        name: /Completed technical agreement extraction/,
      }),
    );

    expect(screen.getByText('Input').parentElement).toHaveTextContent(
      'bom_lifecycle_save_observation·Input',
    );
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
    expect(
      screen.getByRole('button', { name: /run_command/ }).closest('li'),
    ).toHaveClass('ck-tool-call-row-enter');
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
            description: 'A short note about the new persistent goal command.',
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

  it('renders knowledge retriever messages inside grouped tool details', () => {
    renderAssistant([
      createToolComponent('knowledge-retriever-1', {
        category: 'Computer',
        type: 'knowledges',
        toolset: 'knowledge',
        title: 'retriever-kb',
        message: 'plan mode 详细介绍',
        input: {
          query: 'plan mode 详细介绍',
        },
        data: [
          {
            id: 'chunk-1',
            pageContent:
              'Plan mode keeps implementation paused until a complete plan is accepted.',
            metadata: {
              chunkId: 'chunk-1',
              source: 'chatkit-plan-mode.md',
              relevanceScore: 0.9234,
              loc: {
                lines: {
                  from: 12,
                  to: 14,
                },
              },
            },
            document: {
              name: 'ChatKit Plan Mode',
              fileUrl: 'https://docs.example.com/plan-mode',
            },
          },
        ],
      }),
    ]);

    expect(
      screen.getByRole('button', { name: /Processed 1 knowledge result/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Query')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Knowledge Retriever/ }),
    );

    expect(screen.getByText('Query')).toBeInTheDocument();
    expect(screen.getByText('plan mode 详细介绍')).toBeInTheDocument();
    expect(screen.getByText('Retrieved results (1)')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /ChatKit Plan Mode/ });
    expect(link).toHaveAttribute('href', 'https://docs.example.com/plan-mode');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(screen.getByText('[12-14]')).toBeInTheDocument();
    expect(
      screen.getByText(/Plan mode keeps implementation paused/),
    ).toBeInTheDocument();
    expect(screen.getByText('Score:')).toBeInTheDocument();
    expect(screen.getByText('0.923')).toBeInTheDocument();
    expect(screen.getByText('source:')).toBeInTheDocument();
    expect(screen.getByText('chatkit-plan-mode.md')).toBeInTheDocument();
  });

  it('renders an empty state for knowledge retriever messages without results', () => {
    renderAssistant([
      createToolComponent('knowledge-retriever-empty', {
        category: 'Computer',
        type: 'knowledges',
        title: 'Knowledge Retriever',
        message: 'missing knowledge',
        input: {
          query: 'missing knowledge',
        },
        data: [],
      }),
    ]);

    expect(screen.getByText('Knowledge Retriever')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Knowledge Retriever/ }),
    );

    expect(screen.getByText('missing knowledge')).toBeInTheDocument();
    expect(screen.getByText('No knowledge results found')).toBeInTheDocument();
  });

  it('falls back to raw data for non-standard knowledge retriever payloads', () => {
    renderAssistant([
      createToolComponent('knowledge-retriever-raw', {
        category: 'Computer',
        type: 'knowledges',
        title: 'Knowledge Retriever',
        message: 'odd payload',
        data: [{ foo: 'bar' }],
      }),
    ]);

    expect(screen.getByText('Knowledge Retriever')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Knowledge Retriever/ }),
    );

    expect(screen.getByText('Raw data')).toBeInTheDocument();
    expect(screen.getAllByText(/Array\(1\)/).length).toBeGreaterThan(0);
    expect(screen.getByText('foo:')).toBeInTheDocument();
    expect(screen.getByText('"bar"')).toBeInTheDocument();
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

  it('renders sandbox_shell tools as expandable shell output cards', async () => {
    const { container } = renderAssistant([
      createToolComponent('shell-success', {
        tool: 'sandbox_shell',
        title: 'sandbox_shell',
        input: { command: 'git diff --stat' },
        output: {
          stdout:
            '.../semantic-analysis.service.spec.ts | 95 ++++++++++++++++\n4 files changed, 273 insertions(+), 7 deletions(-)',
          exit_code: 0,
        },
      }),
      createToolComponent('shell-running', {
        tool: 'sandbox_shell',
        title: 'sandbox_shell',
        input: { command: 'sleep 1' },
        status: 'running',
        end_date: undefined,
      }),
      createToolComponent('shell-fail', {
        tool: 'sandbox_shell',
        title: 'sandbox_shell',
        input: { cmd: 'pnpm test' },
        output: {
          stderr: 'Tests failed',
          exit_code: 2,
        },
        status: 'fail',
      }),
    ]);

    expect(
      screen.getByRole('button', { name: /Processed 3 commands/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Ran git diff --stat/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', { name: /Running sleep 1/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Shell')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Ran git diff --stat/ }),
    );

    expect(screen.getByText('Shell')).toBeInTheDocument();
    expect(screen.getByText('$ git diff --stat')).toBeInTheDocument();
    expect(screen.getByText('Exit code 0')).toBeInTheDocument();

    const cards = container.querySelectorAll(
      '[data-slot="sandbox-shell-tool-call"]',
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveClass(
      'max-h-64',
      'bg-muted/60',
      'in-data-[density=compact]:max-h-52',
      'in-data-[density=compact]:px-2',
      'in-data-[density=spacious]:max-h-80',
      'in-data-[density=spacious]:px-4',
    );

    const command = container.querySelector(
      '[data-slot="sandbox-shell-command"]',
    );
    expect(command).toHaveClass(
      'whitespace-pre-wrap',
      'break-words',
      'text-[13px]',
      'leading-5',
      'in-data-[density=compact]:text-xs',
      'in-data-[density=compact]:leading-4',
      'in-data-[density=spacious]:text-sm',
      'in-data-[density=spacious]:leading-6',
    );

    const output = container.querySelector(
      '[data-slot="sandbox-shell-output"]',
    );
    expect(output?.parentElement).toHaveClass('overflow-auto');
    expect(output).toHaveClass(
      'whitespace-pre',
      'text-muted-foreground/85',
      'in-data-[density=compact]:text-xs',
      'in-data-[density=spacious]:text-sm',
    );
    expect(output).toHaveTextContent('4 files changed');

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
    expect(copyButtons).toHaveLength(2);
    expect(copyButtons[0]).toHaveClass(
      'opacity-0',
      'in-data-[density=compact]:h-5',
      'in-data-[density=spacious]:h-7',
    );
    fireEvent.click(copyButtons[0]);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('git diff --stat');
    });
    fireEvent.click(copyButtons[1]);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining('4 files changed'),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Ran pnpm test/ }));

    expect(
      screen.getByRole('button', { name: /Ran pnpm test/ }),
    ).not.toHaveClass('text-destructive');
    expect(screen.getByText('$ pnpm test')).toBeInTheDocument();
    expect(screen.getByText('Exit code 2')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^sandbox_shell$/ }),
    ).not.toBeInTheDocument();
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

  it('updates the running agent run duration over time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    renderAssistant([], {
      executionId: 'root-exec',
      agentRuns: [
        {
          id: 'exec-a',
          parentId: 'root-exec',
          title: 'Researcher',
          status: 'running',
          createdAt: '2026-04-24T12:24:52.898Z',
          updatedAt: '2026-04-24T12:24:52.898Z',
        },
      ],
    });

    expect(
      screen.getByRole('button', { name: /Researcher/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('1.5s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('2.5s')).toBeInTheDocument();
  });

  it('does not start an agent run duration timer without a start timestamp', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    renderAssistant([], {
      executionId: 'root-exec',
      agentRuns: [
        {
          id: 'exec-a',
          parentId: 'root-exec',
          title: 'Researcher',
          status: 'running',
        },
      ],
    });

    expect(
      screen.getByRole('button', { name: /Researcher/ }),
    ).toBeInTheDocument();
    expect(setIntervalSpy).not.toHaveBeenCalled();

    setIntervalSpy.mockRestore();
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

  it('does not render middleware executions as sub-agent groups', () => {
    renderAssistant([{ id: 'answer', type: 'text', text: 'Root answer.' }], {
      executionId: 'root-exec',
      agentRuns: [
        {
          id: 'middleware-run',
          parentId: 'root-exec',
          nodeType: 'middleware',
          agentKey: 'model-retry-node',
          title: 'Model Retry Middleware',
          status: 'success',
        },
      ],
    });

    expect(screen.getByText('Root answer.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Model Retry Middleware/ }),
    ).not.toBeInTheDocument();
  });

  it('renders middleware chat events as compact status rows', () => {
    renderAssistant([
      {
        id: 'middleware:root-exec:model-fallback-node:fallback:1',
        type: 'agent_event',
        event: 'middleware_event',
        title: 'Model fallback',
        message: 'Fallback model succeeded 1/1',
        status: 'success',
        executionId: 'root-exec',
        data: {
          type: 'middleware_event',
          middlewareName: 'ModelFallbackMiddleware',
          middlewareKey: 'model-fallback-node',
          phase: 'fallback_succeeded',
          data: {
            attempt: 1,
            totalAttempts: 1,
          },
        },
      } as any,
      { id: 'answer', type: 'text', text: 'Root answer.' },
    ]);

    const row = screen.getByTestId('middleware-event-row');
    expect(row).toHaveTextContent('Model fallback');
    expect(row).toHaveTextContent('Fallback model succeeded 1/1');
    expect(row).toHaveClass('rounded-full');
    expect(row).not.toHaveClass('rounded-md');
    expect(screen.getByText('Root answer.')).toBeInTheDocument();
  });

  it('localizes middleware chat event text from structured event data', () => {
    chatkitLanguage.value = 'zh-CN';

    renderAssistant([
      {
        id: 'middleware:root-exec:model-fallback-node:fallback:1',
        type: 'agent_event',
        event: 'middleware_event',
        title: 'Model fallback',
        message: 'Fallback model succeeded 1/1',
        status: 'success',
        executionId: 'root-exec',
        data: {
          type: 'middleware_event',
          middlewareName: 'ModelFallbackMiddleware',
          middlewareKey: 'model-fallback-node',
          phase: 'fallback_succeeded',
          data: {
            attempt: 1,
            totalAttempts: 1,
          },
        },
      } as any,
      { id: 'answer', type: 'text', text: 'Root answer.' },
    ]);

    const row = screen.getByTestId('middleware-event-row');
    expect(row).toHaveTextContent('模型回退');
    expect(row).toHaveTextContent('备用模型调用成功 1/1');
    expect(row).not.toHaveTextContent('Model fallback');
    expect(row).not.toHaveTextContent('Fallback model succeeded 1/1');
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

    renderAssistant([], {
      executionId: 'root-exec',
      agentRuns: [runWithToolName],
    });

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

  it('hides nested thread context usage artifacts inside sub-agent output', () => {
    renderAssistant(
      [
        {
          id: 'worker-text',
          type: 'text',
          text: 'Visible worker output.',
          executionId: 'usage-worker-run',
          parentExecutionId: 'root-exec',
        },
        {
          id: 'usage-raw',
          type: THREAD_CONTEXT_USAGE_EVENT_TYPE,
          threadId: 'thread-1',
          agentKey: 'Agent_UsageWorker',
          usage: { totalTokens: 120 },
          executionId: 'usage-worker-run',
          parentExecutionId: 'root-exec',
        } as any,
        {
          id: 'usage-agent-event',
          type: 'agent_event',
          event: THREAD_CONTEXT_USAGE_EVENT_TYPE,
          title: THREAD_CONTEXT_USAGE_EVENT_TYPE,
          executionId: 'usage-worker-run',
          parentExecutionId: 'root-exec',
        } as any,
        {
          ...createToolComponent('usage-component', {
            type: THREAD_CONTEXT_USAGE_EVENT_TYPE,
            title: THREAD_CONTEXT_USAGE_EVENT_TYPE,
          }),
          executionId: 'usage-worker-run',
          parentExecutionId: 'root-exec',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'usage-worker-run',
            parentId: 'root-exec',
            title: 'Usage worker',
            status: 'success',
          },
        ],
      },
    );

    const workerToggle = screen.getByRole('button', { name: /Usage worker/ });
    expect(workerToggle).toHaveAccessibleName(/1 message/);
    expect(workerToggle).not.toHaveAccessibleName(/tool/);
    expect(workerToggle).not.toHaveAccessibleName(/event/);
    expect(screen.getByText('Visible worker output.')).toBeInTheDocument();
    expect(
      screen.queryByText(THREAD_CONTEXT_USAGE_EVENT_TYPE),
    ).not.toBeInTheDocument();
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

    expect(
      screen.getByRole('button', { name: /Reply worker/ }),
    ).toHaveTextContent('Replied');
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });
});
