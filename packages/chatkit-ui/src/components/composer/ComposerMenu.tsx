import * as React from 'react';
import {
  ArrowLeft,
  FileText,
  Globe,
  Images,
  Info,
  Lightbulb,
  ListChecks,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import type {
  Client,
  RuntimeCapabilitiesResponse,
  RuntimeCapabilitySkill,
  RuntimeCapabilitySubAgent,
} from '@xpert-ai/xpert-sdk';
import type {
  ChatKitOptions,
  IconName,
  ToolOption,
} from '@xpert-ai/chatkit-types';

import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  getRuntimeSkillSource,
  isRuntimeCapabilitySelected,
  type RuntimeCapabilitiesSelection,
  type RuntimeCapabilityOption,
} from '../../lib/runtime-capabilities';
import {
  cn,
  getPanelRoundedClass,
} from '../../lib/utils';
import { useTheme } from '../../providers/Theme';
import { RuntimeCapabilityIcon } from '../runtime-capability-icon';
import { Button } from '../ui/button';
import { ChatkitAvatar, normalizeChatkitAvatar } from '../ui/chatkit-avatar';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { ConnectorMenuPanel } from './ConnectorMenuPanel';
import {
  ComposerMenuPrimaryPanel,
  type ComposerPanel,
  type PanelActivation,
} from './ComposerMenuPrimaryPanel';

const COMPOSER_MENU_EXPANDED_WIDTH_REM = 33;
const COMPOSER_MENU_COLLISION_PADDING = 12;

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
  connectorClient?: Client | null;
  connectorXpertId?: string;
  connectorProjectId?: string;
  selectedConnectorBindingIds?: string[];
  onConnectorSelectionChange?: (bindingIds: string[]) => void;
  connectorsEnabled?: boolean;
  unifiedResourcesEnabled?: boolean;
  apiUrl?: string;
  disabled?: boolean;
};

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

  return iconMap[icon] || iconMap.sparkle;
}

function Toggle({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid w-[calc(1.25rem+1rem*var(--chat-density-scale,1))] shrink-0 grid-cols-2 rounded-chat-item p-0.5 transition-colors',
        checked ? 'bg-primary' : 'bg-muted-foreground/20',
      )}
    >
      <span
        className={cn(
          'aspect-square w-full rounded-chat-item bg-background shadow-sm transition-transform',
          checked && 'translate-x-full',
        )}
      />
    </span>
  );
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
  connectorClient,
  connectorXpertId,
  connectorProjectId,
  selectedConnectorBindingIds,
  onConnectorSelectionChange,
  connectorsEnabled = false,
  unifiedResourcesEnabled = false,
  apiUrl,
  disabled = false,
}: ComposerMenuProps) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [activePanel, setActivePanel] = React.useState<ComposerPanel | null>(
    null,
  );
  const [query, setQuery] = React.useState('');
  const [collisionBoundary, setCollisionBoundary] =
    React.useState<HTMLElement>();
  const [canExpandSecondaryPanel, setCanExpandSecondaryPanel] =
    React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const focusSearchOnOpen = React.useRef(false);
  React.useLayoutEffect(() => {
    if (focusSearchOnOpen.current) searchInputRef.current?.focus();
    focusSearchOnOpen.current = false;
  }, [activePanel]);

  const roundedClass = 'rounded-chat-item';
  const panelRoundedClass = getPanelRoundedClass(theme.radius);
  const attachmentsEnabled = composer?.attachments?.enabled ?? false;
  const tools = composer?.tools ?? [];
  const skills = runtimeCapabilities?.skills ?? [];
  const subAgents = runtimeCapabilities?.subAgents ?? [];
  const selectedSkillCount =
    selectedRuntimeCapabilities?.skills.ids.length ?? 0;
  const selectedSubAgentCount =
    selectedRuntimeCapabilities?.subAgents?.nodeKeys.length ?? 0;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const boundary =
        triggerRef.current?.closest('[data-chatkit-root]') ?? undefined;
      setCollisionBoundary(
        boundary instanceof HTMLElement ? boundary : undefined,
      );
    } else {
      setActivePanel(null);
      setQuery('');
    }
    setOpen(nextOpen);
  };

  const choosePanel = (panel: ComposerPanel, activation: PanelActivation) => {
    if (panel === activePanel) {
      if (activation === 'select') searchInputRef.current?.focus();
      return;
    }
    focusSearchOnOpen.current = activation === 'select';
    setActivePanel(panel);
    setQuery('');
  };

  React.useLayoutEffect(() => {
    if (!open || !collisionBoundary) {
      setCanExpandSecondaryPanel(false);
      return;
    }

    const updateLayout = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        setCanExpandSecondaryPanel(false);
        return;
      }

      const boundaryRect = collisionBoundary.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const rootFontSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize,
      );
      const remInPixels = Number.isFinite(rootFontSize) ? rootFontSize : 16;
      const menuLeft = Math.max(
        triggerRect.left,
        boundaryRect.left + COMPOSER_MENU_COLLISION_PADDING,
      );
      const availableWidth =
        boundaryRect.right - COMPOSER_MENU_COLLISION_PADDING - menuLeft;
      const requiredWidth = COMPOSER_MENU_EXPANDED_WIDTH_REM * remInPixels;

      setCanExpandSecondaryPanel(availableWidth >= requiredWidth);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(updateLayout)
        : null;
    resizeObserver?.observe(collisionBoundary);
    if (triggerRef.current) {
      resizeObserver?.observe(triggerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateLayout);
      resizeObserver?.disconnect();
    };
  }, [collisionBoundary, open]);

  const returnToPrimaryPanel = () => {
    setActivePanel(null);
    setQuery('');
  };

  const activePanelLabel =
    activePanel === 'targets'
      ? t('composer.workbuddy.targets')
      : activePanel === 'experts'
        ? t('composer.workbuddy.experts')
        : activePanel === 'skills'
          ? t('composer.capabilities.skills')
          : activePanel === 'connectors'
            ? t('composer.workbuddy.connectors')
            : null;

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesQuery = (label: string, description?: string) =>
    !normalizedQuery ||
    `${label} ${description ?? ''}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);

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
              className="max-w-full truncate rounded-chat-item bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
            >
              {value}
            </span>
          ))}
          {values.length > 6 ? (
            <span className="rounded-chat-item bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              +{values.length - 6}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  const renderSubAgentDetailCard = (subAgent: RuntimeCapabilitySubAgent) => {
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

        {subAgent.description ? (
          <div className="line-clamp-4 text-xs leading-5 text-muted-foreground">
            {subAgent.description}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-chat-item bg-muted px-2 py-1">
            <span className="block text-[11px] text-muted-foreground">
              {t('composer.capabilities.type')}
            </span>
            <span className="font-medium">{agentKind}</span>
          </div>
          {subAgent.agentKey || subAgent.xpertId ? (
            <div className="rounded-chat-item bg-muted px-2 py-1">
              <span className="block text-[11px] text-muted-foreground">
                {t('composer.capabilities.identifier')}
              </span>
              <span className="block truncate font-mono text-[11px]">
                {subAgent.agentKey ?? subAgent.xpertId}
              </span>
            </div>
          ) : null}
        </div>

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

  const renderSubAgentInfoButton = (subAgent: RuntimeCapabilitySubAgent) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t('composer.capabilities.agentDetails')}
          data-slot="runtime-sub-agent-info-trigger"
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-chat-item text-muted-foreground hover:bg-muted hover:text-foreground"
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

  const renderCapabilityPanel = (
    panel: 'skills' | 'experts',
  ): React.ReactNode => {
    const isSkills = panel === 'skills';
    const filteredSkills = isSkills
      ? skills.filter((skill) => matchesQuery(skill.label, skill.description))
      : [];
    const renderSkillRow = (skill: RuntimeCapabilitySkill) => {
      const selected = selectedRuntimeCapabilities
        ? isRuntimeCapabilitySelected(
            selectedRuntimeCapabilities,
            'skill',
            skill.id,
          )
        : false;
      const skillDescription = skill.description ?? skill.repositoryName;
      return (
        <DropdownMenuCheckboxItem
          key={skill.id}
          checked={selected}
          indicator="check"
          onCheckedChange={(checked) =>
            onRuntimeCapabilityToggle?.('skill', skill.id, checked === true)
          }
          onSelect={(event) => event.preventDefault()}
          className={cn(
            'gap-(--composer-control-gap) py-(--composer-row-padding) pr-7',
            skillDescription ? 'items-start' : 'items-center',
            selected && 'bg-muted',
          )}
        >
          <span
            className={cn(
              'flex size-5 shrink-0 items-center justify-center text-muted-foreground',
              skillDescription && 'mt-0.5',
            )}
          >
            <RuntimeCapabilityIcon
              option={{
                type: 'skill',
                id: skill.id,
                label: skill.label,
                description: skill.description ?? skill.repositoryName,
                capability: skill,
              }}
              variant="list"
            />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate">{skill.label}</span>
            {skillDescription && (
              <span className="block truncate text-xs text-muted-foreground">
                {skillDescription}
              </span>
            )}
          </span>
        </DropdownMenuCheckboxItem>
      );
    };
    const expertSkills = filteredSkills.filter(
      (skill) => getRuntimeSkillSource(skill)?.type !== 'project',
    );
    const projectSkillGroups = new Map<string, RuntimeCapabilitySkill[]>();
    for (const skill of filteredSkills) {
      const source = getRuntimeSkillSource(skill);
      if (source?.type !== 'project') continue;
      const group = projectSkillGroups.get(source.label) ?? [];
      group.push(skill);
      projectSkillGroups.set(source.label, group);
    }
    const capabilityRows = isSkills
      ? []
      : subAgents
          .filter((subAgent) =>
            matchesQuery(subAgent.label, subAgent.description),
          )
          .map((subAgent) => {
            const selected = selectedRuntimeCapabilities
              ? isRuntimeCapabilitySelected(
                  selectedRuntimeCapabilities,
                  'subAgent',
                  subAgent.nodeKey,
                )
              : false;
            return (
              <DropdownMenuCheckboxItem
                key={subAgent.nodeKey}
                checked={selected}
                indicator="check"
                onCheckedChange={(checked) =>
                  onRuntimeCapabilityToggle?.(
                    'subAgent',
                    subAgent.nodeKey,
                    checked === true,
                  )
                }
                onSelect={(event) => event.preventDefault()}
                className={cn(
                  'items-start gap-(--composer-control-gap) py-(--composer-row-padding) pr-7',
                  selected && 'bg-muted',
                )}
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-muted-foreground">
                  <RuntimeCapabilityIcon
                    option={{
                      type: 'subAgent',
                      id: subAgent.nodeKey,
                      label: subAgent.label,
                      description: subAgent.description ?? subAgent.name,
                      capability: subAgent,
                    }}
                    variant="list"
                  />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate">{subAgent.label}</span>
                  {(subAgent.description || subAgent.name) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {subAgent.description ?? subAgent.name}
                    </span>
                  )}
                </span>
                {renderSubAgentInfoButton(subAgent)}
              </DropdownMenuCheckboxItem>
            );
          });

    const toolRows = isSkills
      ? tools
          .filter((tool) => matchesQuery(tool.label, tool.shortLabel))
          .map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={cn(
                'flex w-full items-center gap-(--composer-control-gap) rounded-chat-item px-1.5 py-(--composer-row-padding) text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted',
                selectedTool?.id === tool.id && 'bg-muted',
              )}
              onClick={() => {
                onToolSelect?.(tool);
                handleOpenChange(false);
              }}
            >
              <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                {getIconComponent(tool.icon)}
              </span>
              <span className="truncate">{tool.label}</span>
            </button>
          ))
      : [];

    return (
      <>
        <PanelSearch
          inputRef={searchInputRef}
          value={query}
          onChange={setQuery}
          placeholder={t(
            isSkills
              ? 'composer.workbuddy.searchSkills'
              : 'composer.workbuddy.searchExperts',
          )}
        />
        <div
          data-slot="composer-capability-scroll"
          className="max-h-72 overflow-y-auto overscroll-contain px-2 pb-2"
        >
          <div data-slot="composer-capability-list" className="space-y-1">
            {isSkills && expertSkills.length > 0 ? (
              <SkillGroup label={t('composer.workbuddy.expertSkills')}>
                {expertSkills.map(renderSkillRow)}
              </SkillGroup>
            ) : null}
            {isSkills
              ? Array.from(projectSkillGroups.entries()).map(
                  ([projectLabel, projectSkills]) => (
                    <SkillGroup
                      key={projectLabel}
                      label={t('composer.workbuddy.projectSkills', {
                        project: projectLabel,
                      })}
                    >
                      {projectSkills.map(renderSkillRow)}
                    </SkillGroup>
                  ),
                )
              : capabilityRows}
            {toolRows}
            {(isSkills ? filteredSkills.length : capabilityRows.length) === 0 &&
            toolRows.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                {t(
                  isSkills
                    ? 'composer.workbuddy.emptySkills'
                    : 'composer.workbuddy.emptyExperts',
                )}
              </div>
            ) : null}
          </div>
        </div>
      </>
    );
  };

  const secondaryPanelExpandsRight = Boolean(
    activePanel && activePanelLabel && canExpandSecondaryPanel,
  );

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          data-slot="composer-menu-trigger"
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-expanded={open}
          aria-label={open ? t('composer.closeMenu') : t('composer.openMenu')}
          className={cn(
            'size-9 shrink-0 transition-[background-color,border-radius] duration-300 hover:bg-foreground/10 dark:hover:bg-foreground/10 aria-expanded:bg-foreground/10',
            roundedClass,
          )}
        >
          <Plus
            className={cn(
              'size-5 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
              open && 'rotate-45',
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        collisionBoundary={collisionBoundary}
        collisionPadding={COMPOSER_MENU_COLLISION_PADDING}
        data-layout={canExpandSecondaryPanel ? 'wide' : 'narrow'}
        className={cn(
          'max-w-(--radix-dropdown-menu-content-available-width) overflow-hidden bg-transparent p-1 shadow-none ring-0',
          canExpandSecondaryPanel ? 'w-fit' : 'w-[16.5rem]',
          secondaryPanelExpandsRight && 'w-[33rem] overflow-visible',
        )}
      >
        <div
          data-slot="composer-menu-layout"
          className={cn(
            'flex items-end',
            secondaryPanelExpandsRight && 'w-full min-w-0 gap-2',
          )}
        >
          {(!activePanel || secondaryPanelExpandsRight) && (
            <ComposerMenuPrimaryPanel
              activePanel={activePanel}
              canPreview={canExpandSecondaryPanel}
              onOpenPanel={choosePanel}
              attachmentsEnabled={attachmentsEnabled}
              onAttachmentClick={onAttachmentClick}
              expertCount={selectedSubAgentCount}
              skillCount={selectedSkillCount}
              connectorCount={selectedConnectorBindingIds?.length ?? 0}
              connectorsEnabled={connectorsEnabled}
              unifiedResourcesEnabled={unifiedResourcesEnabled}
            />
          )}
          {activePanel && activePanelLabel && (
            <SecondaryPanel>
              {!secondaryPanelExpandsRight ? (
                <PanelHeader
                  label={activePanelLabel}
                  onBack={returnToPrimaryPanel}
                />
              ) : null}
              {activePanel === 'targets' ? (
                <div className="space-y-(--composer-row-padding) p-(--composer-row-padding)">
                  <DropdownMenuItem
                    role="switch"
                    aria-checked={goalPanelOpen}
                    disabled={!goalCommandAvailable}
                    onSelect={(event) => {
                      event.preventDefault();
                      onGoalPanelOpenChange?.(!goalPanelOpen);
                    }}
                    className={cn(goalPanelOpen && 'bg-muted')}
                  >
                    <Target className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      {t('chat.goal.label')}
                    </span>
                    <Toggle checked={goalPanelOpen} />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    role="switch"
                    aria-checked={planModeEnabled}
                    disabled={!onPlanModeChange}
                    onSelect={(event) => {
                      event.preventDefault();
                      onPlanModeChange?.(!planModeEnabled);
                    }}
                    className={cn(planModeEnabled && 'bg-muted')}
                  >
                    <ListChecks className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      {t('composer.planMode')}
                    </span>
                    <Toggle checked={planModeEnabled} />
                  </DropdownMenuItem>
                </div>
              ) : activePanel === 'experts' || activePanel === 'skills' ? (
                renderCapabilityPanel(activePanel)
              ) : (
                <ConnectorMenuPanel
                  client={connectorClient ?? null}
                  xpertId={connectorXpertId}
                  projectId={connectorProjectId}
                  selectedBindingIds={selectedConnectorBindingIds}
                  onSelectionChange={onConnectorSelectionChange}
                  apiUrl={apiUrl}
                />
              )}
            </SecondaryPanel>
          )}
        </div>
      </DropdownMenuContent>

      {planModeEnabled ? (
        <ActiveIndicator
          label={t('composer.planModeActive')}
          ariaLabel={t('composer.disablePlanMode')}
          icon={<ListChecks />}
          roundedClass={roundedClass}
          disabled={disabled}
          onClick={() => onPlanModeChange?.(false)}
        />
      ) : null}
      {goalCommandAvailable && goalPanelOpen ? (
        <ActiveIndicator
          label={t('chat.goal.label')}
          ariaLabel={t('chat.goal.hide')}
          icon={<Target />}
          roundedClass={roundedClass}
          disabled={disabled}
          onClick={() => onGoalPanelOpenChange?.(false)}
        />
      ) : null}
    </DropdownMenu>
  );
}

function PanelHeader({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <>
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault();
          onBack();
        }}
        data-slot="composer-panel-back"
        className="font-normal"
      >
        <ArrowLeft className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1">{label}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator className="my-0" />
    </>
  );
}

function SecondaryPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-slot="composer-secondary-panel"
      className="min-w-0 max-w-full flex-1 overflow-hidden rounded-chat-panel bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
    >
      <div
        data-slot="composer-secondary-scroll"
        className="w-full min-w-0 overflow-x-hidden"
      >
        <div className="w-full min-w-0">{children}</div>
      </div>
    </div>
  );
}

function PanelSearch({
  inputRef,
  value,
  onChange,
  placeholder,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div data-slot="composer-panel-search" className="p-(--composer-control-padding-inline)">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          onKeyDown={(event) => {
            if (event.key.length === 1) event.stopPropagation();
          }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-(--composer-control-height) border-0 bg-muted py-0 pl-8 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  );
}

function SkillGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section data-slot="composer-skill-group" className="space-y-1">
      <div className="px-1.5 pt-1 text-xs font-normal text-muted-foreground">
        {label}
      </div>
      {children}
    </section>
  );
}

function ActiveIndicator({
  label,
  ariaLabel,
  icon,
  roundedClass,
  disabled,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  icon: React.ReactElement<{ className?: string }>;
  roundedClass: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group/indicator inline-flex h-8 shrink-0 items-center border border-primary/30 bg-primary/10 px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15',
        roundedClass,
      )}
    >
      {React.cloneElement(icon, { className: 'mr-1.5 size-3.5' })}
      <span>{label}</span>
      <X className="ml-0 h-3.5 w-0 shrink-0 overflow-hidden opacity-0 transition-[width,margin,opacity] duration-200 group-hover/indicator:ml-1 group-hover/indicator:w-3.5 group-hover/indicator:opacity-100 group-focus-visible/indicator:ml-1 group-focus-visible/indicator:w-3.5 group-focus-visible/indicator:opacity-100" />
    </button>
  );
}

export default ComposerMenu;
