import { render as renderUI } from '@testing-library/react';
import {
  type ChatkitMessage,
  type TMessageComponentStep,
  type TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
import React from 'react';
import en from '../../../i18n/locales/en-US.json';
import zh from '../../../i18n/locales/zh-CN.json';
import { afterEach, beforeEach, vi } from 'vitest';
import { type AgentRunInfo } from '../../../lib/agent-runs';
import { ThemeProvider } from '../../../providers/Theme';

const chatkitLanguage = vi.hoisted(() => ({ value: 'en-US' }));
export const writeTextMock = vi.fn(() => Promise.resolve());

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
        case 'message.toolGroup.paused':
          return 'Paused';
        case 'message.toolGroup.failedCount':
          return `${count} failed`;
        case 'message.toolGroup.callStatus.running':
          return 'Running';
        case 'message.toolGroup.callStatus.success':
          return 'Completed';
        case 'message.toolGroup.callStatus.fail':
          return 'Failed';
        case 'message.toolGroup.callStatus.paused':
          return 'Paused';
        case 'message.toolGroup.detailsTitle':
          return 'Tool call details';
        case 'message.toolGroup.inputUnavailable':
          return 'Input was not recorded for this call.';
        case 'message.toolGroup.outputUnavailable':
          return 'Output was not recorded for this call.';
        case 'message.toolGroup.outputPending':
          return 'Waiting for tool output…';
        case 'message.toolGroup.outputPaused':
          return 'Paused; waiting to resume.';
        case 'message.toolGroup.emptyValue':
          return 'Empty content';
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
        case 'message.toolGroup.shell.paused':
          return 'Paused';
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
        default: {
          const path =
            key === 'message.toolGroup.callCount'
              ? `${key}_${count === 1 ? 'one' : 'other'}`
              : key;
          let value: unknown = isZh ? zh : en;
          for (const part of path.split('.'))
            value =
              value && typeof value === 'object' && part in value
                ? value[part as keyof typeof value]
                : undefined;
          if (key.startsWith('message.toolGroup.') && typeof value === 'string')
            return value.replace(/{{(\w+)}}/g, (_, name) =>
              String(values?.[name] ?? ''),
            );
          return typeof values?.defaultValue === 'string'
            ? values.defaultValue
            : key;
        }
      }
    },
  }),
}));

import { AssistantMessage, type AssistantMessageProps } from './ai';

export function render(ui: React.ReactElement) {
  return renderUI(ui, { wrapper: ThemeProvider });
}

export type AssistantChatkitMessage = ChatkitMessage & { type: 'assistant' };

type ToolComponentDataOverride = Partial<
  Omit<TMessageComponentStep, 'message' | 'title' | 'type'>
> & {
  category?: 'Tool' | 'Computer';
  type?: string;
  title?: string | Record<string, string>;
  message?: string | Record<string, string>;
};

export function createToolComponent(
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

export function createContextCompressionComponent(
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

export function renderAssistant(
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

export { chatkitLanguage };
