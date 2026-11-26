import { describe, expect, it, vi } from 'vitest';
import { emitToolComponentEvent } from './tool-component-events';
const context = { threadId: 'branch-1', conversationId: 'conversation-1' };
const component = {
  type: 'component',
  id: 'call-1',
  executionId: 'run-1',
  data: {
    category: 'Tool',
    toolPresentation: 'redacted',
    tool: 'uose-queryEntities',
    status: 'running',
    input: { private: 'not forwarded' },
  },
};
describe('public tool lifecycle', () => {
  it.each([
    ['running', 'lg.tool.start'],
    ['success', 'lg.tool.end'],
    ['fail', 'lg.tool.error'],
  ])('correlates %s without forwarding previews', (status, name) => {
    const sendEvent = vi.fn();
    emitToolComponentEvent(
      { ...component, data: { ...component.data, status } },
      context,
      sendEvent,
    );
    expect(sendEvent).toHaveBeenCalledWith('public_event', [
      'log',
      {
        name,
        data: {
          toolCallId: 'call-1',
          toolName: 'uose-queryEntities',
          runId: 'run-1',
          threadId: 'branch-1',
          conversationId: 'conversation-1',
        },
      },
    ]);
  });
  it('ignores native widgets and refuses to guess a conversation from its thread', () => {
    const sendEvent = vi.fn();
    emitToolComponentEvent(
      { ...component, data: { ...component.data, category: 'Computer' } },
      context,
      sendEvent,
    );
    emitToolComponentEvent(component, { threadId: 'branch-1' }, sendEvent);
    expect(sendEvent).not.toHaveBeenCalled();
  });
});
