import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

type Projects = NonNullable<ChatKitOptions['composer']>['projects'];

/** Published TXpertOptions lives at Assistant.config.options; host choices take precedence. */
export function resolveAssistantProjects(
  config: unknown,
  configured: Projects,
): Projects {
  if (!config || typeof config !== 'object' || !('options' in config))
    return configured;
  const options = config.options;
  if (!options || typeof options !== 'object' || !('workspaceScope' in options))
    return configured;
  const scope = options.workspaceScope;
  if (
    !scope ||
    typeof scope !== 'object' ||
    !('mode' in scope) ||
    (scope.mode !== 'project-required' && scope.mode !== 'project-preferred')
  )
    return configured;
  const onMissing = 'onMissing' in scope ? scope.onMissing : undefined;
  return {
    ...configured,
    autoNewEnabled:
      configured?.autoNewEnabled ??
      (onMissing === 'create' || onMissing === 'confirm'),
    autoNewMode:
      configured?.autoNewMode ??
      (onMissing === 'confirm' ? 'after-confirmation' : 'on-send'),
    allowNone: configured?.allowNone ?? scope.mode !== 'project-required',
  };
}
