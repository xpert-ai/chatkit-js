import { describe, expect, it, vi } from 'vitest';
import { ChatMessageEventTypeEnum } from '@xpert-ai/chatkit-types';
import {
  createLangGraphEventState,
  mapLangGraphEventToChatKit,
} from './langGraphEventMapper';
describe('tool lifecycle correlation', () => {
  it.each([
    [ChatMessageEventTypeEnum.ON_TOOL_START, 'lg.tool.start'],
    [ChatMessageEventTypeEnum.ON_TOOL_END, 'lg.tool.end'],
    [ChatMessageEventTypeEnum.ON_TOOL_ERROR, 'lg.tool.error'],
  ])('preserves call and conversation identity for %s', (eventType, name) => {
    const sendEvent = vi.fn();
    mapLangGraphEventToChatKit({
      eventType,
      data: {
        name: 'uose-queryEntities',
        tool_call_id: 'call-1',
        error: 'failed',
      },
      state: createLangGraphEventState(),
      context: { threadId: 'conversation-1' },
      executionId: 'run-1',
      sendEvent,
    });
    expect(sendEvent).toHaveBeenCalledWith('public_event', [
      'log',
      expect.objectContaining({
        name,
        data: expect.objectContaining({
          toolCallId: 'call-1',
          threadId: 'conversation-1',
        }),
      }),
    ]);
  });
});
