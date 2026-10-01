import { describe, expect, it } from 'vitest';
import {
  createAssistantThreadPayload,
  createConversationPayload,
  shouldBroadcastThreadChange,
  withConversationScope,
} from '../../Stream';

describe('assistant thread creation', () => {
  it('binds generated threads to the current assistant', () => {
    expect(createAssistantThreadPayload('assistant-1')).toEqual({
      assistantId: 'assistant-1',
    });
  });

  it('binds caller-provided thread ids to the current assistant', () => {
    expect(createAssistantThreadPayload('assistant-1', 'thread-1')).toEqual({
      assistantId: 'assistant-1',
      threadId: 'thread-1',
      ifExists: 'raise',
    });
  });
});

describe('conversation scope', () => {
  it('does not synthesize an allowlist when no runtime capability is selected', () => {
    expect(
      withConversationScope({ input: { input: 'Hello' } }, undefined, []),
    ).toEqual({
      input: { input: 'Hello', runtimeCapabilities: undefined },
      projectId: undefined,
    });
  });

  it('injects the selected Project and Connector binding ids into sends', () => {
    expect(
      withConversationScope(
        {
          input: {
            input: 'Hello',
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: { ids: ['skill-1'] },
              plugins: { nodeKeys: [] },
              connectors: { bindingIds: ['untrusted-binding'] },
            },
          },
          projectId: 'untrusted-project',
        },
        'project-1',
        ['binding-1', 'binding-1', 'binding-2'],
      ),
    ).toEqual({
      input: {
        input: 'Hello',
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { ids: ['skill-1'] },
          plugins: { nodeKeys: [] },
          connectors: { bindingIds: ['binding-1', 'binding-2'] },
        },
      },
      projectId: 'project-1',
    });
  });

  it('inherits normal capabilities when Connectors are the only selection', () => {
    expect(
      withConversationScope({ input: { input: 'Hello' } }, 'project-1', [
        'binding-1',
      ]),
    ).toEqual({
      input: {
        input: 'Hello',
        runtimeCapabilities: {
          mode: 'allowlist',
          inheritUnselected: true,
          skills: { ids: [] },
          plugins: { nodeKeys: [] },
          connectors: { bindingIds: ['binding-1'] },
        },
      },
      projectId: 'project-1',
    });
  });

  it('creates the conversation payload after a thread id is known', () => {
    expect(
      createConversationPayload('thread-1', 'xpert-1', 'project-1', [
        'binding-1',
      ]),
    ).toEqual({
      threadId: 'thread-1',
      xpertId: 'xpert-1',
      projectId: 'project-1',
      options: {
        runtimeCapabilities: {
          mode: 'allowlist',
          inheritUnselected: true,
          skills: { ids: [] },
          plugins: { nodeKeys: [] },
          connectors: { bindingIds: ['binding-1'] },
        },
      },
    });
  });
});

describe('shouldBroadcastThreadChange', () => {
  it('skips the initial empty thread notification during mount', () => {
    expect(
      shouldBroadcastThreadChange({
        threadId: null,
        hasObservedThreadSelection: false,
      }),
    ).toBe(false);
  });

  it('treats blank strings as an empty thread during the initial mount', () => {
    expect(
      shouldBroadcastThreadChange({
        threadId: '   ',
        hasObservedThreadSelection: false,
      }),
    ).toBe(false);
  });

  it('broadcasts the first real thread selection', () => {
    expect(
      shouldBroadcastThreadChange({
        threadId: 'thread-1',
        hasObservedThreadSelection: false,
      }),
    ).toBe(true);
  });

  it('still broadcasts a later reset back to no thread after a real thread existed', () => {
    expect(
      shouldBroadcastThreadChange({
        threadId: null,
        hasObservedThreadSelection: true,
      }),
    ).toBe(true);
  });
});
