import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSlashCommandExecutionEffect,
  createSlashPaletteOptions,
  resolveRuntimeCapabilityPalette,
  resolveSlashCommands,
  shouldSubmitRawSlashInvocation,
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
  palette: RuntimeCapabilityPaletteState,
  selectedRuntimeCapabilities: RuntimeCapabilitiesSelection = {
    mode: 'allowlist',
    skills: { workspaceId: 'workspace-1', ids: [] },
    plugins: { nodeKeys: [] },
    subAgents: { nodeKeys: [] },
  },
) {
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

  it('normalizes prompt workflow metadata without changing action semantics', () => {
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
        name: 'review',
        label: 'Review',
        description: 'Review selected files',
        tags: ['quality'],
      },
      action: {
        type: 'submit_prompt',
        template: 'Review {{args}}',
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

    const options = getPaletteOptions(resolveRuntimeCapabilityPalette('$', 1)!);

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

    expect(options.map((option) => option.label)).toContain('Review');
    expect(options.map((option) => option.label)).toContain('Review Skill');
    expect(options.find((option) => option.label === 'Review')).toMatchObject({
      description: '<path>',
    });
  });

  it('shows only capabilities for a slash typed after whitespace', () => {
    const options = getPaletteOptions({
      query: 'review',
      start: 6,
      end: 13,
      activeIndex: 0,
      atMessageStart: false,
    });

    expect(options.map((option) => option.kind)).toEqual(['capability']);
    expect(options[0]).toMatchObject({ label: 'Review Skill' });
  });

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

  it('nests runtime capabilities under expanded built-in groups', () => {
    const options = getPaletteOptions({
      query: '',
      start: 0,
      end: 1,
      activeIndex: 0,
      atMessageStart: true,
      expandedCapabilityTypes: ['skill'],
    });

    const skillGroupIndex = options.findIndex(
      (option) => option.kind === 'command' && option.command.name === 'skills',
    );
    expect(skillGroupIndex).toBeGreaterThan(-1);
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
});
