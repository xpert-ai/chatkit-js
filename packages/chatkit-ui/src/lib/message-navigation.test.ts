import { describe, expect, it } from 'vitest';
import {
  changesReceipt,
  deliveryReceipt,
  legacyReceipt,
} from '../test/file-activity-fixtures';

import {
  buildMessageNavigationItem,
  buildMessageNavigationItems,
  type MessageNavigationLabels,
} from './message-navigation';

const labels: MessageNavigationLabels = {
  user: 'You',
  assistant: 'Assistant',
  system: 'System',
  tool: 'Tool',
  event: 'Event',
  message: 'Message',
  image: 'Image',
  memory: 'Memory',
  widget: 'Widget',
  mcpApp: 'MCP App',
  attachment: 'Attachment',
  reference: 'Reference',
  capability: 'Capability',
  reasoning: 'Reasoning',
};

describe('message navigation extraction', () => {
  it('keeps external assistant navigation sourced to its visible card', () => {
    const item = buildMessageNavigationItem(
      {
        id: 'reply',
        type: 'assistant',
        executionId: 'root',
        agentRuns: [
          {
            id: 'child',
            parentId: 'root',
            invocationKind: 'external_assistant',
            xpertName: 'Reviewer',
          },
        ],
        content: [
          { type: 'text', text: 'Visible parent answer', executionId: 'root' },
          {
            type: 'text',
            text: 'Hidden child transcript',
            executionId: 'child',
          },
        ],
      },
      0,
      { labels, mode: 'bubbles' },
    );
    expect(item?.preview).toBe('Visible parent answer');
    expect(item?.tags).toEqual(['Reviewer']);
  });
  it('uses visible bubble text and excludes hidden reasoning / tools from navigation', () => {
    const message = {
      id: 'a',
      type: 'assistant',
      content: [
        { type: 'text', text: 'Visible answer' },
        {
          type: 'component',
          data: {
            category: 'Tool',
            title: 'Hidden tool',
            output: 'Hidden output',
          },
        },
      ],
      reasoning: [{ type: 'reasoning', text: 'Hidden reasoning' }],
    };
    const item = buildMessageNavigationItem(message, 0, {
      labels,
      mode: 'bubbles',
    });
    expect(item?.preview).toBe('Visible answer');
    expect(item?.tags).toEqual([]);
    expect(
      buildMessageNavigationItem(
        { id: 't', type: 'tool', content: 'Hidden output' },
        1,
        { labels, mode: 'bubbles' },
      ),
    ).toBeNull();
  });
  it('retains a navigation target for a resultless but completed bubble reply', () => {
    const items = buildMessageNavigationItems(
      [
        { id: 'q', type: 'user', content: 'Run a check' },
        { id: 'a', type: 'assistant', status: 'success', content: [] },
      ],
      { labels, mode: 'bubbles' },
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'q',
      title: 'Run a check',
      preview: 'Assistant',
    });
  });
  it('summarizes the correlated execution instead of its dispatch, with a legacy fallback', () => {
    const message = {
      id: 'reply',
      type: 'assistant',
      executionId: 'root',
      content: [
        {
          id: 'call',
          type: 'component',
          executionId: 'root',
          data: { category: 'Tool', status: 'success', title: 'Dispatch task' },
        },
      ],
      agentRuns: [
        {
          id: 'child',
          parentId: 'root',
          sourceToolCallId: 'call',
          invocationKind: 'external_assistant' as const,
          xpertName: 'Reviewer',
        },
      ],
    };
    const item = buildMessageNavigationItem(message, 0, { labels });
    expect(item?.tags).toEqual(['Reviewer']);
    expect(item?.preview).not.toContain('Dispatch task');
    const legacy = buildMessageNavigationItem(
      { ...message, agentRuns: [] },
      0,
      { labels },
    );
    expect(legacy?.preview).toContain('Dispatch task');
  });
  it('excludes new and legacy file receipts from navigation text and tags', () => {
    const plain = {
      id: 'reply',
      type: 'ai',
      content: [{ type: 'text', text: 'Your report is ready.' }],
    };
    expect(
      buildMessageNavigationItem(
        {
          ...plain,
          content: [
            ...plain.content,
            changesReceipt,
            deliveryReceipt,
            legacyReceipt,
          ],
        },
        0,
        { labels },
      ),
    ).toEqual(buildMessageNavigationItem(plain, 0, { labels }));
  });
  it('builds one navigation item for each user and assistant message pair', () => {
    const items = buildMessageNavigationItems(
      [
        {
          id: 'human-1',
          type: 'human',
          content: 'Can you inspect the options file?',
          fileAssets: [{ originalName: 'options.ts' }],
        },
        {
          id: 'assistant-1',
          type: 'ai',
          content: [
            {
              type: 'text',
              text: 'I checked options.ts and found the messageNavigation option.',
            },
            {
              id: 'tool-1',
              type: 'component',
              data: {
                category: 'Tool',
                type: 'file',
                title: 'read_file',
                message: 'Read options.ts',
                status: 'success',
              },
            },
          ],
        },
      ],
      { labels },
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'human-1',
      messageId: 'human-1',
      role: 'user',
      title: 'Can you inspect the options file?',
      preview: 'I checked options.ts and found the messageNavigation option.',
    });
    expect(items[0].tags).toEqual(
      expect.arrayContaining(['Read options.ts', 'options.ts']),
    );
  });

  it('extracts human text, files, references, and runtime capability tags', () => {
    const item = buildMessageNavigationItem(
      {
        id: 'human-1',
        type: 'human',
        content: 'Please inspect these files.',
        fileAssets: [{ originalName: 'README.md' }],
        attachments: [{ name: 'diagram.png' }],
        references: [
          {
            type: 'code',
            path: 'src/app.ts',
            startLine: 10,
            endLine: 12,
            text: 'const app = createApp()',
          },
        ],
        runtimeCapabilityOptions: [{ label: 'Plan Mode' }],
      },
      0,
      { labels },
    );

    expect(item).toMatchObject({
      id: 'human-1',
      messageId: 'human-1',
      role: 'user',
      title: 'You',
      preview: 'Please inspect these files.',
    });
    expect(item?.tags).toEqual(
      expect.arrayContaining([
        'README.md',
        'diagram.png',
        'app.ts 10-12',
        'Plan Mode',
      ]),
    );
  });

  it('extracts assistant text, reasoning, tools, widgets, and MCP app tags', () => {
    const item = buildMessageNavigationItem(
      {
        id: 'assistant-1',
        type: 'assistant',
        content: [
          { type: 'text', text: 'I found the relevant files.' },
          {
            id: 'tool-1',
            type: 'component',
            data: {
              category: 'Tool',
              type: 'file',
              title: 'read_file',
              message: 'Read README.md',
              status: 'success',
            },
          },
          {
            id: 'widget-1',
            type: 'component',
            data: {
              type: 'Widget',
              mode: 'inline',
              widgets: [{ name: 'Sales Dashboard' }],
            },
          },
          {
            id: 'mcp-1',
            type: 'component',
            data: {
              type: 'McpApp',
              appInstanceId: 'app-1',
              resourceUri: 'ui://tool/result',
              toolName: 'inspect_repo',
              title: { en_US: 'Repo Inspector', zh_Hans: '仓库检查器' },
              description: 'Interactive inspection result',
            },
          },
        ],
        reasoning: [{ type: 'reasoning', text: 'Need to inspect first.' }],
      },
      1,
      { labels, assistantTitle: 'Code Assistant', language: 'en-US' },
    );

    expect(item).toMatchObject({
      id: 'assistant-1',
      role: 'assistant',
      title: 'Code Assistant',
      preview: expect.stringContaining('I found the relevant files.'),
    });
    expect(item?.tags).toEqual(
      expect.arrayContaining([
        'Read README.md',
        'Sales Dashboard',
        'Repo Inspector',
        'Reasoning',
      ]),
    );
  });

  it('ignores empty messages and internal thread context usage artifacts', () => {
    const items = buildMessageNavigationItems(
      [
        {
          id: 'human-1',
          type: 'human',
          content: 'Only include this if an assistant answer follows.',
        },
        {
          id: 'internal-1',
          type: 'assistant',
          content: [
            {
              type: 'thread_context_usage',
              threadId: 'thread-1',
              agentKey: 'agent',
              usage: { totalTokens: 100 },
            },
          ],
        },
        {
          id: 'empty-1',
          type: 'assistant',
          content: '',
        },
      ],
      { labels },
    );

    expect(items).toEqual([]);
  });

  it('uses localized labels and localized MCP app titles', () => {
    const zhLabels: MessageNavigationLabels = {
      ...labels,
      user: '你',
      assistant: '助手',
      system: '系统',
    };
    const item = buildMessageNavigationItem(
      {
        id: 'mcp-zh',
        type: 'assistant',
        content: [
          {
            id: 'mcp-zh-component',
            type: 'component',
            data: {
              type: 'McpApp',
              appInstanceId: 'app-zh',
              resourceUri: 'ui://tool/result',
              toolName: 'inspect_repo',
              title: { en_US: 'Repo Inspector', zh_Hans: '仓库检查器' },
            },
          },
        ],
      },
      0,
      { labels: zhLabels, language: 'zh-Hans' },
    );

    expect(item?.title).toBe('助手');
    expect(item?.tags).toContain('仓库检查器');
  });
});
