import * as React from 'react';
import {
  ArrowLeft,
  Brain,
  ChevronRight,
  FileText,
  Globe,
  Images,
  Lightbulb,
  ListChecks,
  Paperclip,
  Pencil,
  Plug,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type {
  ToolOption,
  ChatKitOptions,
  IconName,
  RuntimeCapabilitiesResponse,
  RuntimeCapabilitiesSelection,
} from '@xpert-ai/chatkit-types';
import { cn, getRoundedClass } from '../../lib/utils';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import {
  isRuntimeCapabilitySelected,
  type RuntimeCapabilityOption,
} from '../../lib/runtime-capabilities';

type CapabilityPanel = 'skills' | 'plugins';

export type ComposerMenuProps = {
  composer?: ChatKitOptions['composer'];
  onAttachmentClick?: () => void;
  onToolSelect?: (tool: ToolOption) => void;
  selectedTool?: ToolOption | null;
  planModeEnabled?: boolean;
  onPlanModeChange?: (enabled: boolean) => void;
  runtimeCapabilities?: RuntimeCapabilitiesResponse | null;
  selectedRuntimeCapabilities?: RuntimeCapabilitiesSelection | null;
  onRuntimeCapabilityToggle?: (
    type: RuntimeCapabilityOption['type'],
    id: string,
    selected: boolean,
  ) => void;
  disabled?: boolean;
};

// Icon mapping for XpertIcon types
function getIconComponent(icon: IconName): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    'plus': <Plus size={16} />,
    'document': <FileText size={16} />,
    'write': <Pencil size={16} />,
    'sparkle': <Sparkles size={16} />,
    'lightbulb': <Lightbulb size={16} />,
    'settings-slider': <SlidersHorizontal size={16} />,
    'search': <Search size={16} />,
    'globe': <Globe size={16} />,
    'images': <Images size={16} />,
  };

  return iconMap[icon] || iconMap['sparkle'];
}

export function ComposerMenu({
  composer,
  onAttachmentClick,
  onToolSelect,
  selectedTool,
  planModeEnabled = false,
  onPlanModeChange,
  runtimeCapabilities,
  selectedRuntimeCapabilities,
  onRuntimeCapabilityToggle,
  disabled = false,
}: ComposerMenuProps) {
  const { t } = useChatkitTranslation();
  const [open, setOpen] = React.useState(false);
  const [activePanel, setActivePanel] = React.useState<CapabilityPanel | null>(
    null,
  );
  const [collisionBoundary, setCollisionBoundary] =
    React.useState<HTMLElement>();
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const { theme } = useTheme();

  const roundedClass = getRoundedClass(theme.radius);

  const attachmentsEnabled = composer?.attachments?.enabled ?? false;
  const tools = composer?.tools ?? [];
  const skills = runtimeCapabilities?.skills ?? [];
  const plugins = runtimeCapabilities?.plugins ?? [];
  const hasRuntimeCapabilities = skills.length > 0 || plugins.length > 0;
  const selectedSkillCount = selectedRuntimeCapabilities?.skills.ids.length ?? 0;
  const selectedPluginCount =
    selectedRuntimeCapabilities?.plugins.nodeKeys.length ?? 0;

  const handleAttachmentClick = () => {
    onAttachmentClick?.();
  };

  const handleToolSelect = (tool: ToolOption) => {
    onToolSelect?.(tool);
  };

  const handlePlanModeToggle = () => {
    onPlanModeChange?.(!planModeEnabled);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const boundary =
        triggerRef.current?.closest('[data-chatkit-root]') ?? undefined;
      setCollisionBoundary(
        boundary instanceof HTMLElement ? boundary : undefined,
      );
    } else {
      setActivePanel(null);
    }

    setOpen(nextOpen);
  };

  const collisionProps = {
    collisionBoundary,
    collisionPadding: 8,
  };

  const renderCapabilityRow = (
    type: RuntimeCapabilityOption['type'],
    item: {
      id: string;
      label: string;
      description?: string;
      fallbackDescription?: string;
    },
  ) => {
    const selected = selectedRuntimeCapabilities
      ? isRuntimeCapabilitySelected(selectedRuntimeCapabilities, type, item.id)
      : false;
    const Icon = type === 'skill' ? Brain : Plug;

    return (
      <DropdownMenuCheckboxItem
        key={item.id}
        checked={selected}
        onCheckedChange={(checked) =>
          onRuntimeCapabilityToggle?.(type, item.id, checked === true)
        }
        onSelect={(event) => event.preventDefault()}
        className={cn(
          'items-start gap-3 px-3 py-2 pr-8',
          roundedClass,
          selected && 'bg-muted',
        )}
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate">{item.label}</span>
          {(item.description || item.fallbackDescription) && (
            <span className="block truncate text-xs text-muted-foreground">
              {item.description ?? item.fallbackDescription}
            </span>
          )}
        </span>
      </DropdownMenuCheckboxItem>
    );
  };

  const renderCapabilityPanel = (panel: CapabilityPanel) => {
    const isSkillsPanel = panel === 'skills';
    const title = isSkillsPanel
      ? t('composer.capabilities.skills')
      : t('composer.capabilities.plugins');

    return (
      <>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            setActivePanel(null);
          }}
          className={cn('gap-3 px-3 py-2', roundedClass)}
        >
          <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
            <ArrowLeft size={16} />
          </span>
          <span className="min-w-0 flex-1 text-left">{title}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isSkillsPanel
          ? skills.map((skill) =>
              renderCapabilityRow('skill', {
                id: skill.id,
                label: skill.label,
                description: skill.description,
                fallbackDescription: skill.repositoryName,
              }),
            )
          : plugins.map((plugin) =>
              renderCapabilityRow('plugin', {
                id: plugin.nodeKey,
                label: plugin.label,
                description: plugin.description,
                fallbackDescription: plugin.provider,
              }),
            )}
      </>
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            'h-10 w-10 shrink-0 hover:bg-muted',
            roundedClass,
            open && 'bg-muted',
          )}
        >
          <Plus size={18} />
          <span className="sr-only">{t('composer.openMenu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        {...collisionProps}
        className={cn(
          'max-h-[70vh] max-w-[calc(100vw-1rem)] overflow-y-auto p-1',
          activePanel ? 'w-80 min-w-72' : 'w-72',
          roundedClass,
        )}
      >
        {activePanel ? (
          renderCapabilityPanel(activePanel)
        ) : (
          <>
            {/* Attachments - always on top */}
            {attachmentsEnabled && (
              <>
                <DropdownMenuItem
                  onSelect={handleAttachmentClick}
                  className={cn('gap-3 px-3 py-2', roundedClass)}
                >
                  <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                    <Paperclip size={16} />
                  </span>
                  <span>{t('composer.addAttachment')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem
              role="switch"
              aria-checked={planModeEnabled}
              onSelect={(event) => {
                event.preventDefault();
                handlePlanModeToggle();
              }}
              className={cn(
                'gap-3 px-3 py-2',
                roundedClass,
                planModeEnabled && 'bg-muted',
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                <ListChecks size={16} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                {t('composer.planMode')}
              </span>
              <span
                className={cn(
                  'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
                  planModeEnabled ? 'bg-primary' : 'bg-muted-foreground/20',
                )}
                aria-hidden="true"
              >
                <span
                  className={cn(
                    'inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
                    planModeEnabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                  )}
                />
              </span>
            </DropdownMenuItem>

            {hasRuntimeCapabilities && (
              <>
                <DropdownMenuSeparator />
                {skills.length > 0 && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setActivePanel('skills');
                    }}
                    className={cn('gap-3 px-3 py-2', roundedClass)}
                  >
                    <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                      <Brain size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      {t('composer.capabilities.skills')}
                    </span>
                    {selectedSkillCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        {selectedSkillCount}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </DropdownMenuItem>
                )}

                {plugins.length > 0 && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setActivePanel('plugins');
                    }}
                    className={cn('gap-3 px-3 py-2', roundedClass)}
                  >
                    <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                      <Plug size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      {t('composer.capabilities.plugins')}
                    </span>
                    {selectedPluginCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        {selectedPluginCount}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </DropdownMenuItem>
                )}
              </>
            )}

            {tools.length > 0 && <DropdownMenuSeparator />}

            {/* Tools */}
            {tools.map((tool) => (
              <DropdownMenuItem
                key={tool.id}
                onSelect={() => handleToolSelect(tool)}
                className={cn(
                  'gap-3 px-3 py-2',
                  roundedClass,
                  selectedTool?.id === tool.id && 'bg-muted',
                )}
              >
                <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                  {getIconComponent(tool.icon)}
                </span>
                <span>{tool.label}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ComposerMenu;
