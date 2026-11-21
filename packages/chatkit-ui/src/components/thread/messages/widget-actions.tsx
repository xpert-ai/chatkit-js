import { Fieldset } from '@xpert-ai/chatkit-primitives';
import {
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  A2UIProvider,
  useA2UI,
  type A2UIActionEvent,
} from '@xpert-ai/a2ui-react';
import { HTTPError } from '@xpert-ai/xpert-sdk';
import {
  encodeWidgetAgentAction,
  findWidgetAgentAction,
  WIDGET_ACTION_MAX_LENGTH,
} from '@xpert-ai/chatkit-types';
import { StreamContext } from '../../../providers/stream/context';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

type WidgetActionsProps = {
  messageId: string;
  widgetId?: string;
  widgetName?: string;
  surfaceId?: string;
  serverActions?: string[];
  agentActions?: string[];
  requiresIdleThread?: boolean;
  children: ReactNode;
};

export function WidgetActions({
  messageId,
  widgetId,
  widgetName,
  surfaceId,
  serverActions = [],
  agentActions = [],
  requiresIdleThread,
  children,
}: WidgetActionsProps) {
  const stream = useContext(StreamContext);
  const { sendAction } = useA2UI();
  const { t } = useChatkitTranslation();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const pending = useRef(false);
  const threadId = stream?.threadId;
  const waitForIdle = Boolean(requiresIdleThread && stream?.isLoading);
  const submitted =
    sent ||
    Boolean(
      findWidgetAgentAction(stream?.messages ?? [], {
        messageId,
        widgetId,
        surfaceId,
      }),
    );
  const scope = useRef<object | null>(null);

  useLayoutEffect(() => {
    scope.current = {};
    pending.current = false;
    setSubmitting(false);
    setSent(false);
    setError('');
    return () => {
      scope.current = null;
    };
  }, [threadId, messageId, widgetId, widgetName]);

  async function dispatch(action: A2UIActionEvent) {
    const toServer = serverActions.includes(action.actionId);
    const toAgent = !toServer && agentActions.includes(action.actionId);
    if (!toServer && !toAgent) {
      sendAction(action);
      return;
    }
    if (
      !stream ||
      !threadId ||
      !widgetId ||
      waitForIdle ||
      pending.current ||
      submitted
    )
      return;
    const origin = scope.current;
    pending.current = true;
    setSubmitting(true);
    setError('');
    try {
      if (toAgent) {
        const input = encodeWidgetAgentAction({
          name: action.actionId,
          messageId,
          widgetId,
          widgetName,
          surfaceId,
          timestamp: new Date().toISOString(),
          context: action.context ?? {},
        });
        if (input.length > WIDGET_ACTION_MAX_LENGTH)
          throw new Error(t('widget.actionTooLarge'));
        await stream.submit(
          { input: { input } },
          {
            threadId,
            ...(stream.isLoading ? { followUpMode: 'queue' as const } : {}),
            onRunAccepted: () => {
              if (origin === scope.current) setSent(true);
            },
          },
        );
        return;
      }
      const result = await stream.client.threads.submitWidgetAction(threadId, {
        messageId,
        widgetId,
        action: action.actionId,
        context: action.context,
      });
      if (origin === scope.current && result.refresh === 'thread')
        await stream.loadThread(threadId);
    } catch (err) {
      if (origin === scope.current)
        setError(actionErrorMessage(err, t('widget.actionFailed')));
    } finally {
      if (origin === scope.current) {
        pending.current = false;
        setSubmitting(false);
      }
    }
  }

  return (
    <A2UIProvider onAction={dispatch}>
      <Fieldset
        disabled={
          !threadId || !widgetId || waitForIdle || submitting || submitted
        }
        aria-busy={submitting}
        className="min-w-0"
      >
        {children}
      </Fieldset>
      {agentActions.length > 0 && (
        <p role="status" className="text-xs text-muted-foreground">
          {t(submitted ? 'widget.actionSent' : 'widget.actionStartsTurn')}
        </p>
      )}
      {error && (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      )}
    </A2UIProvider>
  );
}

function actionErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof HTTPError))
    return error instanceof Error ? error.message : fallback;
  try {
    const body: unknown = JSON.parse(error.text);
    if (
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
    )
      return body.message;
  } catch {
    // Proxies can return a non-JSON error page.
  }
  return fallback;
}
