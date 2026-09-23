import { describe, expect, it } from 'vitest';
import type { AssistantMessageWithAgentRuns } from './agent-run-render-tree';
import {
  getAssistantPresentation,
  getFinalAnswerText,
  groupAssistantProcessMessages,
} from './assistant-presentation';

const reply = (
  content: AssistantMessageWithAgentRuns['content'],
  extra: Partial<AssistantMessageWithAgentRuns> = {},
): AssistantMessageWithAgentRuns => ({
  id: 'a',
  type: 'assistant',
  status: 'success',
  executionId: 'root',
  content,
  ...extra,
});
const tool = {
  type: 'component' as const,
  data: { category: 'Tool', type: 'tool', status: 'success', tool: 'search' },
};

describe('assistant presentation', () => {
  it('splits at the last process step and retains every final paragraph and image', () => {
    const message = reply([
      { type: 'text', text: 'First progress' },
      tool,
      { type: 'text', text: 'Second progress' },
      tool,
      { type: 'text', text: 'Final paragraph one' },
      { type: 'text', text: 'Final paragraph two' },
      { type: 'image_url', image_url: 'https://example.com/result.png' },
    ]);
    const result = getAssistantPresentation(message);
    expect(result.process).toHaveLength(4);
    expect(result.answer).toHaveLength(3);
    expect(getFinalAnswerText(message)).toBe(
      'Final paragraph one\n\nFinal paragraph two',
    );
  });

  it('keeps final rich outputs visible', () => {
    const result = getAssistantPresentation(
      reply([
        tool,
        { type: 'text', text: 'Final' },
        { type: 'component', data: { type: 'Widget', widgets: [] } },
        { type: 'component', data: { type: 'McpApp' } },
      ]),
    );
    expect(result.process).toHaveLength(1);
    expect(result.answer).toHaveLength(3);
  });

  it('folds generic successful tool steps without a display subtype', () => {
    const result = getAssistantPresentation(
      reply([
        { type: 'text', text: 'Progress' },
        {
          type: 'component',
          data: { category: 'Tool', status: 'success', tool: 'read' },
        },
        { type: 'text', text: 'Final' },
      ]),
    );
    expect(result.canSeparate).toBe(true);
    expect(result.process).toHaveLength(2);
    expect(result.answer).toHaveLength(1);
  });

  it('does not manufacture a final answer from tool-only or child-only output', () => {
    expect(
      getAssistantPresentation(
        reply([{ type: 'text', text: 'Progress' }, tool]),
      ).canSeparate,
    ).toBe(false);
    expect(
      getAssistantPresentation(
        reply([
          {
            type: 'text',
            text: 'Child result',
            executionId: 'child',
            parentExecutionId: 'root',
          },
        ]),
      ).canSeparate,
    ).toBe(false);
  });

  it('retains historical root classification and puts child output in the process', () => {
    const result = getAssistantPresentation(
      reply(
        [
          {
            type: 'text',
            text: 'Child',
            executionId: 'child',
            parentExecutionId: 'old-root',
          },
          { type: 'text', text: 'Root final', executionId: 'old-root' },
        ],
        { executionId: undefined, historical: true },
      ),
    );
    expect(result.process.map((unit) => unit.type)).toEqual(['agent']);
    expect(result.answer.map((unit) => unit.type)).toEqual(['entry']);
  });

  it.each([
    { type: 'Widget', category: 'Tool', status: 'success' },
    { type: 'McpApp', category: 'Tool', status: 'success' },
    { type: 'approval' },
    { type: 'approval', category: 'Tool', status: 'success' },
    { type: 'iframe', category: 'Tool', status: 'success' },
    { type: 'custom-interaction', category: 'Tool', status: 'success' },
    { type: 'tool', category: 'Tool', status: 'fail' },
    { type: 'tool', category: 'Tool', status: 'pending' },
    { type: 'tool', category: 'Tool', status: 'running' },
    { type: 'tool', category: 'Tool', status: 'success', error: 'Tool failed' },
    {
      type: 'tool',
      category: 'Tool',
      status: 'success',
      tool: 'request_user_input',
    },
  ])('never folds interactive or unsuccessful process content: %j', (data) => {
    expect(
      getAssistantPresentation(
        reply([
          { type: 'component', data },
          tool,
          { type: 'text', text: 'Final' },
        ]),
      ).canSeparate,
    ).toBe(false);
  });

  it('allows ordinary running tools only while the answer is unfinished', () => {
    const content = [
      {
        type: 'component' as const,
        data: { ...tool.data, type: 'program', status: 'running' },
      },
      { type: 'text' as const, text: 'Current response' },
    ];
    expect(
      getAssistantPresentation(reply(content, { status: 'answering' }))
        .canSeparate,
    ).toBe(true);
    expect(getAssistantPresentation(reply(content)).canSeparate).toBe(false);
    expect(
      getFinalAnswerText(reply(content, { status: 'error' })),
    ).toBeUndefined();
  });

  it('uses recorded execution duration, never message timestamps', () => {
    const content = [tool, { type: 'text' as const, text: 'Final' }];
    expect(getAssistantPresentation(reply(content)).durationMs).toBeUndefined();
    expect(
      getAssistantPresentation(
        reply(content, { agentRuns: [{ id: 'root', elapsedTime: 189000 }] }),
      ).durationMs,
    ).toBe(189000);
  });

  it('uses the explicit root snapshot in a branch without rendering a root agent card', () => {
    const result = getAssistantPresentation(
      reply(
        [tool, { type: 'text', text: 'Final', executionId: 'original-root' }],
        {
          historical: true,
          executionId: undefined,
          agentRuns: [
            {
              id: 'original-root',
              isRoot: true,
              elapsedTime: 479000,
              status: 'success',
            },
          ],
        },
      ),
    );
    expect(result.durationMs).toBe(479000);
    expect(result.process).toHaveLength(1);
    expect(result.answer).toHaveLength(1);
    expect(result.answer[0].type).toBe('entry');
  });

  it('groups same-turn AI and tool records without changing their IDs', () => {
    const messages = [
      reply('Question', { type: 'user', id: 'h' }),
      reply('Progress', { id: 'p' }),
      reply('Tool result', { type: 'tool', id: 't' }),
      reply('Final', { id: 'f' }),
    ];
    expect([...groupAssistantProcessMessages(messages)]).toEqual([[3, [1, 2]]]);
    expect(messages.map((message) => message.id)).toEqual(['h', 'p', 't', 'f']);
  });

  it('does not cross human inputs, missing page prefixes or unrelated executions', () => {
    expect(
      groupAssistantProcessMessages([reply('Progress'), reply('Final')]).size,
    ).toBe(0);
    const human = reply('Question', { type: 'user' });
    expect(
      groupAssistantProcessMessages([
        human,
        reply('Answer'),
        human,
        reply('Answer'),
      ]).size,
    ).toBe(0);
    expect(
      groupAssistantProcessMessages([
        human,
        reply('Progress', { executionId: 'other' }),
        reply('Final'),
      ]).size,
    ).toBe(0);
    expect(
      groupAssistantProcessMessages([
        human,
        reply('Progress', { status: 'error' }),
        reply('Final'),
      ]).size,
    ).toBe(0);
  });

  it('recognizes explicit resume lineage', () => {
    const messages = [
      reply('Question', { type: 'user' }),
      reply('Earlier', { executionId: 'original' }),
      reply('Final', { rootExecutionIds: ['original'] }),
    ];
    expect([...groupAssistantProcessMessages(messages)]).toEqual([[2, [1]]]);
  });

  it.each([undefined, 'answering', 'running', 'unknown'])(
    'keeps prior assistant records with status %s visible',
    (status) => {
      expect(
        groupAssistantProcessMessages([
          reply('Question', { type: 'user' }),
          reply('Earlier', { status }),
          reply('Final'),
        ]).size,
      ).toBe(0);
    },
  );
});
