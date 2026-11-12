import * as React from 'react';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Command as CommandIcon,
  ListChecks,
  Plug,
  Sparkles,
} from 'lucide-react';

import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { cn } from '../../lib/utils';
import type {
  ResolvedSlashCommand,
  RuntimeCapabilityPaletteState,
  SlashPaletteOption,
} from '../../lib/slash-commands';
import type { RuntimeCapabilityOption } from '../../lib/runtime-capabilities';
import {
  getRuntimeCapabilityColor,
  getRuntimeSkillSource,
} from '../../lib/runtime-capabilities';
import { RuntimeCapabilityIcon } from '../runtime-capability-icon';
import { IconDefinitionRenderer } from '../ui/icon-definition';

function SlashCommandIcon({ command }: { command: ResolvedSlashCommand }) {
  const iconSize = 16;
  if (command.icon && typeof command.icon === 'object') {
    return (
      <IconDefinitionRenderer
        icon={command.icon as any}
        size={iconSize}
        dataSlot="slash-command-icon"
        fallback={<CommandIcon size={iconSize} />}
      />
    );
  }

  if (command.kind === 'prompt_workflow') {
    return <Sparkles size={iconSize} />;
  }

  switch (command.name) {
    case 'plan':
      return <ListChecks size={iconSize} />;
    case 'skills':
      return <Sparkles size={iconSize} />;
    case 'plugins':
      return <Plug size={iconSize} />;
    case 'subagents':
      return <Bot size={iconSize} />;
    default:
      return <CommandIcon size={iconSize} />;
  }
}

const capabilityHeading = {
  skill: 'composer.capabilities.skills',
  plugin: 'composer.capabilities.plugins',
  subAgent: 'composer.capabilities.subAgents',
} as const;

function sectionKey(option: SlashPaletteOption) {
  if (option.kind === 'capability')
    return option.parentType
      ? undefined
      : capabilityHeading[option.capability.type];
  if (option.kind === 'command' && option.capabilityType) return undefined;
  return 'composer.slashCommands.sectionTitle';
}

export function SlashPalette({
  palette,
  options,
  paletteRef,
  optionRefs,
  panelRoundedClass,
  itemRoundedClass,
  emptyLabel,
  capabilityEmptyLabels,
  onSelect,
  onActiveChange,
}: {
  palette: RuntimeCapabilityPaletteState;
  options: SlashPaletteOption[];
  paletteRef: React.RefObject<HTMLDivElement | null>;
  optionRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>;
  panelRoundedClass?: string;
  itemRoundedClass?: string;
  emptyLabel: string;
  capabilityEmptyLabels?: Partial<
    Record<RuntimeCapabilityOption['type'], string>
  >;
  onSelect: (option: SlashPaletteOption) => void;
  onActiveChange?: (index: number) => void;
}) {
  const { t } = useChatkitTranslation();
  return (
    <div
      ref={paletteRef}
      data-slot="slash-palette"
      className={cn(
        'mb-[calc(0.5rem*var(--chat-density-scale,1))] max-h-[min(22rem,42dvh)] overflow-y-auto overscroll-contain rounded-chat-panel border border-border bg-popover [--slash-inset:calc(0.375rem+0.25rem*var(--chat-density-scale,1))] [--slash-padding:calc(0.375rem*var(--chat-density-scale,1))] p-(--slash-padding) text-popover-foreground shadow-sm',
        panelRoundedClass,
      )}
    >
      {options.length > 0 ? (
        options.map((option, index) => {
          const group = option.kind === 'command' && option.capabilityType;
          const section = sectionKey(option);
          const showHeading =
            section && (!index || section !== sectionKey(options[index - 1]));
          const capability =
            option.kind === 'capability' ? option.capability : undefined;
          const capabilityColor =
            capability && capability.type !== 'skill'
              ? getRuntimeCapabilityColor(capability)
              : undefined;
          const skill =
            capability?.type === 'skill' ? capability.capability : undefined;
          const source = skill && getRuntimeSkillSource(skill);
          const sourceLabel = source
            ? t(
                source.type === 'project'
                  ? 'composer.slashCommands.projectSource'
                  : 'composer.slashCommands.expertSource',
                { name: source.label },
              )
            : skill?.repositoryName;
          const active = index === palette.activeIndex;
          return (
            <React.Fragment key={option.id}>
              {showHeading && (
                <div className="px-(--slash-inset) pt-(--slash-padding) pb-[calc(0.25rem*var(--chat-density-scale,1))] text-xs text-muted-foreground">
                  {t(section)}
                </div>
              )}
              <button
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                data-slot="slash-palette-option"
                data-kind={option.kind}
                data-depth={option.kind === 'capability' ? option.depth : 0}
                type="button"
                aria-current={active || undefined}
                aria-expanded={group ? option.expanded === true : undefined}
                onPointerMove={(event) => {
                  if (event.pointerType === 'mouse' && !active)
                    onActiveChange?.(index);
                }}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  onSelect(option);
                }}
                onClick={(event) => {
                  // Keyboard and assistive technology can activate a button without a mouse down.
                  if (event.detail === 0) onSelect(option);
                }}
                className={cn(
                  'flex min-h-[calc(1.25rem+0.75rem*var(--chat-density-scale,1))] w-full min-w-0 items-center gap-(--slash-inset) rounded-chat-item px-(--slash-inset) text-left text-sm font-normal focus-visible:outline-1 focus-visible:outline-ring',
                  itemRoundedClass,
                  group && 'text-xs text-muted-foreground',
                  active && 'bg-muted text-foreground',
                )}
              >
                {!group && (
                  <span
                    className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:max-h-full [&_svg]:max-w-full"
                    style={
                      capabilityColor ? { color: capabilityColor } : undefined
                    }
                  >
                    {option.kind === 'resource_command' ? (
                      <Sparkles size={16} />
                    ) : option.kind === 'command' ? (
                      <SlashCommandIcon command={option.command} />
                    ) : (
                      <RuntimeCapabilityIcon
                        option={option.capability}
                        variant="list"
                      />
                    )}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 items-baseline gap-(--slash-inset)">
                  <span
                    className={cn(
                      'truncate',
                      !group && option.description && 'max-w-[65%] shrink-0',
                    )}
                    title={option.label}
                  >
                    {option.label}
                  </span>
                  {group && typeof option.childCount === 'number' && (
                    <span
                      data-slot="slash-palette-child-count"
                      className="shrink-0 text-xs tabular-nums text-muted-foreground"
                    >
                      {option.childCount}
                    </span>
                  )}
                  {!group && option.description && (
                    <span
                      className="min-w-0 truncate text-muted-foreground"
                      title={option.description}
                    >
                      {option.description}
                    </span>
                  )}
                </span>
                {sourceLabel && (
                  <span
                    className="max-w-[30%] shrink-0 truncate text-xs text-muted-foreground"
                    title={sourceLabel}
                  >
                    {sourceLabel}
                  </span>
                )}
                {group &&
                  (option.expanded ? (
                    <ChevronDown className="size-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0" />
                  ))}
              </button>
              {group && option.expanded && option.childCount === 0 && (
                <div
                  data-slot="slash-palette-group-empty"
                  className="px-(--slash-inset) py-(--slash-padding) text-sm text-muted-foreground"
                >
                  {capabilityEmptyLabels?.[group] ?? emptyLabel}
                </div>
              )}
            </React.Fragment>
          );
        })
      ) : (
        <div className="px-(--slash-inset) py-(--slash-padding) text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
