import * as React from 'react';
import {
  ArrowLeft,
  Bot,
  Brain,
  ChevronRight,
  FileText,
  Globe,
  Images,
  Info,
  Lightbulb,
  ListChecks,
  Paperclip,
  Pencil,
  Plug,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import type {
  RuntimeCapabilitiesResponse,
  RuntimeCapabilitySubAgent,
} from '@xpert-ai/xpert-sdk';
import type {
  ToolOption,
  ChatKitOptions,
  IconName,
} from '@xpert-ai/chatkit-types';
import {
  cn,
  getMenuItemRoundedClass,
  getPanelRoundedClass,
  getRoundedClass,
} from '../../lib/utils';
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
  type RuntimeCapabilitiesSelection,
  type RuntimeCapabilityOption,
} from '../../lib/runtime-capabilities';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { ChatkitAvatar, normalizeChatkitAvatar } from '../ui/chatkit-avatar';
import { RuntimeCapabilityIcon } from '../runtime-capability-icon';

type CapabilityPanel = 'skills' | 'plugins' | 'subAgents';

export type ComposerMenuProps = {
  composer?: ChatKitOptions['composer'];
  onAttachmentClick?: () => void;
  onToolSelect?: (tool: ToolOption) => void;
  selectedTool?: ToolOption | null;
  planModeEnabled?: boolean;
  onPlanModeChange?: (enabled: boolean) => void;
  goalCommandAvailable?: boolean;
  goalPanelOpen?: boolean;
  onGoalPanelOpenChange?: (open: boolean) => void;
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
    plus: <Plus size={16} />,
    document: <FileText size={16} />,
    write: <Pencil size={16} />,
    sparkle: <Sparkles size={16} />,
    lightbulb: <Lightbulb size={16} />,
    'settings-slider': <SlidersHorizontal size={16} />,
    search: <Search size={16} />,
    globe: <Globe size={16} />,
    images: <Images size={16} />,
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
  goalCommandAvailable = false,
  goalPanelOpen = false,
  onGoalPanelOpenChange,
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
  const panelRoundedClass = getPanelRoundedClass(theme.radius);
  const menuItemRoundedClass = getMenuItemRoundedClass(theme.radius);

  const attachmentsEnabled = composer?.attachments?.enabled ?? false;
  const tools = composer?.tools ?? [];
  const skills = runtimeCapabilities?.skills ?? [];
  const plugins = runtimeCapabilities?.plugins ?? [];
  const subAgents = runtimeCapabilities?.subAgents ?? [];
  const hasRuntimeCapabilities =
    skills.length > 0 || plugins.length > 0 || subAgents.length > 0;
  const selectedSkillCount =
    selectedRuntimeCapabilities?.skills.ids.length ?? 0;
  const selectedPluginCount =
    selectedRuntimeCapabilities?.plugins.nodeKeys.length ?? 0;
  const selectedSubAgentCount =
    selectedRuntimeCapabilities?.subAgents?.nodeKeys.length ?? 0;

  const handleAttachmentClick = () => {
    onAttachmentClick?.();
  };

  const handleToolSelect = (tool: ToolOption) => {
    onToolSelect?.(tool);
  };

  const handlePlanModeToggle = () => {
    onPlanModeChange?.(!planModeEnabled);
  };

  const handleGoalCommandClick = () => {
    onGoalPanelOpenChange?.(!goalPanelOpen);
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

  const getParameterLabels = (subAgent: RuntimeCapabilitySubAgent) =>
    (subAgent.parameters ?? [])
      .map((parameter) => {
        if (!parameter || typeof parameter !== 'object') return null;
        const record = parameter as Record<string, unknown>;
        return (
          (typeof record.title === 'string' && record.title.trim()) ||
          (typeof record.name === 'string' && record.name.trim()) ||
          null
        );
      })
      .filter((value): value is string => Boolean(value));

  const renderDetailPills = (label: string, values?: string[]) => {
    if (!values?.length) return null;

    return (
      <div className="space-y-1">
        <div className="text-[11px] font-medium uppercase text-muted-foreground">
          {label}
        </div>
        <div className="flex flex-wrap gap-1">
          {values.slice(0, 6).map((value) => (
            <span
              key={value}
              className="max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
            >
              {value}
            </span>
          ))}
          {values.length > 6 && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              +{values.length - 6}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderSubAgentInfoButton = (subAgent: RuntimeCapabilitySubAgent) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t('composer.capabilities.agentDetails')}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          data-slot="runtime-sub-agent-info-trigger"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Info size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        sideOffset={8}
        hideArrow
        className="bg-transparent p-0 text-popover-foreground shadow-none"
      >
        {renderSubAgentDetailCard(subAgent)}
      </TooltipContent>
    </Tooltip>
  );

  const renderSubAgentDetailCard = (subAgent: RuntimeCapabilitySubAgent) => {
    const parameterLabels = getParameterLabels(subAgent);
    const agentKind =
      subAgent.type === 'xpert'
        ? t('composer.capabilities.xpertAgent')
        : t('composer.capabilities.agent');

    return (
      <div
        data-slot="runtime-sub-agent-detail-card"
        className={cn(
          'pointer-events-none w-80 space-y-3 border border-border bg-popover p-3 text-popover-foreground shadow-lg',
          panelRoundedClass,
        )}
      >
        <div className="flex items-start gap-3">
          <ChatkitAvatar
            avatar={normalizeChatkitAvatar(subAgent.avatar)}
            label={subAgent.label}
            className="h-9 w-9 shrink-0"
            fallbackClassName="text-xs"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{subAgent.label}</div>
            <div className="truncate text-xs text-muted-foreground">
              {subAgent.name ?? agentKind}
            </div>
          </div>
        </div>

        {subAgent.description && (
          <div className="line-clamp-4 text-xs leading-5 text-muted-foreground">
            {subAgent.description}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted px-2 py-1">
            <span className="block text-[11px] text-muted-foreground">
              {t('composer.capabilities.type')}
            </span>
            <span className="font-medium">{agentKind}</span>
          </div>
          {(subAgent.agentKey || subAgent.xpertId) && (
            <div className="rounded-md bg-muted px-2 py-1">
              <span className="block text-[11px] text-muted-foreground">
                {t('composer.capabilities.identifier')}
              </span>
              <span className="block truncate font-mono text-[11px]">
                {subAgent.agentKey ?? subAgent.xpertId}
              </span>
            </div>
          )}
        </div>

        {renderDetailPills(t('composer.capabilities.inputs'), parameterLabels)}
        {renderDetailPills(
          t('composer.capabilities.tools'),
          subAgent.toolNames,
        )}
        {renderDetailPills(
          t('composer.capabilities.toolsets'),
          subAgent.toolsetNames,
        )}
        {renderDetailPills(
          t('composer.capabilities.knowledge'),
          subAgent.knowledgebaseNames,
        )}
      </div>
    );
  };

  const renderCapabilityRow = (
    type: RuntimeCapabilityOption['type'],
    item: {
      id: string;
      label: string;
      description?: string;
      fallbackDescription?: string;
      capability: RuntimeCapabilityOption;
      subAgent?: RuntimeCapabilitySubAgent;
    },
  ) => {
    const selected = selectedRuntimeCapabilities
      ? isRuntimeCapabilitySelected(selectedRuntimeCapabilities, type, item.id)
      : false;
    const icon = (
      <RuntimeCapabilityIcon option={item.capability} variant="list" />
    );

    const row = (
      <DropdownMenuCheckboxItem
        key={item.id}
        checked={selected}
        onCheckedChange={(checked) =>
          onRuntimeCapabilityToggle?.(type, item.id, checked === true)
        }
        onSelect={(event) => event.preventDefault()}
        className={cn(
          'items-start gap-3 px-3 py-2 pr-8',
          menuItemRoundedClass,
          selected && 'bg-muted',
        )}
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate">{item.label}</span>
          {(item.description || item.fallbackDescription) && (
            <span className="block truncate text-xs text-muted-foreground">
              {item.description ?? item.fallbackDescription}
            </span>
          )}
        </span>
        {type === 'subAgent' && item.subAgent
          ? renderSubAgentInfoButton(item.subAgent)
          : null}
      </DropdownMenuCheckboxItem>
    );

    return row;
  };

  const renderCapabilityPanel = (panel: CapabilityPanel) => {
    const title =
      panel === 'skills'
        ? t('composer.capabilities.skills')
        : panel === 'plugins'
          ? t('composer.capabilities.plugins')
          : t('composer.capabilities.subAgents');

    const rows =
      panel === 'skills'
        ? skills.map((skill) =>
            renderCapabilityRow('skill', {
              id: skill.id,
              label: skill.label,
              description: skill.description,
              fallbackDescription: skill.repositoryName,
              capability: {
                type: 'skill',
                id: skill.id,
                label: skill.label,
                description: skill.description ?? skill.repositoryName,
                capability: skill,
              },
            }),
          )
        : panel === 'plugins'
          ? plugins.map((plugin) =>
              renderCapabilityRow('plugin', {
                id: plugin.nodeKey,
                label: plugin.label,
                description: plugin.description,
                fallbackDescription: plugin.provider,
                capability: {
                  type: 'plugin',
                  id: plugin.nodeKey,
                  label: plugin.label,
                  description: plugin.description ?? plugin.provider,
                  capability: plugin,
                },
              }),
            )
          : subAgents.map((subAgent) =>
              renderCapabilityRow('subAgent', {
                id: subAgent.nodeKey,
                label: subAgent.label,
                description: subAgent.description,
                fallbackDescription: subAgent.name,
                capability: {
                  type: 'subAgent',
                  id: subAgent.nodeKey,
                  label: subAgent.label,
                  description: subAgent.description ?? subAgent.name,
                  capability: subAgent,
                },
                subAgent,
              }),
            );

    return (
      <>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            setActivePanel(null);
          }}
          className={cn('gap-3 px-3 py-2', menuItemRoundedClass)}
        >
          <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
            <ArrowLeft size={16} />
          </span>
          <span className="min-w-0 flex-1 text-left">{title}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {rows}
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
          panelRoundedClass,
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
                  className={cn('gap-3 px-3 py-2', menuItemRoundedClass)}
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
                menuItemRoundedClass,
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

            {goalCommandAvailable && (
              <DropdownMenuItem
                role="switch"
                aria-checked={goalPanelOpen}
                onSelect={(event) => {
                  event.preventDefault();
                  handleGoalCommandClick();
                }}
                className={cn(
                  'gap-3 px-3 py-2',
                  menuItemRoundedClass,
                  goalPanelOpen && 'bg-muted',
                )}
              >
                <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                  <Target size={16} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  {t('chat.goal.label')}
                </span>
                <span
                  className={cn(
                    'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
                    goalPanelOpen ? 'bg-primary' : 'bg-muted-foreground/20',
                  )}
                  aria-hidden="true"
                >
                  <span
                    className={cn(
                      'inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
                      goalPanelOpen ? 'translate-x-[18px]' : 'translate-x-0.5',
                    )}
                  />
                </span>
              </DropdownMenuItem>
            )}

            {hasRuntimeCapabilities && (
              <>
                <DropdownMenuSeparator />
                {skills.length > 0 && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setActivePanel('skills');
                    }}
                    className={cn('gap-3 px-3 py-2', menuItemRoundedClass)}
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
                    className={cn('gap-3 px-3 py-2', menuItemRoundedClass)}
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

                {subAgents.length > 0 && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setActivePanel('subAgents');
                    }}
                    className={cn('gap-3 px-3 py-2', menuItemRoundedClass)}
                  >
                    <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                      <Bot size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      {t('composer.capabilities.subAgents')}
                    </span>
                    {selectedSubAgentCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        {selectedSubAgentCount}
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
                  menuItemRoundedClass,
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
      {planModeEnabled && (
        <button
          type="button"
          aria-label={t('composer.disablePlanMode')}
          disabled={disabled}
          onClick={() => onPlanModeChange?.(false)}
          className={cn(
            'group inline-flex h-8 shrink-0 items-center gap-1.5 border border-primary/30 bg-primary/10 px-2 text-xs font-medium text-primary transition-all duration-200 hover:bg-primary/15',
            roundedClass,
          )}
        >
          <span className="relative inline-flex h-4 w-4 items-center justify-center">
            <ListChecks
              data-slot="plan-mode-indicator-icon"
              size={14}
              className="absolute transition-all duration-150 group-hover:scale-75 group-hover:opacity-0"
            />
            <X
              data-slot="plan-mode-remove-icon"
              size={14}
              className="absolute scale-75 opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100"
            />
          </span>
          <span>{t('composer.planModeActive')}</span>
        </button>
      )}
      {goalCommandAvailable && goalPanelOpen && (
        <button
          type="button"
          aria-label={t('chat.goal.hide')}
          disabled={disabled}
          onClick={() => onGoalPanelOpenChange?.(false)}
          className={cn(
            'group inline-flex h-8 shrink-0 items-center gap-1.5 border border-primary/30 bg-primary/10 px-2 text-xs font-medium text-primary transition-all duration-200 hover:bg-primary/15',
            roundedClass,
          )}
        >
          <span className="relative inline-flex h-4 w-4 items-center justify-center">
            <Target
              data-slot="goal-indicator-icon"
              size={14}
              className="absolute transition-all duration-150 group-hover:scale-75 group-hover:opacity-0"
            />
            <X
              data-slot="goal-remove-icon"
              size={14}
              className="absolute scale-75 opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100"
            />
          </span>
          <span>{t('chat.goal.label')}</span>
        </button>
      )}
    </DropdownMenu>
  );
}

export default ComposerMenu;
