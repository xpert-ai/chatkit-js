import { fireEvent, screen } from '@testing-library/react';
import {
  REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION,
  REQUEST_USER_INPUT_RESULT_TYPE,
  type ChatkitMessage,
  type TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
import { describe, expect, it } from 'vitest';
import { createToolComponent, renderAssistant } from './ai.test-fixture';

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
      screen.getByRole('button', { name: /Tool calls.*1 call/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Web Search/ }));

    expect(screen.getByText('Input')).toBeInTheDocument();
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
      screen.queryByRole('button', { name: /Tool calls.*1 call/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Web Fetch')).toBeInTheDocument();
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
      screen.getByRole('button', { name: /Tool calls.*1 call/ }),
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
      screen.getByRole('button', { name: /Tool calls.*1 call/ }),
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
      screen.queryByRole('button', { name: /Tool calls.*1 call/ }),
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
      screen.queryByRole('button', { name: /Tool calls.*1 call/ }),
    ).not.toBeInTheDocument();
  });

  it('does not group across widget components', () => {
    renderAssistant([
      createToolComponent('first-tool', { title: 'First operation' }),
      {
        id: 'widget-1',
        type: 'component',
        data: {
          category: 'Tool',
          type: 'Widget',
          widgets: [],
        },
      },
      createToolComponent('second-tool', { title: 'Second operation' }),
    ]);

    const toggles = screen.getAllByRole('button', {
      name: /Tool calls.*1 call/,
    });
    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggles[0]);

    expect(screen.getByText('First operation')).toBeInTheDocument();
    expect(screen.getByText('Second operation')).toBeInTheDocument();
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
      screen.getByRole('button', { name: /Tool calls.*1 call/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('host_page_snapshot')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Tool call Completed/ }),
    ).toBeVisible();
  });

  it('uses generic grouping for historical calls without activity declarations', () => {
    renderAssistant([
      createToolComponent('read-files', { type: 'files' }),
      createToolComponent('search-code', { type: 'web_search' }),
      createToolComponent('run-command', { type: 'program' }),
    ]);

    expect(
      screen.getByRole('button', {
        name: /Tool calls.*3 calls/,
      }),
    ).toBeInTheDocument();
  });

  it('uses bounded generic details for declared commands and preserves the real exit code', () => {
    renderAssistant([
      createToolComponent('shell', {
        tool: 'sandbox_shell',
        title: 'Run command',
        status: 'fail',
        presentation: {
          version: 1,
          activity: { kind: 'command', action: 'execute' },
          target: 'pnpm test',
        },
        input: { command: 'pnpm test' },
        output: { stdout: 'line\n'.repeat(100), exit_code: 2 },
        error: 'Tests failed',
      }),
    ]);
    expect(
      screen.getByRole('button', { name: /Run commands.*1 call/ }),
    ).toBeVisible();
    expect(screen.getAllByText('Tests failed').length).toBeGreaterThan(0);
    expect(screen.getByText('exit_code:')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.queryByText('sandbox_shell')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'View full content' }).length,
    ).toBeGreaterThan(0);
  });
});
