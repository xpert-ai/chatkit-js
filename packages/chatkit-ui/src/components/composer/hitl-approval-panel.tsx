import * as React from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  MessageSquare,
  Pencil,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import type {
  HITLActionRequest,
  HITLDecision,
  HITLDecisionType,
  HITLReviewConfig,
} from '@xpert-ai/chatkit-types';

import type { PendingHITLRequest } from '../../lib/hitl';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { cn, getRoundedClass } from '../../lib/utils';
import { useTheme } from '../../providers/Theme';
import { JsonTreeView, toJsonValue } from '../thread/json-tree-view';

export type HITLApprovalPanelProps = {
  request: PendingHITLRequest | null;
  onSubmit: (decisions: HITLDecision[]) => void;
  onDismiss?: () => void;
  attachToComposer?: boolean;
  className?: string;
};

type DecisionDraft = {
  type: HITLDecisionType;
  argsText?: string;
  message?: string;
};

type DecisionBuildResult =
  | {
      decisions: HITLDecision[];
      error?: undefined;
    }
  | {
      decisions: HITLDecision[];
      error: {
        actionIndex: number;
        message: string;
      };
    };

const decisionOrder: HITLDecisionType[] = [
  'approve',
  'edit',
  'reject',
  'respond',
];

const decisionMeta: Record<
  HITLDecisionType,
  { icon: LucideIcon; labelKey: string }
> = {
  approve: { icon: Check, labelKey: 'composer.hitl.approve' },
  edit: { icon: Pencil, labelKey: 'composer.hitl.edit' },
  reject: { icon: X, labelKey: 'composer.hitl.reject' },
  respond: { icon: MessageSquare, labelKey: 'composer.hitl.respond' },
};

const emptyActions: HITLActionRequest[] = [];
const emptyReviewConfigs: HITLReviewConfig[] = [];

function useRoundedClasses() {
  const { theme } = useTheme();
  const density = theme.density ?? 'normal';
  const densityClasses =
    {
      compact: {
        section: 'px-3.5 py-2',
        eyebrow: 'mb-0 text-[11px]',
        title: 'text-[15px] leading-5',
        pager: 'gap-1.5 text-xs',
        pagerButton: 'h-6 w-6',
        pagerIcon: 'h-3.5 w-3.5',
        body: 'mt-2 space-y-2',
        tabs: 'gap-1.5',
        decisionButton: 'h-6 px-1.5 text-[11px]',
        decisionIcon: 'h-3 w-3',
        textarea: 'min-h-24 text-xs',
        json: 'max-h-32 px-2.5 py-1.5',
        footer: 'mt-2.5 gap-2',
        dismissButton: 'h-6 px-1.5 text-xs',
        continueButton: 'h-7 px-2.5 text-xs',
        continueIcon: 'h-4 min-w-4',
      },
      normal: {
        section: 'px-4 py-2.5',
        eyebrow: 'mb-0.5 text-xs',
        title: 'text-base leading-5',
        pager: 'gap-2 text-sm',
        pagerButton: 'h-7 w-7',
        pagerIcon: 'h-4 w-4',
        body: 'mt-3 space-y-2.5',
        tabs: 'gap-2',
        decisionButton: 'h-7 px-2 text-xs',
        decisionIcon: 'h-3.5 w-3.5',
        textarea: 'min-h-28 text-xs',
        json: 'max-h-36 px-3 py-2',
        footer: 'mt-3 gap-3',
        dismissButton: 'h-7 px-2 text-xs',
        continueButton: 'h-8 px-3 text-xs',
        continueIcon: 'h-4 min-w-4',
      },
      spacious: {
        section: 'px-5 py-3',
        eyebrow: 'mb-0.5 text-xs',
        title: 'text-base leading-5',
        pager: 'gap-2 text-sm',
        pagerButton: 'h-7 w-7',
        pagerIcon: 'h-4 w-4',
        body: 'mt-4 space-y-3',
        tabs: 'gap-2',
        decisionButton: 'h-8 px-2.5 text-xs',
        decisionIcon: 'h-3.5 w-3.5',
        textarea: 'min-h-32 text-sm',
        json: 'max-h-40 px-3 py-2',
        footer: 'mt-4 gap-3',
        dismissButton: 'h-7 px-2 text-sm',
        continueButton: 'h-8 px-3.5 text-sm',
        continueIcon: 'h-4 min-w-4',
      },
    }[density] ??
    {
      section: 'px-4 py-2.5',
      eyebrow: 'mb-0.5 text-xs',
      title: 'text-base leading-5',
      pager: 'gap-2 text-sm',
      pagerButton: 'h-7 w-7',
      pagerIcon: 'h-4 w-4',
      body: 'mt-3 space-y-2.5',
      tabs: 'gap-2',
      decisionButton: 'h-7 px-2 text-xs',
      decisionIcon: 'h-3.5 w-3.5',
      textarea: 'min-h-28 text-xs',
      json: 'max-h-36 px-3 py-2',
      footer: 'mt-3 gap-3',
      dismissButton: 'h-7 px-2 text-xs',
      continueButton: 'h-8 px-3 text-xs',
      continueIcon: 'h-4 min-w-4',
    };

  return {
    top: theme.radius
      ? {
          pill: 'rounded-t-3xl',
          round: 'rounded-t-xl',
          soft: 'rounded-t-lg',
          sharp: 'rounded-t-none',
        }[theme.radius]
      : 'rounded-t-lg',
    panel: getRoundedClass(theme.radius, 'rounded-lg'),
    control: getRoundedClass(theme.radius, 'rounded-md'),
    density: densityClasses,
  };
}

function formatArgs(args: Record<string, unknown>) {
  try {
    return JSON.stringify(args ?? {}, null, 2) ?? '{}';
  } catch {
    return '{}';
  }
}

function getActionKey(action: HITLActionRequest, index: number) {
  return `${index}:${action.name}`;
}

function getReviewConfig(
  action: HITLActionRequest,
  reviewConfigs: HITLReviewConfig[],
) {
  return reviewConfigs.find((config) => config.actionName === action.name);
}

function getAllowedDecisions(config: HITLReviewConfig | undefined) {
  const allowed = config?.allowedDecisions?.length
    ? config.allowedDecisions
    : (['approve'] as HITLDecisionType[]);
  const allowedSet = new Set(allowed);
  return decisionOrder.filter((type) => allowedSet.has(type));
}

function getDefaultDecisionType(config: HITLReviewConfig | undefined) {
  const allowed = getAllowedDecisions(config);
  return allowed.includes('approve') ? 'approve' : allowed[0] ?? 'approve';
}

function getDraft(
  action: HITLActionRequest,
  index: number,
  config: HITLReviewConfig | undefined,
  drafts: Record<string, DecisionDraft>,
): DecisionDraft {
  return (
    drafts[getActionKey(action, index)] ?? {
      type: getDefaultDecisionType(config),
    }
  );
}

function parseArgs(
  text: string,
  invalidJsonMessage: string,
): Record<string, unknown> | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalidJsonMessage;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return invalidJsonMessage;
  }

  return parsed as Record<string, unknown>;
}

function buildDecisionForAction({
  action,
  draft,
  invalidJsonMessage,
  responseRequiredMessage,
}: {
  action: HITLActionRequest;
  draft: DecisionDraft;
  invalidJsonMessage: string;
  responseRequiredMessage: string;
}): HITLDecision | string {
  if (draft.type === 'approve') {
    return { type: 'approve' };
  }

  if (draft.type === 'edit') {
    const args = parseArgs(
      draft.argsText ?? formatArgs(action.args),
      invalidJsonMessage,
    );
    if (typeof args === 'string') return args;

    return {
      type: 'edit',
      editedAction: {
        name: action.name,
        args,
      },
    };
  }

  const message = draft.message?.trim();
  if (draft.type === 'respond') {
    if (!message) return responseRequiredMessage;
    return { type: 'respond', message };
  }

  return {
    type: 'reject',
    ...(message ? { message } : {}),
  };
}

function buildDecisions({
  actions,
  reviewConfigs,
  drafts,
  invalidJsonMessage,
  responseRequiredMessage,
}: {
  actions: HITLActionRequest[];
  reviewConfigs: HITLReviewConfig[];
  drafts: Record<string, DecisionDraft>;
  invalidJsonMessage: string;
  responseRequiredMessage: string;
}): DecisionBuildResult {
  const decisions: HITLDecision[] = [];
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    if (!action) continue;

    const config = getReviewConfig(action, reviewConfigs);
    const draft = getDraft(action, index, config, drafts);
    const decision = buildDecisionForAction({
      action,
      draft,
      invalidJsonMessage,
      responseRequiredMessage,
    });

    if (typeof decision === 'string') {
      return {
        decisions,
        error: {
          actionIndex: index,
          message: decision,
        },
      };
    }

    decisions.push(decision);
  }

  return { decisions };
}

export function HITLApprovalPanel({
  request,
  onSubmit,
  onDismiss,
  attachToComposer = true,
  className,
}: HITLApprovalPanelProps) {
  if (request?.request.elicitation?.kind === 'mcp_elicitation') {
    return (
      <MCPBooleanElicitationPanel
        request={request}
        onSubmit={onSubmit}
        onDismiss={onDismiss}
        attachToComposer={attachToComposer}
        className={className}
      />
    );
  }

  return (
    <ActionReviewPanel
      request={request}
      onSubmit={onSubmit}
      onDismiss={onDismiss}
      attachToComposer={attachToComposer}
      className={className}
    />
  );
}

function MCPBooleanElicitationPanel({
  request,
  onSubmit,
  onDismiss,
  attachToComposer = true,
  className,
}: HITLApprovalPanelProps) {
  const { t } = useChatkitTranslation();
  const rounded = useRoundedClasses();
  const [decision, setDecision] = React.useState<'approve' | 'reject' | null>(
    null,
  );
  const elicitation = request?.request.elicitation;
  const action = request?.request.actionRequests.find(
    (candidate) => candidate.name === elicitation?.actionName,
  );

  React.useEffect(() => {
    setDecision(null);
  }, [request?.id]);

  React.useEffect(() => {
    if (!request || !onDismiss) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key !== 'Escape' && event.key !== 'Esc') return;

      event.preventDefault();
      onDismiss();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss, request]);

  if (!request || !elicitation || !action) return null;

  const fieldTitle = elicitation.field.title ?? action.name;
  const options = [
    {
      decision: 'approve' as const,
      label: t('composer.hitl.true'),
    },
    {
      decision: 'reject' as const,
      label: t('composer.hitl.false'),
    },
  ];

  return (
    <section
      aria-label={t('composer.hitl.mcpElicitationTitle')}
      aria-live="polite"
      className={cn(
        'mx-2 border border-border bg-background/95 shadow-sm',
        rounded.density.section,
        attachToComposer ? 'border-b-0' : null,
        attachToComposer ? rounded.top : rounded.panel,
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 font-medium text-muted-foreground',
          rounded.density.eyebrow,
        )}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>{t('composer.hitl.mcpElicitationTitle')}</span>
      </div>

      <div className={cn('space-y-2.5', rounded.density.body)}>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-muted-foreground">
          <span>
            {t('composer.hitl.fieldProgress', { current: 1, total: 1 })}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {decision
              ? t('composer.hitl.requiredAnswered')
              : t('composer.hitl.requiredUnanswered')}
          </span>
        </div>

        <div>
          <h3
            className={cn(
              'font-semibold text-foreground',
              rounded.density.title,
            )}
          >
            {fieldTitle}
          </h3>
          {action.description ? (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
              {action.description}
            </p>
          ) : null}
        </div>

        <div role="radiogroup" aria-label={fieldTitle} className="grid gap-1.5">
          {options.map((option) => {
            const selected = decision === option.decision;
            return (
              <button
                key={option.decision}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setDecision(option.decision)}
                className={cn(
                  'flex w-full items-center gap-2.5 border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  rounded.control,
                  selected
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-border bg-background text-foreground/85 hover:bg-muted/70',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    selected ? 'border-primary' : 'border-muted-foreground/45',
                  )}
                >
                  {selected ? (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  ) : null}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn('flex items-center justify-end', rounded.density.footer)}
      >
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              'inline-flex items-center justify-center font-medium text-muted-foreground hover:text-foreground',
              rounded.control,
              rounded.density.dismissButton,
            )}
          >
            {t('composer.hitl.cancel')}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!decision}
          onClick={() => {
            if (decision) onSubmit([{ type: decision }]);
          }}
          className={cn(
            'inline-flex shrink-0 items-center justify-center gap-1.5 bg-primary font-semibold text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-45',
            rounded.control,
            rounded.density.continueButton,
          )}
        >
          <CornerDownLeft className={rounded.density.continueIcon} />
          <span>{t('composer.hitl.elicitationSubmit')}</span>
        </button>
      </div>
    </section>
  );
}

function ActionReviewPanel({
  request,
  onSubmit,
  onDismiss,
  attachToComposer = true,
  className,
}: HITLApprovalPanelProps) {
  const { t } = useChatkitTranslation();
  const rounded = useRoundedClasses();
  const [drafts, setDrafts] = React.useState<Record<string, DecisionDraft>>(
    {},
  );
  const [currentActionIndex, setCurrentActionIndex] = React.useState(0);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const actions = request?.request.actionRequests ?? emptyActions;
  const reviewConfigs = request?.request.reviewConfigs ?? emptyReviewConfigs;

  const goToAction = React.useCallback(
    (index: number) => {
      if (actions.length === 0) return;
      setCurrentActionIndex(Math.min(Math.max(index, 0), actions.length - 1));
      setSubmitError(null);
    },
    [actions.length],
  );

  React.useEffect(() => {
    setDrafts({});
    setCurrentActionIndex(0);
    setSubmitError(null);
  }, [request?.id]);

  React.useEffect(() => {
    if (actions.length === 0) return;
    setCurrentActionIndex((index) =>
      Math.min(Math.max(index, 0), actions.length - 1),
    );
  }, [actions.length]);

  React.useEffect(() => {
    if (!request) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;

      if (event.key === 'Escape' || event.key === 'Esc') {
        if (onDismiss) {
          event.preventDefault();
          onDismiss();
        }
        return;
      }

      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName;
      const isTypingTarget =
        target?.isContentEditable ||
        targetTag === 'INPUT' ||
        targetTag === 'TEXTAREA' ||
        targetTag === 'SELECT';

      if (isTypingTarget) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToAction(currentActionIndex - 1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToAction(currentActionIndex + 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentActionIndex, goToAction, onDismiss, request]);

  const currentAction = actions[currentActionIndex] ?? null;
  const currentConfig = currentAction
    ? getReviewConfig(currentAction, reviewConfigs)
    : undefined;
  const allowedDecisions = getAllowedDecisions(currentConfig);
  const currentDraft =
    currentAction !== null
      ? getDraft(currentAction, currentActionIndex, currentConfig, drafts)
      : null;
  const currentActionKey =
    currentAction !== null
      ? getActionKey(currentAction, currentActionIndex)
      : null;

  const updateCurrentDraft = React.useCallback(
    (nextDraft: DecisionDraft) => {
      if (!currentActionKey) return;
      setSubmitError(null);
      setDrafts((previous) => ({
        ...previous,
        [currentActionKey]: nextDraft,
      }));
    },
    [currentActionKey],
  );

  const validation = React.useMemo(
    () =>
      buildDecisions({
        actions,
        reviewConfigs,
        drafts,
        invalidJsonMessage: t('composer.hitl.invalidJson'),
        responseRequiredMessage: t('composer.hitl.responseRequired'),
      }),
    [actions, drafts, reviewConfigs, t],
  );

  const handleSubmit = React.useCallback(() => {
    if (validation.error) {
      setCurrentActionIndex(validation.error.actionIndex);
      setSubmitError(validation.error.message);
      return;
    }

    onSubmit(validation.decisions);
  }, [onSubmit, validation]);

  if (!request || !currentAction || !currentDraft) {
    return null;
  }

  const argsText = currentDraft.argsText ?? formatArgs(currentAction.args);
  const argsJsonValue = toJsonValue(currentAction.args) ?? {};
  const messageText = currentDraft.message ?? '';
  const isCurrentInvalid =
    validation.error?.actionIndex === currentActionIndex;

  return (
    <section
      aria-label={t('composer.hitl.title')}
      aria-live="polite"
      className={cn(
        'mx-2 border border-border bg-background/95 shadow-sm',
        rounded.density.section,
        attachToComposer ? 'border-b-0' : null,
        attachToComposer ? rounded.top : rounded.panel,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cn(
              'flex items-center gap-1.5 font-medium text-muted-foreground',
              rounded.density.eyebrow,
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{t('composer.hitl.title')}</span>
          </div>
          <h3
            className={cn(
              'truncate font-semibold text-foreground',
              rounded.density.title,
            )}
            title={currentAction.name}
          >
            {currentAction.name}
          </h3>
        </div>

        {actions.length > 1 ? (
          <div
            className={cn(
              'flex shrink-0 items-center font-medium text-muted-foreground',
              rounded.density.pager,
            )}
          >
            <button
              type="button"
              onClick={() => goToAction(currentActionIndex - 1)}
              disabled={currentActionIndex === 0}
              className={cn(
                'inline-flex items-center justify-center rounded-full hover:bg-muted disabled:pointer-events-none disabled:opacity-35',
                rounded.density.pagerButton,
              )}
              aria-label={t('composer.hitl.previousAction')}
            >
              <ChevronLeft className={rounded.density.pagerIcon} />
            </button>
            <span className="min-w-12 text-center">
              {t('composer.hitl.actionProgress', {
                current: currentActionIndex + 1,
                total: actions.length,
              })}
            </span>
            <button
              type="button"
              onClick={() => goToAction(currentActionIndex + 1)}
              disabled={currentActionIndex === actions.length - 1}
              className={cn(
                'inline-flex items-center justify-center rounded-full hover:bg-muted disabled:pointer-events-none disabled:opacity-35',
                rounded.density.pagerButton,
              )}
              aria-label={t('composer.hitl.nextAction')}
            >
              <ChevronRight className={rounded.density.pagerIcon} />
            </button>
          </div>
        ) : null}
      </div>

      <div className={rounded.density.body}>
        {currentAction.description ? (
          <p className="overflow-hidden text-sm leading-5 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
            {currentAction.description}
          </p>
        ) : null}

        <div
          className={cn(
            'flex flex-wrap items-center',
            rounded.density.tabs,
          )}
        >
          {allowedDecisions.map((type) => {
            const meta = decisionMeta[type];
            const Icon = meta.icon;
            const selected = currentDraft.type === type;

            return (
              <button
                key={type}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  updateCurrentDraft({
                    ...currentDraft,
                    type,
                    argsText:
                      currentDraft.argsText ?? formatArgs(currentAction.args),
                  })
                }
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 border font-semibold transition-colors',
                  rounded.control,
                  rounded.density.decisionButton,
                  type === 'reject'
                    ? selected
                      ? 'border-destructive/45 bg-destructive/15 text-destructive hover:bg-destructive/20'
                      : 'border-destructive/25 bg-background text-destructive hover:bg-destructive/10'
                    : selected
                      ? 'border-primary/35 bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground/80 hover:bg-muted',
                )}
              >
                <Icon className={rounded.density.decisionIcon} />
                <span>{t(meta.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {currentDraft.type === 'edit' ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              {t('composer.hitl.arguments')}
            </span>
            <textarea
              value={argsText}
              onChange={(event) =>
                updateCurrentDraft({
                  ...currentDraft,
                  argsText: event.target.value,
                })
              }
              spellCheck={false}
              className={cn(
                'w-full resize-y border border-border bg-muted/35 px-3 py-2 font-mono leading-5 text-foreground outline-none focus:border-primary/45',
                rounded.control,
                rounded.density.textarea,
              )}
            />
          </label>
        ) : (
          <div>
            <div className="mb-1 text-xs font-semibold text-muted-foreground">
              {t('composer.hitl.arguments')}
            </div>
            <div
              className={cn(
                'overflow-auto border border-border bg-muted/35 text-foreground',
                rounded.control,
                rounded.density.json,
              )}
            >
              <JsonTreeView value={argsJsonValue} />
            </div>
          </div>
        )}

        {currentDraft.type === 'reject' || currentDraft.type === 'respond' ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              {currentDraft.type === 'reject'
                ? t('composer.hitl.rejectMessage')
                : t('composer.hitl.respondMessage')}
            </span>
            <textarea
              value={messageText}
              onChange={(event) =>
                updateCurrentDraft({
                  ...currentDraft,
                  message: event.target.value,
                })
              }
              placeholder={
                currentDraft.type === 'reject'
                  ? t('composer.hitl.rejectPlaceholder')
                  : t('composer.hitl.respondPlaceholder')
              }
              className={cn(
                'w-full resize-y border border-border bg-background px-3 py-2 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/45',
                rounded.control,
                rounded.density.textarea,
              )}
            />
          </label>
        ) : null}

        {submitError && isCurrentInvalid ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{submitError}</span>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'flex items-center justify-end',
          rounded.density.footer,
        )}
      >
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              'inline-flex items-center justify-center font-medium text-muted-foreground hover:text-foreground',
              rounded.control,
              rounded.density.dismissButton,
            )}
          >
            {t('composer.hitl.dismiss')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleSubmit}
          className={cn(
            'inline-flex shrink-0 items-center justify-center gap-1.5 bg-primary font-semibold text-primary-foreground hover:bg-primary/90',
            rounded.control,
            rounded.density.continueButton,
          )}
        >
          <CornerDownLeft className={rounded.density.continueIcon} />
          <span>{t('composer.hitl.submit')}</span>
        </button>
      </div>
    </section>
  );
}
