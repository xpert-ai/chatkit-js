import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSlashCommandExecutionEffect,
  createSlashPaletteOptions,
  hasSelectedRuntimeSlashCommand,
  resolveRuntimeCapabilityPalette,
  resolveSlashCommands,
  shouldSubmitRawSlashInvocation,
  type RuntimeCapabilitiesWithCommands,
  type RuntimeCapabilityPaletteState,
} from './slash-commands';
import type {
  RuntimeCapabilitiesSelection,
  RuntimeCapabilityOption,
} from './runtime-capabilities';

const runtimeCapabilities = {
  skills: [
    {
      id: 'skill-review',
      workspaceId: 'workspace-1',
      label: 'Review Skill',
      description: 'Review code',
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
};

const runtimeCapabilityOptions: RuntimeCapabilityOption[] = [
  {
    type: 'skill',
    id: 'skill-review',
    label: 'Review Skill',
    description: 'Review code',
    capability: runtimeCapabilities.skills[0],
  },
  {
    type: 'plugin',
    id: 'plugin-search',
    label: 'Search Plugin',
    capability: runtimeCapabilities.plugins[0],
  },
];

function getPaletteOptions(
  palette: RuntimeCapabilityPaletteState | null,
  selectedRuntimeCapabilities: RuntimeCapabilitiesSelection = {
    mode: 'allowlist',
    skills: { workspaceId: 'workspace-1', ids: [] },
    plugins: { nodeKeys: [] },
    subAgents: { nodeKeys: [] },
  },
  language?: string | null,
) {
  if (!palette) throw new Error('Expected the slash palette to open');
  return createSlashPaletteOptions({
    palette,
    resolvedCommands: resolveSlashCommands(
      [
        {
          name: 'review',
          label: 'Review',
          aliases: ['audit'],
          argsHint: '<path>',
          action: {
            type: 'submit_prompt',
            template: 'Review {{args}}',
          },
        },
      ],
      [
        {
          name: 'runtime-only',
          label: 'Runtime Only',
          action: {
            type: 'insert_text',
            template: 'runtime',
          },
        },
      ],
    ),
    runtimeCapabilitiesReady: true,
    runtimeCapabilityOptions,
    runtimeCapabilities,
    recommendedRuntimeCapabilities: selectedRuntimeCapabilities,
    language,
  });
}

describe('slash command registry', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('keeps built-in names reserved and lets host commands win over runtime commands', () => {
    const commands = resolveSlashCommands(
      [
        {
          name: 'plan',
          label: 'Host Plan',
          action: { type: 'insert_text', template: 'host plan' },
        },
        {
          name: 'review',
          label: 'Host Review',
          action: { type: 'insert_text', template: 'host review' },
        },
      ],
      [
        {
          name: 'review',
          label: 'Runtime Review',
          action: { type: 'insert_text', template: 'runtime review' },
        },
      ],
    );

    expect(commands.find((command) => command.name === 'plan')?.source).toBe(
      'builtin',
    );
    expect(commands.find((command) => command.name === 'review')).toMatchObject(
      {
        source: 'host',
        label: 'Host Review',
      },
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('duplicate slash command "plan"'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('duplicate slash command "review"'),
    );
  });

  it('filters malformed commands', () => {
    const commands = resolveSlashCommands(
      [
        {
          name: 'Bad Name',
          action: { type: 'insert_text', template: 'bad' },
        },
        {
          name: 'empty',
          action: { type: 'submit_prompt', template: '' },
        },
      ],
      undefined,
    );

    expect(commands.some((command) => command.name === 'Bad Name')).toBe(false);
    expect(commands.some((command) => command.name === 'empty')).toBe(false);
  });

  it('keeps prompt workflow metadata without changing action semantics', () => {
    const command = resolveSlashCommands(
      [
        {
          name: 'review',
          label: 'Review',
          description: 'Review selected files',
          kind: 'prompt_workflow',
          workflow: {
            type: 'prompt_workflow',
            tags: ['quality', 'quality'],
          },
          action: {
            type: 'submit_prompt',
            template: 'Review {{args}}',
          },
        },
      ],
      undefined,
    ).find((item) => item.name === 'review');

    expect(command).toMatchObject({
      kind: 'prompt_workflow',
      workflow: {
        type: 'prompt_workflow',
        tags: ['quality', 'quality'],
      },
      action: {
        type: 'submit_prompt',
        template: 'Review {{args}}',
      },
    });
  });

  it('keeps command i18n objects until palette rendering and command execution', () => {
    const commands = resolveSlashCommands(
      [
        {
          name: 'compact',
          label: {
            en_US: 'Compress',
            zh_Hans: '压缩',
          },
          description: {
            en_US: 'Compress this thread context',
            zh_Hans: '压缩此线程的上下文',
          },
          kind: 'prompt_workflow',
          workflow: {
            type: 'prompt_workflow',
            label: {
              en_US: 'Context compression',
              zh_Hans: '上下文压缩',
            },
            description: {
              en_US: 'Compress workflow',
              zh_Hans: '压缩工作流',
            },
          },
          action: {
            type: 'submit_prompt',
            template: '/compact',
          },
        },
      ],
      undefined,
    );
    const command = commands.find((item) => item.name === 'compact');

    expect(command).toMatchObject({
      label: {
        en_US: 'Compress',
        zh_Hans: '压缩',
      },
      description: {
        en_US: 'Compress this thread context',
        zh_Hans: '压缩此线程的上下文',
      },
      workflow: {
        label: {
          en_US: 'Context compression',
          zh_Hans: '上下文压缩',
        },
        description: {
          en_US: 'Compress workflow',
          zh_Hans: '压缩工作流',
        },
      },
    });

    const paletteOption = createSlashPaletteOptions({
      palette: resolveRuntimeCapabilityPalette('/', 1),
      resolvedCommands: commands,
      runtimeCapabilitiesReady: true,
      runtimeCapabilityOptions,
      runtimeCapabilities,
      recommendedRuntimeCapabilities: {
        mode: 'allowlist',
        skills: { workspaceId: 'workspace-1', ids: [] },
        plugins: { nodeKeys: [] },
        subAgents: { nodeKeys: [] },
      },
      language: 'zh-CN',
    }).find((item) => item.kind === 'command' && item.command.name === 'compact');

    expect(paletteOption).toMatchObject({
      label: '压缩',
      description: '压缩此线程的上下文',
    });

    if (!command) {
      throw new Error('Expected /compact to be registered.');
    }

    expect(createSlashCommandExecutionEffect(command, '', 'zh-CN')).toMatchObject({
      commandSource: {
        workflow: {
          label: '上下文压缩',
          description: '压缩工作流',
        },
      },
    });
  });
});

describe('slash command palette', () => {
  it('resolves dollar triggers as skill-only palette requests', () => {
    expect(resolveRuntimeCapabilityPalette('ask $rev', 8)).toMatchObject({
      trigger: '$',
      query: 'rev',
      start: 4,
      end: 8,
      atMessageStart: false,
      capabilityTypes: ['skill'],
    });

    const options = getPaletteOptions(resolveRuntimeCapabilityPalette('$', 1));

    expect(options.map((option) => option.kind)).toEqual(['capability']);
    expect(options.map((option) => option.label)).toEqual(['Review Skill']);
  });

  it('matches skill capabilities with dollar-prefixed ids and labels', () => {
    const dollarSkill = {
      type: 'skill' as const,
      id: 'audit',
      label: 'Audit Skill',
      capability: {
        id: 'audit',
        workspaceId: 'workspace-1',
        label: 'Audit Skill',
      },
    };

    const options = createSlashPaletteOptions({
      palette: resolveRuntimeCapabilityPalette('$$audit', 7),
      resolvedCommands: resolveSlashCommands(undefined, undefined),
      runtimeCapabilitiesReady: true,
      runtimeCapabilityOptions: [
        dollarSkill,
        {
          type: 'plugin',
          id: 'audit-plugin',
          label: 'Audit Plugin',
          capability: {
            nodeKey: 'audit-plugin',
            provider: 'audit',
            label: 'Audit Plugin',
          },
        },
      ],
      runtimeCapabilities: {
        skills: [dollarSkill.capability],
        plugins: [],
        subAgents: [],
      },
      recommendedRuntimeCapabilities: {
        mode: 'allowlist',
        skills: { workspaceId: 'workspace-1', ids: [] },
        plugins: { nodeKeys: [] },
        subAgents: { nodeKeys: [] },
      },
    });

    expect(options.map((option) => option.label)).toEqual(['Audit Skill']);
  });

  it('shows commands and capabilities at the message start', () => {
    const options = getPaletteOptions({
      query: 'review',
      start: 0,
      end: 7,
      activeIndex: 0,
      atMessageStart: true,
    });

    expect(options.map((option) => option.label)).toEqual([
      'Review', 'Skills', 'Review Skill',
    ]);
    expect(options.find((option) => option.label === 'Review')).toMatchObject({
      description: '<path>',
    });
  });

  it.each(['', 'hello ', 'hello\n', '/\n已有正文\n'])(
    'shows the same complete slash menu after %j',
    (prefix) => {
      for (const query of ['', 'review']) {
        const invocation = `/${query}`;
        const text = `${prefix}${invocation} remaining text`;
        const palette = resolveRuntimeCapabilityPalette(
          text,
          prefix.length + invocation.length,
        );
        expect(palette).toMatchObject({
          trigger: '/',
          start: prefix.length,
          end: prefix.length + invocation.length,
          query,
        });
        const options = getPaletteOptions(palette);
        expect(options).toEqual(
          getPaletteOptions(
            resolveRuntimeCapabilityPalette(invocation, invocation.length),
          ),
        );
        expect(options).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ kind: 'command', label: 'Review' }),
          ]),
        );
        if (!query) {
          expect(options).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: 'builtin:plan' }),
              expect.objectContaining({ capabilityType: 'skill' }),
              expect.objectContaining({ capabilityType: 'plugin' }),
              expect.objectContaining({ capabilityType: 'subAgent' }),
              expect.objectContaining({ label: 'Runtime Only' }),
            ]),
          );
        }
      }
    },
  );

  it.each(['$', 'hello $', 'hello\n$'])(
    'keeps %j limited to skills',
    (text) => {
      const options = getPaletteOptions(
        resolveRuntimeCapabilityPalette(text, text.length),
      );
      expect(options.map((option) => option.kind)).toEqual(['capability']);
      expect(options.map((option) => option.label)).toEqual(['Review Skill']);
    },
  );

  it('can open capability-type panels', () => {
    const skillOptions = getPaletteOptions({
      query: '',
      start: 0,
      end: 1,
      activeIndex: 0,
      atMessageStart: true,
      capabilityTypes: ['skill'],
    });

    expect(skillOptions).toHaveLength(1);
    expect(skillOptions[0]).toMatchObject({
      kind: 'capability',
      label: 'Review Skill',
    });
  });

  it('hides capabilities that have already been recommended', () => {
    const options = getPaletteOptions(
      {
        query: 'review',
        start: 0,
        end: 7,
        activeIndex: 0,
        atMessageStart: true,
      },
      {
        mode: 'allowlist',
        skills: { workspaceId: 'workspace-1', ids: ['skill-review'] },
        plugins: { nodeKeys: [] },
        subAgents: { nodeKeys: [] },
      },
    );

    expect(options.map((option) => option.label)).toContain('Review');
    expect(options.map((option) => option.label)).not.toContain('Review Skill');
  });

  it('hides runtime commands whose required capabilities are not selected', () => {
    const goalRuntimeCapabilities = {
      mode: 'allowlist' as const,
      skills: { workspaceId: 'workspace-1', ids: [] },
      plugins: { nodeKeys: ['plugin-search'] },
      subAgents: { nodeKeys: [] },
    };
    const palette = {
      query: 'goal',
      start: 0,
      end: 5,
      activeIndex: 0,
      atMessageStart: true,
    };
    const resolvedCommands = resolveSlashCommands(undefined, [
      {
        name: 'goal',
        label: 'Goal',
        action: {
          type: 'client_action',
          action: {
            type: 'chatkit.conversation_goal.command',
          },
          runtimeCapabilities: goalRuntimeCapabilities,
        },
      },
    ]);

    expect(
      createSlashPaletteOptions({
        palette,
        resolvedCommands,
        runtimeCapabilitiesReady: true,
        runtimeCapabilityOptions,
        runtimeCapabilities,
        recommendedRuntimeCapabilities: {
          mode: 'allowlist',
          skills: { workspaceId: 'workspace-1', ids: [] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        },
      }).map((option) => option.label),
    ).toEqual([]);

    expect(
      createSlashPaletteOptions({
        palette,
        resolvedCommands,
        runtimeCapabilitiesReady: true,
        runtimeCapabilityOptions,
        runtimeCapabilities,
        recommendedRuntimeCapabilities: {
          mode: 'allowlist',
          skills: { workspaceId: 'workspace-1', ids: [] },
          plugins: { nodeKeys: ['plugin-search'] },
          subAgents: { nodeKeys: [] },
        },
      }).map((option) => option.label),
    ).toEqual(['Goal']);
  });

  it('shows available skills on bare slash until their group is collapsed', () => {
    const palette = resolveRuntimeCapabilityPalette('/', 1)!;
    expect(getPaletteOptions(palette).map((option) => option.label)).toEqual([
      'Plan', 'Pet', 'Review', 'Runtime Only',
      'Plugins', 'Sub-agents', 'Skills', 'Review Skill',
    ]);
    const collapsed = getPaletteOptions({
      ...palette,
      groupExpansion: { skill: false },
    });
    expect(collapsed.at(-1)?.label).toBe('Skills');
    expect(collapsed.map((option) => option.label)).not.toContain('Review Skill');
    expect(collapsed.find((option) => option.label === 'Skills')).toMatchObject({
      expanded: false, childCount: 1,
    });
  });

  it('keeps a collapsed group visible when only its children match the search', () => {
    const palette = resolveRuntimeCapabilityPalette('/review', 7)!;
    const options = getPaletteOptions({
      ...palette,
      groupExpansion: { skill: false },
    });
    expect(options.map((option) => option.label)).toEqual(['Review', 'Skills']);
    expect(options.at(-1)).toMatchObject({ expanded: false, childCount: 1 });
  });

  it('nests runtime capabilities under expanded built-in groups', () => {
    const options = getPaletteOptions({
      query: '',
      start: 0,
      end: 1,
      activeIndex: 0,
      atMessageStart: true,
      groupExpansion: { skill: true, plugin: true },
    });

    const skillGroupIndex = options.findIndex(
      (option) => option.kind === 'command' && option.command.name === 'skills',
    );
    expect(options.slice(-5).map((option) => option.label)).toEqual([
      'Plugins', 'Search Plugin', 'Sub-agents', 'Skills', 'Review Skill',
    ]);
    expect(options[skillGroupIndex]).toMatchObject({
      kind: 'command',
      capabilityType: 'skill',
      expanded: true,
      childCount: 1,
    });
    expect(options[skillGroupIndex + 1]).toMatchObject({
      kind: 'capability',
      parentType: 'skill',
      depth: 1,
      label: 'Review Skill',
    });
  });

  it('keeps the full inline command list and places skills last', () => {
    const palette = resolveRuntimeCapabilityPalette('add /', 5)!;
    expect(getPaletteOptions(palette).map((option) => option.label)).toEqual([
      'Plan', 'Pet', 'Review', 'Runtime Only',
      'Plugins', 'Sub-agents', 'Skills', 'Review Skill',
    ]);
  });
});

describe('slash command availability', () => {
  it('checks whether a named runtime command has its required capabilities selected', () => {
    const runtimeCapabilitiesWithCommands: RuntimeCapabilitiesWithCommands = {
      ...runtimeCapabilities,
      commands: [
        {
          name: 'goal',
          label: 'Goal',
          action: {
            type: 'client_action',
            action: {
              type: 'chatkit.conversation_goal.command',
            },
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: { workspaceId: 'workspace-1', ids: [] },
              plugins: { nodeKeys: ['plugin-search'] },
              subAgents: { nodeKeys: [] },
            },
          },
        },
      ],
    };

    expect(
      hasSelectedRuntimeSlashCommand(
        runtimeCapabilitiesWithCommands,
        {
          mode: 'allowlist',
          skills: { workspaceId: 'workspace-1', ids: [] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        },
        'goal',
      ),
    ).toBe(false);

    expect(
      hasSelectedRuntimeSlashCommand(
        runtimeCapabilitiesWithCommands,
        {
          mode: 'allowlist',
          skills: { workspaceId: 'workspace-1', ids: [] },
          plugins: { nodeKeys: ['plugin-search'] },
          subAgents: { nodeKeys: [] },
        },
        'goal',
      ),
    ).toBe(true);
  });
});

describe('slash command executor', () => {
  it('turns /plan with args into a plan-mode prompt submission', () => {
    const plan = resolveSlashCommands(undefined, undefined).find(
      (command) => command.name === 'plan',
    );
    if (!plan) {
      throw new Error('Expected /plan to be registered.');
    }

    expect(createSlashCommandExecutionEffect(plan, 'ship this')).toMatchObject({
      type: 'submit_prompt',
      inputText: 'ship this',
      displayText: 'ship this',
      planMode: true,
      commandSource: {
        type: 'slash_command',
        name: 'plan',
        source: 'builtin',
        executionType: 'client_action',
      },
    });
  });

  it('turns /pet args into local pet actions', () => {
    const pet = resolveSlashCommands(undefined, undefined).find(
      (command) => command.name === 'pet',
    );
    if (!pet) {
      throw new Error('Expected /pet to be registered.');
    }

    expect(createSlashCommandExecutionEffect(pet, '')).toMatchObject({
      type: 'pet',
      mode: 'toggle',
    });
    expect(createSlashCommandExecutionEffect(pet, 'off')).toMatchObject({
      type: 'pet',
      mode: 'off',
    });
    expect(createSlashCommandExecutionEffect(pet, 'settings')).toMatchObject({
      type: 'pet',
      mode: 'settings',
    });
  });

  it('renders submit_prompt templates with args and command metadata', () => {
    const review = resolveSlashCommands(
      [
        {
          name: 'review',
          kind: 'prompt_workflow',
          workflow: {
            type: 'prompt_workflow',
            tags: ['quality'],
          },
          action: {
            type: 'submit_prompt',
            template: 'Review {{args}}',
          },
        },
      ],
      undefined,
    ).find((command) => command.name === 'review');
    if (!review) {
      throw new Error('Expected /review to be registered.');
    }

    expect(
      createSlashCommandExecutionEffect(review, 'src/app.ts'),
    ).toMatchObject({
      type: 'submit_prompt',
      inputText: 'Review src/app.ts',
      commandSource: {
        name: 'review',
        source: 'host',
        executionType: 'submit_prompt',
        kind: 'prompt_workflow',
        workflow: {
          type: 'prompt_workflow',
          name: 'review',
          label: 'review',
          tags: ['quality'],
        },
      },
    });
  });

  it('marks insert_invocation commands so submit can pass through unchanged', () => {
    const review = resolveSlashCommands(undefined, [
      {
        name: 'review',
        kind: 'prompt_workflow',
        action: {
          type: 'insert_invocation',
          template: '/review ',
        },
      },
    ]).find((command) => command.name === 'review');
    if (!review) {
      throw new Error('Expected /review to be registered.');
    }

    expect(shouldSubmitRawSlashInvocation(review)).toBe(true);
    expect(createSlashCommandExecutionEffect(review, '')).toMatchObject({
      type: 'set_composer_text',
      text: '/review ',
    });
  });

  it('keeps /goal gated by runtime capabilities and handles it as a goal action', () => {
    expect(
      resolveSlashCommands(undefined, undefined).some(
        (command) => command.name === 'goal',
      ),
    ).toBe(false);

    const goal = resolveSlashCommands(undefined, [
      {
        name: 'goal',
        label: 'Goal',
        action: {
          type: 'client_action',
          action: {
            type: 'chatkit.conversation_goal.command',
          },
          runtimeCapabilities: {
            mode: 'allowlist',
            skills: {
              ids: [],
            },
            plugins: {
              nodeKeys: ['middleware-1'],
            },
            subAgents: {
              nodeKeys: [],
            },
          },
        },
      },
    ]).find((command) => command.name === 'goal');
    if (!goal) {
      throw new Error('Expected runtime /goal to be registered.');
    }

    expect(goal.source).toBe('runtime');
    expect(shouldSubmitRawSlashInvocation(goal)).toBe(false);
    expect(createSlashCommandExecutionEffect(goal, 'ship feature')).toMatchObject({
      type: 'goal',
      args: 'ship feature',
      commandSource: {
        type: 'slash_command',
        name: 'goal',
        source: 'runtime',
        executionType: 'client_action',
      },
      runtimeCapabilities: {
        mode: 'allowlist',
        skills: {
          ids: [],
        },
        plugins: {
          nodeKeys: ['middleware-1'],
        },
        subAgents: {
          nodeKeys: [],
        },
      },
    });
  });
});
