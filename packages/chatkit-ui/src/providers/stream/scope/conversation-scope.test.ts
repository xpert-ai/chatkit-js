import { describe, expect, it } from 'vitest';
import { buildInjectedRequestOptions } from '../../../lib/request-options';
import type {
  TChatRequestHuman,
  TXpertChatResumeRequest,
} from '@xpert-ai/chatkit-types';
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
  it('keeps selected connectors in the injected human state consumed by the backend', () => {
    const humanInput: TChatRequestHuman = {
      input: 'Read my GitHub issue',
      runtimeCapabilities: {
        mode: 'allowlist',
        skills: { ids: ['skill-1'] },
        plugins: { nodeKeys: ['plugin-1'] },
        subAgents: { nodeKeys: ['agent-1'] },
      },
    };
    const requestOptions = buildInjectedRequestOptions({
      defaults: { state: { human: { customerId: 'customer-1' }, locale: 'en' } },
      humanInput,
    });

    const result = withConversationScope(
      { input: humanInput, state: requestOptions.state },
      'project-1',
      ['github-1'],
    );

    expect(result).toMatchObject({
      projectId: 'project-1',
      input: {
        runtimeCapabilities: { connectors: { bindingIds: ['github-1'] } },
      },
      state: {
        locale: 'en',
        human: {
          input: 'Read my GitHub issue',
          customerId: 'customer-1',
          runtimeCapabilities: {
            mode: 'allowlist',
            skills: { ids: ['skill-1'] },
            plugins: { nodeKeys: ['plugin-1'] },
            subAgents: { nodeKeys: ['agent-1'] },
            connectors: { bindingIds: ['github-1'] },
          },
        },
      },
    });
    expect(
      requestOptions.state?.human?.runtimeCapabilities?.connectors,
    ).toBeUndefined();
  });

  it('does not synthesize an allowlist when no runtime capability is selected', () => {
    expect(
      withConversationScope({ input: { input: 'Hello' } }, undefined, []),
    ).toEqual({
      input: { input: 'Hello', runtimeCapabilities: undefined },
      projectId: undefined,
    });
  });

  it('clears stale connectors from both human representations without losing other selections', () => {
    const humanInput: TChatRequestHuman = {
      input: 'Continue without GitHub',
      runtimeCapabilities: {
        mode: 'allowlist',
        skills: { ids: ['skill-1'] },
        plugins: { nodeKeys: ['plugin-1'] },
        subAgents: { nodeKeys: ['agent-1'] },
        connectors: { bindingIds: ['github-old'] },
      },
    };
    const result = withConversationScope(
      {
        input: humanInput,
        state: { human: humanInput, locale: 'en' },
      },
      'project-1',
      [],
    );
    const expectedHuman = {
      ...humanInput,
      runtimeCapabilities: {
        ...humanInput.runtimeCapabilities,
        connectors: undefined,
      },
    };

    expect(result).toEqual({
      projectId: 'project-1',
      input: expectedHuman,
      state: { human: expectedHuman, locale: 'en' },
    });
    expect(humanInput.runtimeCapabilities?.connectors).toEqual({
      bindingIds: ['github-old'],
    });
  });

  it('preserves the capability policy injected by the host in human state', () => {
    const inputCapabilities = {
      mode: 'allowlist' as const,
      skills: { ids: ['input-skill'] },
      plugins: { nodeKeys: [] },
    };
    const stateCapabilities = {
      mode: 'allowlist' as const,
      inheritUnselected: true,
      skills: { ids: ['host-skill'] },
      plugins: { nodeKeys: ['host-plugin'] },
      subAgents: { nodeKeys: ['host-agent'] },
    };
    const expectedCapabilities = {
      ...stateCapabilities,
      connectors: { bindingIds: ['github-1'] },
    };

    expect(
      withConversationScope(
        {
          input: { input: 'Hello', runtimeCapabilities: inputCapabilities },
          state: {
            human: { input: 'Hello', runtimeCapabilities: stateCapabilities },
            locale: 'en',
          },
        },
        undefined,
        ['github-1'],
      ),
    ).toEqual({
      projectId: undefined,
      input: { input: 'Hello', runtimeCapabilities: expectedCapabilities },
      state: {
        human: { input: 'Hello', runtimeCapabilities: expectedCapabilities },
        locale: 'en',
      },
    });
  });

  it('keeps unrelated state without introducing a partial human value', () => {
    expect(
      withConversationScope(
        { input: { input: 'Hello' }, state: { locale: 'en' } },
        undefined,
        ['github-1'],
      ),
    ).toEqual({
      projectId: undefined,
      input: {
        input: 'Hello',
        runtimeCapabilities: {
          mode: 'allowlist',
          inheritUnselected: true,
          skills: { ids: [] },
          plugins: { nodeKeys: [] },
          connectors: { bindingIds: ['github-1'] },
        },
      },
      state: { locale: 'en' },
    });
  });

  it('leaves explicit resume requests with their existing execution scope', () => {
    const request: TXpertChatResumeRequest = {
      action: 'resume',
      conversationId: 'conversation-1',
      target: { executionId: 'execution-1' },
      decision: { type: 'confirm' },
    };
    expect(withConversationScope(request, 'project-1', ['github-1'])).toBe(
      request,
    );
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
