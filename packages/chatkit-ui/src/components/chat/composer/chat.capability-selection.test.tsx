import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  insertComposerText,
  mocks,
  placeComposerCaretAtEnd,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat runtime capability selection', () => {
  setupChatTest();
  it('loads runtime capabilities through the SDK client and submits the default allow-list', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-default',
            workspaceId: 'workspace-1',
            label: 'Default Skill',
            default: true,
          },
        ],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
            meta: {
              icon: {
                type: 'svg',
                value:
                  '<svg viewBox="0 0 16 16"><path d="M2 2h12v12H2z" /></svg>',
              },
            },
          },
        ],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        mocks.stream.client.assistants.getRuntimeCapabilities,
      ).toHaveBeenCalledWith(
        'assistant-1',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.getByTestId('selected-skills')).toHaveTextContent(
        'skill-default',
      ),
    );
    expect(
      document.querySelector('[data-slot="composer-body"]'),
    ).not.toHaveTextContent('Default Skill');

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('contenteditable', 'true');
    setComposerText(textarea, 'hello');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'hello',
          runtimeCapabilities: {
            mode: 'allowlist',
            skills: {
              workspaceId: 'workspace-1',
              ids: ['skill-default'],
            },
            plugins: {
              nodeKeys: [],
            },
            subAgents: {
              nodeKeys: [],
            },
          },
        },
        state: {
          human: {
            input: 'hello',
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: {
                workspaceId: 'workspace-1',
                ids: ['skill-default'],
              },
              plugins: {
                nodeKeys: [],
              },
              subAgents: {
                nodeKeys: [],
              },
            },
          },
        },
      }),
      expect.any(Object),
    );
  });

  it('merges runtime command capability selections into submitted prompts', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-review',
            workspaceId: 'workspace-1',
            label: 'Review Skill',
          },
        ],
        plugins: [],
        subAgents: [],
        commands: [
          {
            name: 'review',
            label: 'Review',
            kind: 'prompt_workflow',
            workflow: {
              type: 'prompt_workflow',
              name: 'review',
              label: 'Review',
              description: 'Review the current target',
              tags: ['quality'],
            },
            action: {
              type: 'submit_prompt',
              template: 'Review this: {{args}}',
              runtimeCapabilities: {
                mode: 'allowlist',
                skills: { workspaceId: 'workspace-1', ids: ['skill-review'] },
                plugins: { nodeKeys: [] },
                subAgents: { nodeKeys: [] },
              },
            },
          },
        ],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/review src/app.ts');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit.mock.calls[0][0].input).toEqual({
      input: 'Review this: src/app.ts',
      runtimeCapabilities: {
        mode: 'allowlist',
        skills: { workspaceId: 'workspace-1', ids: ['skill-review'] },
        plugins: { nodeKeys: [] },
        subAgents: { nodeKeys: [] },
        recommended: {
          skills: { workspaceId: 'workspace-1', ids: ['skill-review'] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        },
      },
      commandSource: {
        type: 'slash_command',
        name: 'review',
        source: 'runtime',
        executionType: 'submit_prompt',
        kind: 'prompt_workflow',
        workflow: {
          type: 'prompt_workflow',
          name: 'review',
          label: 'Review',
          description: 'Review the current target',
          tags: ['quality'],
        },
      },
    });
  });

  it('opens a skill-only selector from the /skills command', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-review',
            workspaceId: 'workspace-1',
            label: 'Review Skill',
          },
        ],
        plugins: [
          {
            nodeKey: 'plugin-search',
            provider: 'search',
            label: 'Search Plugin',
          },
        ],
        subAgents: [],
        commands: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/skills');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    expect(mocks.stream.submit).not.toHaveBeenCalled();
    expect(screen.getByText('Review Skill')).toBeInTheDocument();
    expect(screen.queryByText('Search Plugin')).not.toBeInTheDocument();
  });

  it('opens a plugin-only selector from the localized slash palette item', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-review',
            workspaceId: 'workspace-1',
            label: 'Review Skill',
          },
        ],
        plugins: [
          {
            nodeKey: 'plugin-search',
            provider: 'search',
            label: 'Search Plugin',
          },
        ],
        subAgents: [],
        commands: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/');
    fireEvent.mouseDown(screen.getByText('Localized Plugins'));

    await waitFor(() =>
      expect(screen.getByText('Search Plugin')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Review Skill')).not.toBeInTheDocument();
    expect(screen.getByText('Localized Plan')).toBeInTheDocument();
    expect(
      screen.getByText('Localized Plugins').closest('button'),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Search Plugin').closest('button')).toHaveAttribute(
      'data-depth',
      '1',
    );
  });

  it('shows a specific empty state for slash capability panels', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-review',
            workspaceId: 'workspace-1',
            label: 'Review Skill',
          },
        ],
        plugins: [],
        subAgents: [],
        commands: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/');
    fireEvent.mouseDown(screen.getByText('Localized Plugins'));

    await waitFor(() =>
      expect(
        screen.getByText('No localized plugins to add'),
      ).toBeInTheDocument(),
    );
  });

  it('hydrates session runtime capabilities from the active conversation options', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-default',
            workspaceId: 'workspace-1',
            label: 'Default Skill',
            default: true,
          },
        ],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
          },
        ],
        subAgents: [
          {
            nodeKey: 'researcher',
            type: 'agent',
            label: 'Researcher',
          },
        ],
      },
    );
    mocks.stream.client.conversations.search.mockResolvedValueOnce({
      items: [
        {
          id: 'conversation-1',
          threadId: 'thread-1',
          options: {
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: { workspaceId: 'workspace-1', ids: [] },
              plugins: { nodeKeys: ['middleware-1'] },
              subAgents: { nodeKeys: ['researcher'] },
            },
          },
        },
      ],
    });

    renderChat();

    await waitFor(() =>
      expect(screen.getByTestId('selected-plugins')).toHaveTextContent(
        'middleware-1',
      ),
    );
    expect(screen.getByTestId('selected-sub-agents')).toHaveTextContent(
      'researcher',
    );
    expect(mocks.stream.client.conversations.search).toHaveBeenCalledWith({
      where: {
        threadId: 'thread-1',
        xpertId: 'assistant-1',
      },
      limit: 1,
    });
  });

  it('persists session capability toggles without replacing other conversation options', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
          },
        ],
        subAgents: [
          {
            nodeKey: 'researcher',
            type: 'agent',
            label: 'Researcher',
          },
        ],
      },
    );
    mocks.stream.client.conversations.search.mockResolvedValue({
      items: [
        {
          id: 'conversation-1',
          threadId: 'thread-1',
          options: {
            parameters: { input: 'hello' },
            features: ['files'],
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: { ids: [] },
              plugins: { nodeKeys: ['middleware-1'] },
              subAgents: { nodeKeys: [] },
            },
          },
        },
      ],
    });

    renderChat();

    await waitFor(() =>
      expect(screen.getByTestId('selected-plugins')).toHaveTextContent(
        'middleware-1',
      ),
    );
    fireEvent.click(screen.getByTestId('clear-plugin'));

    await waitFor(() =>
      expect(mocks.stream.client.conversations.update).toHaveBeenCalledWith(
        'conversation-1',
        {
          options: {
            parameters: { input: 'hello' },
            features: ['files'],
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: { ids: [] },
              plugins: { nodeKeys: [] },
              subAgents: { nodeKeys: [] },
            },
          },
        },
      ),
    );

    fireEvent.click(screen.getByTestId('select-sub-agent'));

    await waitFor(() =>
      expect(mocks.stream.client.conversations.update).toHaveBeenLastCalledWith(
        'conversation-1',
        expect.objectContaining({
          options: expect.objectContaining({
            parameters: { input: 'hello' },
            runtimeCapabilities: expect.objectContaining({
              subAgents: { nodeKeys: ['researcher'] },
            }),
          }),
        }),
      ),
    );
  });

  it('submits composer-selected capabilities as available without human message chips', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
          },
        ],
        subAgents: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    fireEvent.click(screen.getByTestId('select-plugin'));
    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, 'run it');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(
      mocks.stream.submit.mock.calls[0][0].input.runtimeCapabilities,
    ).toEqual({
      mode: 'allowlist',
      skills: { ids: [] },
      plugins: { nodeKeys: ['middleware-1'] },
      subAgents: { nodeKeys: [] },
    });

    const optimisticValues =
      mocks.stream.submit.mock.calls[0][1].optimisticValues?.({
        messages: [],
      });
    expect(optimisticValues?.messages[0].runtimeCapabilityOptions).toBe(
      undefined,
    );
  });

  it('keeps composer-available capabilities selectable from the slash palette', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
          },
        ],
        subAgents: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    fireEvent.click(screen.getByTestId('select-plugin'));
    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/sand');

    const palette = document.querySelector('[data-slot="slash-palette"]');
    if (!(palette instanceof HTMLElement))
      throw new Error('Missing slash palette');
    expect(within(palette).getByText('Sandbox')).toBeInTheDocument();
  });

  it('submits run-only palette capabilities without persisting them to the conversation', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
            meta: {
              icon: {
                type: 'svg',
                value:
                  '<svg viewBox="0 0 16 16"><path d="M2 2h12v12H2z" /></svg>',
              },
            },
          },
        ],
        subAgents: [],
      },
    );
    mocks.stream.client.conversations.search.mockResolvedValue({
      items: [
        {
          id: 'conversation-1',
          threadId: 'thread-new',
          options: {
            parameters: { input: 'seed' },
          },
        },
      ],
    });
    mocks.stream.submit.mockImplementationOnce(
      async (_values: any, options: any) => {
        await options?.onThreadResolved?.('thread-new');
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    let textarea = screen.getByRole('textbox');
    textarea = setComposerText(textarea, '/sand');
    fireEvent.mouseDown(await screen.findByText('Sandbox'));
    textarea = screen.getByRole('textbox');
    placeComposerCaretAtEnd(textarea);
    textarea = insertComposerText(textarea, 'run it');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(
      mocks.stream.submit.mock.calls[0][0].input.runtimeCapabilities,
    ).toEqual({
      mode: 'allowlist',
      skills: { ids: [] },
      plugins: { nodeKeys: ['middleware-1'] },
      subAgents: { nodeKeys: [] },
      recommended: {
        skills: { ids: [] },
        plugins: { nodeKeys: ['middleware-1'] },
        subAgents: { nodeKeys: [] },
      },
    });
    const optimisticValues =
      mocks.stream.submit.mock.calls[0][1].optimisticValues?.({
        messages: [],
      });
    expect(optimisticValues?.messages[0].runtimeCapabilities).toEqual({
      mode: 'allowlist',
      skills: { ids: [] },
      plugins: { nodeKeys: ['middleware-1'] },
      subAgents: { nodeKeys: [] },
      recommended: {
        skills: { ids: [] },
        plugins: { nodeKeys: ['middleware-1'] },
        subAgents: { nodeKeys: [] },
      },
    });
    expect(optimisticValues?.messages[0].runtimeCapabilityOptions).toEqual([
      expect.objectContaining({
        id: 'middleware-1',
        label: 'Sandbox',
        type: 'plugin',
      }),
    ]);
    await waitFor(() =>
      expect(mocks.stream.client.conversations.update).toHaveBeenCalledWith(
        'conversation-1',
        {
          options: {
            parameters: { input: 'seed' },
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: { ids: [] },
              plugins: { nodeKeys: [] },
              subAgents: { nodeKeys: [] },
            },
          },
        },
      ),
    );
  });
});
