import * as React from 'react';
import {
  ArrowLeft,
  Bot,
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
  WandSparkles,
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
  getMenuItemRoundedClass,
  getPanelRoundedClass,
  getRoundedClass,
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

type ComposerPanel = 'targets' | 'experts' | 'skills' | 'connectors';

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
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted-foreground/20',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
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
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const roundedClass = getRoundedClass(theme.radius);
  const panelRoundedClass = getPanelRoundedClass(theme.radius);
  const menuItemRoundedClass = getMenuItemRoundedClass(theme.radius);
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

  const choosePanel = (panel: ComposerPanel) => {
    setActivePanel(panel);
    setQuery('');
  };

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
              className="max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
            >
              {value}
            </span>
          ))}
          {values.length > 6 ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
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
          <div className="rounded-md bg-muted px-2 py-1">
            <span className="block text-[11px] text-muted-foreground">
              {t('composer.capabilities.type')}
            </span>
            <span className="font-medium">{agentKind}</span>
          </div>
          {subAgent.agentKey || subAgent.xpertId ? (
            <div className="rounded-md bg-muted px-2 py-1">
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
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
          onCheckedChange={(checked) =>
            onRuntimeCapabilityToggle?.('skill', skill.id, checked === true)
          }
          onSelect={(event) => event.preventDefault()}
          className={cn(
            'gap-3 p-1.5 pr-9',
            skillDescription ? 'items-start' : 'items-center',
            menuItemRoundedClass,
            selected && 'bg-muted',
          )}
        >
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center text-muted-foreground',
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
                onCheckedChange={(checked) =>
                  onRuntimeCapabilityToggle?.(
                    'subAgent',
                    subAgent.nodeKey,
                    checked === true,
                  )
                }
                onSelect={(event) => event.preventDefault()}
                className={cn(
                  'items-start gap-3 p-1.5 pr-9',
                  menuItemRoundedClass,
                  selected && 'bg-muted',
                )}
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center text-muted-foreground">
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
                'flex w-full items-center gap-3 rounded-md p-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted',
                selectedTool?.id === tool.id && 'bg-muted',
              )}
              onClick={() => {
                onToolSelect?.(tool);
                setOpen(false);
              }}
            >
              <span className="flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                {getIconComponent(tool.icon)}
              </span>
              <span className="truncate">{tool.label}</span>
            </button>
          ))
      : [];

    return (
      <>
        <PanelSearch
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

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-expanded={open}
          aria-label={open ? t('composer.closeMenu') : t('composer.openMenu')}
          className={cn(
            'size-9 shrink-0 transition-[background-color,border-radius] duration-300 hover:bg-muted',
            open ? 'rounded-full bg-muted' : roundedClass,
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
        collisionPadding={12}
        className="w-[16.5rem] max-w-(--radix-dropdown-menu-content-available-width) overflow-hidden bg-transparent p-1 shadow-none ring-0"
      >
        {activePanel && activePanelLabel ? (
          <SecondaryPanel panelRoundedClass={panelRoundedClass}>
            <PanelHeader
              label={activePanelLabel}
              onBack={returnToPrimaryPanel}
              className={menuItemRoundedClass}
            />
            {activePanel === 'targets' ? (
              <div className="space-y-1 p-1">
                <DropdownMenuItem
                  role="switch"
                  aria-checked={goalPanelOpen}
                  disabled={!goalCommandAvailable}
                  onSelect={(event) => {
                    event.preventDefault();
                    onGoalPanelOpenChange?.(!goalPanelOpen);
                  }}
                  className={cn(
                    'gap-3 p-1.5',
                    menuItemRoundedClass,
                    goalPanelOpen && 'bg-muted',
                  )}
                >
                  <Target className="size-5" />
                  <span className="min-w-0 flex-1 text-base">
                    {t('chat.goal.label')}
                  </span>
                  <Toggle checked={goalPanelOpen} />
                </DropdownMenuItem>
                <DropdownMenuItem
                  role="switch"
                  aria-checked={planModeEnabled}
                  onSelect={(event) => {
                    event.preventDefault();
                    onPlanModeChange?.(!planModeEnabled);
                  }}
                  className={cn(
                    'gap-3 p-1.5',
                    menuItemRoundedClass,
                    planModeEnabled && 'bg-muted',
                  )}
                >
                  <ListChecks className="size-5" />
                  <span className="min-w-0 flex-1 text-base">
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
        ) : (
          <div
            data-slot="composer-primary-panel"
            className={cn(
              'w-64 max-w-full overflow-hidden bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10',
              panelRoundedClass,
            )}
          >
            <DropdownMenuItem
              disabled={!attachmentsEnabled}
              onSelect={onAttachmentClick}
              className={cn('gap-3 p-1.5 font-normal', menuItemRoundedClass)}
            >
              <Paperclip className="size-5" />
              <span className="flex-1 text-base">
                {t('composer.addAttachment')}
              </span>
              <ChevronRight className="size-4" />
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-2" />
            <PrimaryPanelItem
              icon={<Target />}
              label={t('composer.workbuddy.targets')}
              active={activePanel === 'targets'}
              onSelect={() => choosePanel('targets')}
              className={menuItemRoundedClass}
            />
            <PrimaryPanelItem
              icon={<Bot />}
              label={t('composer.workbuddy.experts')}
              count={selectedSubAgentCount}
              active={activePanel === 'experts'}
              onSelect={() => choosePanel('experts')}
              className={menuItemRoundedClass}
            />
            <PrimaryPanelItem
              icon={<WandSparkles />}
              label={t('composer.capabilities.skills')}
              count={selectedSkillCount}
              active={activePanel === 'skills'}
              onSelect={() => choosePanel('skills')}
              className={menuItemRoundedClass}
            />
            <PrimaryPanelItem
              icon={<Plug />}
              label={t('composer.workbuddy.connectors')}
              count={selectedConnectorBindingIds?.length ?? 0}
              active={activePanel === 'connectors'}
              disabled={!connectorsEnabled}
              onSelect={() => choosePanel('connectors')}
              className={menuItemRoundedClass}
            />
          </div>
        )}
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
  className,
}: {
  label: string;
  onBack: () => void;
  className: string;
}) {
  return (
    <>
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault();
          onBack();
        }}
        className={cn('gap-3 p-1.5 font-normal', className)}
      >
        <ArrowLeft className="size-5" />
        <span className="min-w-0 flex-1 text-base">{label}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator className="my-0" />
    </>
  );
}

function PrimaryPanelItem({
  icon,
  label,
  count = 0,
  active,
  disabled,
  onSelect,
  className,
}: {
  icon: React.ReactElement<{ className?: string }>;
  label: string;
  count?: number;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  className: string;
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={(event) => {
        event.preventDefault();
        onSelect();
      }}
      className={cn('gap-3 p-1.5 font-normal', className, active && 'bg-muted')}
    >
      {React.cloneElement(icon, { className: 'size-5' })}
      <span className="min-w-0 flex-1 text-base">{label}</span>
      {count > 0 ? (
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-normal text-primary">
          {count}
        </span>
      ) : null}
      <ChevronRight className="size-4" />
    </DropdownMenuItem>
  );
}

function SecondaryPanel({
  panelRoundedClass,
  children,
}: {
  panelRoundedClass: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="composer-secondary-panel"
      className={cn(
        'w-64 min-w-0 max-w-full overflow-hidden bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10',
        panelRoundedClass,
      )}
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
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div data-slot="composer-panel-search" className="px-2 pt-1 pb-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-8 border-0 bg-muted pl-10 text-base shadow-none focus-visible:ring-1"
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
