import type { ThreadControlView } from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export const threadControlStatusKeys: {
  [State in ThreadControlView['state']]: string;
} = {
  idle: 'threadControl.status.idle',
  running: 'threadControl.status.busy',
  pausing: 'threadControl.pausing',
  paused: 'threadControl.status.paused',
  stopping: 'threadControl.stopping',
  settling: 'threadControl.settling',
  input_required: 'threadControl.input_required',
  confirming: 'threadControl.confirming',
  completed: 'threadControl.completed',
  stopped: 'threadControl.stopped',
  failed: 'threadControl.status.error',
};

export function ThreadControlStatus({
  state,
}: {
  state?: ThreadControlView['state'];
}) {
  const { t } = useChatkitTranslation();
  if (
    !state ||
    ![
      'pausing',
      'stopping',
      'settling',
      'confirming',
      'input_required',
    ].includes(state)
  )
    return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className="text-xs text-muted-foreground"
    >
      {t(threadControlStatusKeys[state])}
    </span>
  );
}
