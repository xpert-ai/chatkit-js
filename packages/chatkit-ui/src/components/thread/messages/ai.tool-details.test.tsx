import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION,
  REQUEST_USER_INPUT_RESULT_TYPE,
  type ChatkitMessage,
  type TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
import { describe, expect, it } from 'vitest';
import {
  createToolComponent,
  renderAssistant,
  writeTextMock,
} from './ai.test-fixture';

describe('AssistantMessage tool components', () => {
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
        ],
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
      'text-[0.8125rem]',
      'line-clamp-2',
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
    expect(copyButtons[0]).toHaveClass('opacity-0', 'rounded-chat-item');
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
});
