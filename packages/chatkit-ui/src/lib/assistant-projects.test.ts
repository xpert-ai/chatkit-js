import { describe, expect, it } from 'vitest';
import { resolveAssistantProjects } from './assistant-projects';

describe('published Assistant project defaults', () => {
  it('requires confirmation and hides no-project for a required Project workspace', () => {
    expect(
      resolveAssistantProjects(
        {
          options: {
            workspaceScope: {
              mode: 'project-required',
              onMissing: 'confirm',
            },
          },
        },
        { enabled: true },
      ),
    ).toEqual({
      enabled: true,
      autoNewEnabled: true,
      autoNewMode: 'after-confirmation',
      allowNone: false,
    });
  });

  it('offers creation on send and no-project for a preferred workspace', () => {
    expect(
      resolveAssistantProjects(
        {
          options: {
            workspaceScope: {
              mode: 'project-preferred',
              onMissing: 'create',
            },
          },
        },
        { enabled: true },
      ),
    ).toEqual({
      enabled: true,
      autoNewEnabled: true,
      autoNewMode: 'on-send',
      allowNone: true,
    });
  });

  it('preserves explicit host policy and never enables the selector implicitly', () => {
    const configured = {
      enabled: false,
      autoNewEnabled: false,
      allowNone: true,
      autoNewMode: 'on-send' as const,
    };
    expect(
      resolveAssistantProjects(
        {
          options: {
            workspaceScope: {
              mode: 'project-required',
              onMissing: 'confirm',
            },
          },
        },
        configured,
      ),
    ).toEqual(configured);
  });

  it.each([
    undefined,
    {},
    { options: null },
    { options: { workspaceScope: { mode: 'unknown', onMissing: 'confirm' } } },
  ])(
    'retains legacy behavior without a recognized workspace policy: %j',
    (config) => {
      const configured = { enabled: true };
      expect(resolveAssistantProjects(config, configured)).toBe(configured);
    },
  );

  it('does not offer automatic creation without a supported creation policy', () => {
    expect(
      resolveAssistantProjects(
        {
          options: {
            workspaceScope: {
              mode: 'project-required',
              onMissing: 'unknown',
            },
          },
        },
        { enabled: true },
      ),
    ).toMatchObject({ autoNewEnabled: false, allowNone: false });
  });
});
