import * as React from 'react';
import type { HITLDecision } from '@xpert-ai/chatkit-types';
import {
  Check,
  Info,
  LoaderCircle,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { PendingHITLRequest } from '../../lib/hitl';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { resolveLocalizedText } from '../../i18n/localized-text';
import { useTheme } from '../../providers/Theme';
import { getRoundedClass, cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { ActionReviewDisplay } from '../composer/action-review-display';
import { HITLApprovalPanel } from '../composer/hitl-approval-panel';

export function ActionApprovalCard({
  request,
  onSubmit,
  onAction,
}: {
  request: PendingHITLRequest;
  onSubmit: (decisions: HITLDecision[]) => Promise<void>;
  onAction?: () => Promise<void>;
}) {
  const { t, i18n } = useChatkitTranslation();
  const { theme } = useTheme();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [expired, setExpired] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const lock = React.useRef(false);
  React.useEffect(() => {
    const expiry = request.request.host?.expiresAt;
    if (!expiry) return;
    const refresh = () => setExpired(Date.now() >= expiry);
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [request.request.host?.expiresAt]);
  const submit = async (decisions: HITLDecision[]) => {
    if (
      lock.current ||
      submitted ||
      (expired && decisions.some((decision) => decision.type !== 'reject'))
    )
      return;
    lock.current = true;
    setPending(true);
    setError('');
    try {
      await onSubmit(decisions);
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('approvals.failed'));
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const action = request.request.actionRequests[0];
  const config = request.request.reviewConfigs.find(
    (item) => item.actionName === action?.name,
  );
  const simple =
    request.request.actionRequests.length === 1 &&
    config?.allowedDecisions.every(
      (type) => type === 'approve' || type === 'reject',
    );
  if (!simple)
    return (
      <div className="my-3">
        <fieldset disabled={pending || submitted || expired}>
          <HITLApprovalPanel
            attachToComposer={false}
            request={request}
            onSubmit={(decisions) => {
              void submit(decisions);
            }}
          />
        </fieldset>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {expired && (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            {t('approvals.expired')}
          </p>
        )}
      </div>
    );
  const display = action?.display;
  return (
    <section
      aria-label={t('approvals.label')}
      aria-busy={pending}
      className={cn(
        'my-3 max-w-2xl border border-border bg-background p-5 text-foreground',
        getRoundedClass(theme.radius, 'rounded-xl'),
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h3 className="text-base font-semibold">
            {display
              ? resolveLocalizedText(display.title, i18n.language)
              : action.name}
          </h3>
          {(display?.summary || action.description) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {display
                ? resolveLocalizedText(display.summary, i18n.language)
                : action.description}
            </p>
          )}
        </div>
      </div>
      {display ? (
        <ActionReviewDisplay display={display} args={action.args} />
      ) : (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words bg-muted/35 p-3 text-xs">
          {JSON.stringify(action.args, null, 2)}
        </pre>
      )}
      {expired && (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Info className="size-4" />
          {t('approvals.expired')}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {onAction && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-muted-foreground"
            disabled={pending || submitted}
            onClick={() => {
              void onAction().catch((cause: unknown) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : t('approvals.failed'),
                ),
              );
            }}
          >
            <Settings className="size-4" />
            {t('approvals.settings')}
          </Button>
        )}
        {config?.allowedDecisions.includes('reject') && (
          <Button
            type="button"
            variant="outline"
            disabled={pending || submitted}
            onClick={() => {
              void submit([{ type: 'reject' }]);
            }}
          >
            <X className="size-4" />
            {t('approvals.reject')}
          </Button>
        )}
        {config?.allowedDecisions.includes('approve') && (
          <Button
            type="button"
            disabled={pending || submitted || expired}
            onClick={() => {
              void submit([{ type: 'approve' }]);
            }}
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {t('approvals.approveOnce')}
          </Button>
        )}
      </div>
    </section>
  );
}
