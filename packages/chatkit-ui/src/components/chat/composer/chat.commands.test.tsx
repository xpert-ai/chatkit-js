import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  baseChatOptions,
  Chat,
  mocks,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat slash commands and shortcuts', () => {
  setupChatTest();
  it('executes host slash commands with args as submitted prompts', async () => {
    renderChat({
      composer: {
        slashCommands: [
          {
            name: 'review',
            label: 'Review',
            description: 'Review the current target',
            action: {
              type: 'submit_prompt',
              template: 'Review this: {{args}}',
            },
          },
        ],
      },
    });

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/review src/app.ts');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'Review this: src/app.ts',
          commandSource: {
            type: 'slash_command',
            name: 'review',
            source: 'host',
            executionType: 'submit_prompt',
          },
        },
      }),
      expect.any(Object),
    );
  });

  it('executes /plan with args as a plan-mode prompt', async () => {
    renderChat();

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/plan investigate the bug');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'investigate the bug',
          planMode: true,
          commandSource: {
            type: 'slash_command',
            name: 'plan',
            source: 'builtin',
            executionType: 'client_action',
          },
        },
        state: {
          human: {
            input: 'investigate the bug',
            planMode: true,
            commandSource: {
              type: 'slash_command',
              name: 'plan',
              source: 'builtin',
              executionType: 'client_action',
            },
          },
        },
      }),
      expect.any(Object),
    );
  });

  it('localizes remaining built-in slash command labels and descriptions', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
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
    setComposerText(textarea, '/plan');

    expect(screen.getByText('Localized Plan')).toBeInTheDocument();
    expect(
      screen.getByText('[prompt] Localized plan mode'),
    ).toBeInTheDocument();
  });

  it('shows prompt shortcuts only before a conversation exists', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [],
        subAgents: [],
        commands: [
          {
            name: 'slides',
            label: 'Create slides',
            kind: 'prompt_workflow',
            action: {
              type: 'insert_text',
              template: 'Create editable slides.',
            },
          },
        ],
      },
    );
    const { rerender } = renderChat();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Create slides' }),
      ).toBeEnabled(),
    );

    mocks.stream.threadId = 'existing-thread';
    rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
    expect(
      document.querySelector('[data-slot="prompt-workflow-shortcuts"]'),
    ).toBeNull();

    // Messages can arrive before the new thread id is reflected by the host.
    mocks.stream.threadId = null;
    mocks.stream.messages = [
      { id: 'human-1', type: 'human', content: 'Create slides' },
    ];
    rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
    expect(
      document.querySelector('[data-slot="prompt-workflow-shortcuts"]'),
    ).toBeNull();

    mocks.stream.messages = [];
    rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
    expect(screen.getByRole('button', { name: 'Create slides' })).toBeEnabled();
  });

  it.each(['shortcut', 'slash'])(
    'fills editable workspace prompts through %s, replaces scenario args and submits the visible text once',
    async (entry) => {
      mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
        {
          skills: [],
          plugins: [],
          subAgents: [],
          commands: [
            {
              name: 'slides',
              label: 'Create slides',
              kind: 'prompt_workflow',
              workflow: {
                type: 'prompt_workflow',
                scenarios: [
                  {
                    id: 'ai',
                    label: 'AI trends PPT',
                    args: 'Create an AI trends PPT',
                  },
                  {
                    id: 'annual',
                    label: 'Annual PPT',
                    args: 'Create an annual PPT',
                  },
                ],
              },
              action: {
                type: 'insert_text',
                template:
                  'Create editable slides.\nUse my language.\n\n{{args}}',
              },
            },
          ],
        },
      );
      renderChat();
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Create slides' }),
        ).toBeEnabled(),
      );
      const textbox = screen.getByRole('textbox');
      setComposerText(
        textbox,
        entry === 'shortcut'
          ? 'My existing draft'
          : '/slides My existing draft',
      );
      fireEvent.click(
        screen.getByRole('button', {
          name: entry === 'shortcut' ? 'Create slides' : 'send',
        }),
      );
      expect(screen.getByRole('textbox').textContent).toContain(
        'Create editable slides.\nUse my language.\n\nMy existing draft',
      );
      expect(mocks.stream.submit).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'AI trends PPT' }));
      const edited =
        'Create exactly 10 editable slides.\nUse my language.\n\nCreate an AI trends PPT';
      setComposerText(screen.getByRole('textbox'), edited);
      fireEvent.click(screen.getByRole('button', { name: 'Annual PPT' }));
      const expected =
        'Create exactly 10 editable slides.\nUse my language.\n\nCreate an annual PPT';
      expect(screen.getByRole('textbox').textContent).toBe(expected);
      expect(mocks.stream.submit).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'send' }));
      await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
      expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
        input: expected,
        commandSource: {
          name: 'slides',
          kind: 'prompt_workflow',
          executionType: 'insert_text',
        },
      });
      expect(
        screen.queryByRole('button', { name: 'Annual PPT' }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    {
      name: 'export',
      label: 'Export slides',
      template: 'Export slides.\n\n{{args}}',
      expected: 'Export slides.',
    },
    {
      name: 'share',
      label: 'Share slides',
      template: 'Share slides.',
      expected: 'Share slides.',
    },
  ])(
    'preserves edits on reselection but clears the previous scenario when switching to $name',
    async (target) => {
      mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
        {
          skills: [],
          plugins: [],
          subAgents: [],
          commands: [
            {
              name: 'slides',
              label: 'Create slides',
              kind: 'prompt_workflow',
              workflow: {
                type: 'prompt_workflow',
                scenarios: [
                  { id: 'annual', label: 'Annual PPT', args: 'Annual report' },
                ],
              },
              action: {
                type: 'insert_text',
                template: 'Create slides.\n\n{{args}}',
              },
            },
            {
              name: target.name,
              label: target.label,
              kind: 'prompt_workflow',
              action: { type: 'insert_text', template: target.template },
            },
          ],
        },
      );
      renderChat();
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Create slides' }),
        ).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Create slides' }));
      fireEvent.click(screen.getByRole('button', { name: 'Annual PPT' }));
      setComposerText(
        screen.getByRole('textbox'),
        'Create editable slides.\n\nAnnual report',
      );
      setComposerText(
        screen.getByRole('textbox'),
        'Create editable slides.\n\nAnnual report for my team',
      );
      for (let i = 0; i < 3; i++) {
        fireEvent.click(
          screen.getByRole('button', { name: 'composer.promptWorkflows.back' }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Create slides' }));
        expect(screen.getByRole('textbox').textContent).toBe(
          'Create editable slides.\n\nAnnual report for my team',
        );
      }
      fireEvent.click(
        screen.getByRole('button', { name: 'composer.promptWorkflows.back' }),
      );
      fireEvent.click(screen.getByRole('button', { name: target.label }));
      expect(screen.getByRole('textbox').textContent?.trim()).toBe(
        target.expected,
      );
      for (let i = 0; i < 3; i++) {
        const back = screen.queryByRole('button', {
          name: 'composer.promptWorkflows.back',
        });
        if (back) fireEvent.click(back);
        fireEvent.click(screen.getByRole('button', { name: target.label }));
        expect(screen.getByRole('textbox').textContent?.trim()).toBe(
          target.expected,
        );
      }
      expect(mocks.stream.submit).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'send' }));
      await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
      expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
        input: target.expected,
        commandSource: {
          name: target.name,
          kind: 'prompt_workflow',
          executionType: 'insert_text',
        },
      });
    },
  );

  it.each(['prompt', 'parent', 'menu'])(
    'places %s skills inside the composer and subagents beside the menu, keeping removal consistent',
    async (source) => {
      const selection = {
        mode: 'allowlist',
        skills: { ids: ['skill-docs'] },
        plugins: { nodeKeys: [] },
        subAgents: { nodeKeys: ['researcher'] },
        recommended: {
          skills: { ids: ['skill-docs'] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: ['researcher'] },
        },
      };
      mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
        {
          skills: [{ id: 'skill-docs', label: 'documents' }],
          plugins: [],
          subAgents: [{ nodeKey: 'researcher', label: 'Researcher' }],
          commands: [
            {
              name: 'slides',
              label: 'Create slides',
              kind: 'prompt_workflow',
              workflow: {
                type: 'prompt_workflow',
                scenarios: [
                  { id: 'annual', label: 'Annual PPT', args: 'Annual report' },
                ],
              },
              action: {
                type: 'insert_text',
                template: 'Create slides.\n{{args}}',
                runtimeCapabilities: selection,
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
      if (source === 'prompt') {
        fireEvent.click(screen.getByRole('button', { name: 'Create slides' }));
        fireEvent.click(screen.getByRole('button', { name: 'Annual PPT' }));
      } else if (source === 'parent') {
        await act(async () =>
          mocks.parentMessengerOptions?.onSetComposerValue?.({
            text: 'Create slides.',
            runtimeCapabilities: selection,
            insertRuntimeCapabilities: true,
          }),
        );
      } else {
        fireEvent.click(screen.getByTestId('select-skill'));
        fireEvent.click(screen.getByTestId('select-sub-agent'));
        setComposerText(screen.getByRole('textbox'), 'Create slides.');
      }
      const editor = document.querySelector(
        '[data-slot="composer-editor-surface"]',
      );
      const toolbar = document.querySelector(
        '[data-slot="composer-action-bar"]',
      );
      const body = document.querySelector('[data-slot="composer-body"]');
      expect(editor).not.toBeNull();
      expect(toolbar).not.toBeNull();
      expect(body).not.toBeNull();
      expect(body).toHaveTextContent('documents');
      expect(body?.querySelector('[contenteditable="false"]')).toBeNull();
      expect(body).not.toHaveTextContent('Researcher');
      expect(toolbar).toHaveTextContent('Researcher');
      expect(screen.getByTestId('selected-sub-agents')).toHaveTextContent(
        'researcher',
      );
      expect(screen.getByTestId('selected-skills')).toHaveTextContent(
        'skill-docs',
      );
      if (!(editor instanceof HTMLElement)) throw new Error('Missing composer');
      fireEvent.click(
        within(editor).getByRole('button', {
          name: 'Remove selection: documents',
        }),
      );
      const editableBeforeAgentRemoval = screen.getByRole('textbox');
      fireEvent.click(
        within(editor).getByRole('button', {
          name: 'Remove selection: Researcher',
        }),
      );
      expect(screen.getByRole('textbox')).toBe(editableBeforeAgentRemoval);
      expect(screen.getByTestId('selected-sub-agents')).toBeEmptyDOMElement();
      expect(screen.getByTestId('selected-skills')).toBeEmptyDOMElement();
      expect(body).not.toHaveTextContent('documents');
      expect(toolbar).not.toHaveTextContent('Researcher');
      if (source === 'prompt') {
        fireEvent.click(screen.getByRole('button', { name: 'Annual PPT' }));
        expect(body).not.toHaveTextContent('documents');
        expect(toolbar).not.toHaveTextContent('Researcher');
      }
      fireEvent.click(screen.getByRole('button', { name: 'send' }));
      await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
      const input = mocks.stream.submit.mock.calls[0][0].input;
      expect(input.input).toBe(
        source === 'prompt'
          ? 'Create slides.\nAnnual report'
          : 'Create slides.',
      );
      expect(input.runtimeCapabilities.skills.ids).toEqual([]);
      expect(input.runtimeCapabilities.subAgents.nodeKeys).toEqual([]);
      expect(input.runtimeCapabilities.recommended).toBeUndefined();
    },
  );

  it('scrolls the slash palette active item into view during keyboard navigation', async () => {
    renderChat({
      composer: {
        slashCommands: Array.from({ length: 6 }, (_, index) => ({
          name: `cmd-${index}`,
          label: `Command ${index}`,
          action: {
            type: 'insert_text',
            template: `Command ${index}`,
          },
        })),
      },
    });

    let textbox = screen.getByRole('textbox');
    textbox = setComposerText(textbox, '/');

    const palette = document.querySelector(
      '[data-slot="slash-palette"]',
    ) as HTMLDivElement | null;
    if (!palette) {
      throw new Error('Expected slash palette to be rendered.');
    }
    const options = Array.from(
      document.querySelectorAll('[data-slot="slash-palette-option"]'),
    ) as HTMLButtonElement[];
    expect(options.length).toBeGreaterThan(3);

    let scrollTop = 0;
    Object.defineProperty(palette, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      },
    });
    palette.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 100,
        left: 0,
        right: 300,
        width: 300,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    options.forEach((option, index) => {
      option.getBoundingClientRect = () =>
        ({
          top: index * 40 - scrollTop,
          bottom: index * 40 + 40 - scrollTop,
          left: 0,
          right: 300,
          width: 300,
          height: 40,
          x: 0,
          y: index * 40 - scrollTop,
          toJSON: () => ({}),
        }) as DOMRect;
    });

    fireEvent.keyDown(textbox, { key: 'ArrowDown' });
    fireEvent.keyDown(textbox, { key: 'ArrowDown' });

    await waitFor(() => expect(scrollTop).toBeGreaterThan(0));
  });
});
