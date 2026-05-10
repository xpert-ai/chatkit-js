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

import { cn } from '../../lib/utils';
import type {
  ResolvedSlashCommand,
  RuntimeCapabilityPaletteState,
  SlashPaletteOption,
} from '../../lib/slash-commands';
import type { RuntimeCapabilityOption } from '../../lib/runtime-capabilities';
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
}) {
  return (
    <div
      ref={paletteRef}
      data-slot="slash-palette"
      className={cn(
        'mb-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md',
        panelRoundedClass,
      )}
    >
      {options.length > 0 ? (
        options.map((option, index) => (
          <React.Fragment key={option.id}>
            <button
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              data-slot="slash-palette-option"
              data-kind={option.kind}
              data-depth={option.kind === 'capability' ? option.depth : 0}
              type="button"
              aria-expanded={
                option.kind === 'command' && option.capabilityType
                  ? option.expanded === true
                  : undefined
              }
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(option);
              }}
              className={cn(
                'flex h-8 w-full items-center gap-1 rounded-md px-2 text-left text-sm hover:bg-muted',
                itemRoundedClass,
                option.kind === 'capability' && option.depth === 1 && 'pl-9',
                index === palette.activeIndex && 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground',
                  option.kind === 'capability' &&
                    option.depth === 1 &&
                    'h-5 w-5',
                )}
              >
                {option.kind === 'command' ? (
                  <SlashCommandIcon command={option.command} />
                ) : (
                  <RuntimeCapabilityIcon
                    option={option.capability}
                    variant="list"
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="flex min-w-0 shrink-0 items-baseline gap-1.5">
                  <span className="truncate font-medium">{option.label}</span>
                  {option.kind === 'command' &&
                  option.capabilityType &&
                  typeof option.childCount === 'number' ? (
                    <span
                      data-slot="slash-palette-child-count"
                      className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium leading-none text-muted-foreground"
                    >
                      {option.childCount}
                    </span>
                  ) : null}
                </span>
                {option.description && (
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </span>
              {option.kind === 'command' && option.capabilityType ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
                  {option.expanded ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </span>
              ) : null}
            </button>
            {option.kind === 'command' &&
            option.capabilityType &&
            option.expanded &&
            option.childCount === 0 ? (
              <div
                data-slot="slash-palette-group-empty"
                className="px-3 py-1.5 pl-12 text-xs text-muted-foreground"
              >
                {capabilityEmptyLabels?.[option.capabilityType] ?? emptyLabel}
              </div>
            ) : null}
          </React.Fragment>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
