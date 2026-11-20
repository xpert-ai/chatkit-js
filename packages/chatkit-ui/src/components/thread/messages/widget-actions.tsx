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
import { StreamContext } from '../../../providers/stream/context';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

type WidgetActionsProps = {
  messageId: string;
  widgetId?: string;
  serverActions: string[];
  requiresIdleThread?: boolean;
  children: ReactNode;
};

export function WidgetActions({
  messageId,
  widgetId,
  serverActions,
  requiresIdleThread,
  children,
}: WidgetActionsProps) {
  const stream = useContext(StreamContext);
  const { sendAction } = useA2UI();
  const { t } = useChatkitTranslation();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const threadId = stream?.threadId;
  const waitForIdle = Boolean(requiresIdleThread && stream?.isLoading);
  const scope = useRef<object | null>(null);

  useLayoutEffect(() => {
    scope.current = {};
    pending.current = false;
    setSubmitting(false);
    setError('');
    return () => {
      scope.current = null;
    };
  }, [threadId, messageId, widgetId]);

  async function dispatch(action: A2UIActionEvent) {
    if (!serverActions.includes(action.actionId)) {
      sendAction(action);
      return;
    }
    if (!stream || !threadId || !widgetId || waitForIdle || pending.current)
      return;
    const origin = scope.current;
    pending.current = true;
    setSubmitting(true);
    setError('');
    try {
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
      <fieldset
        disabled={!threadId || !widgetId || waitForIdle || submitting}
        aria-busy={submitting}
        className="min-w-0"
      >
        {children}
      </fieldset>
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
