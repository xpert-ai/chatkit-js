import { formatCallDuration } from '../../../lib/call-duration';
import * as React from 'react';
import { Mic, MicOff, PhoneOff, X } from 'lucide-react';
import type {
  RealtimeVoiceCall,
  RealtimeVoiceCommand,
} from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { Button } from '../../ui/button';
import { AssistantCharacter } from '../header/AssistantCharacter';
import type { ChatkitAvatarData } from '../../ui/chatkit-avatar';

export function VoiceCallPanel({
  call,
  avatar,
  command,
  error,
}: {
  call: RealtimeVoiceCall;
  avatar: ChatkitAvatarData | null;
  command: (input: RealtimeVoiceCommand) => void;
  error?: string;
}) {
  const { t } = useChatkitTranslation();
  const active = call.state !== 'ended' && call.state !== 'error';
  const [now, setNow] = React.useState(Date.now);
  React.useEffect(() => {
    if (!active || !call.startedAt) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active, call.startedAt]);
  const label = call.state === 'listening' && call.muted ? 'muted' : call.state;
  const action = (type: 'end' | 'dismiss') =>
    command({ type, callId: call.id });
  return (
    <aside
      data-slot="voice-call-panel"
      data-window-no-drag=""
      aria-label={t('voiceCall.title')}
      className="pointer-events-auto shrink-0 rounded-3xl border border-border bg-popover p-4 text-popover-foreground shadow-xl"
    >
      <div className="flex items-center gap-3">
        <AssistantCharacter
          avatar={avatar}
          name={call.name}
          state={call.state === 'speaking' ? 'running' : 'idle'}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{call.name}</div>
          <div role="status" className="text-xs text-muted-foreground">
            {t(`voiceCall.${label}`)}
            {active && call.startedAt && (
              <span className="ml-2 tabular-nums">
                {formatCallDuration((now - Date.parse(call.startedAt)) / 1000)}
              </span>
            )}
          </div>
        </div>
        {!active && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('voiceCall.close')}
            onClick={() => action('dismiss')}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
      {call.caption && (
        <p
          className="mt-3 max-h-24 overflow-auto whitespace-pre-wrap text-sm"
          aria-live="off"
        >
          {call.caption}
        </p>
      )}
      {(call.notice || error) && (
        <p role="alert" className="mt-2 text-xs text-muted-foreground">
          {error || call.notice}
        </p>
      )}
      {!!call.tasks?.length && (
        <div className="mt-3 max-h-28 space-y-2 overflow-auto border-t pt-3">
          {call.tasks.slice(0, 4).map((task) => (
            <div key={task.id} className="text-xs">
              <span className="font-medium">{task.label}</span>
              {task.text && (
                <p className="mt-1 line-clamp-3 text-muted-foreground">
                  {task.text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {active && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="lg"
            className="min-w-0 w-full rounded-xl"
            aria-label={t(call.muted ? 'voiceCall.unmute' : 'voiceCall.mute')}
            aria-pressed={call.muted}
            onClick={() =>
              command({ type: 'mute', callId: call.id, muted: !call.muted })
            }
          >
            {call.muted ? (
              <MicOff className="size-4" />
            ) : (
              <Mic className="size-4" />
            )}
            {t(call.muted ? 'voiceCall.unmuteAction' : 'voiceCall.muteAction')}
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="min-w-0 w-full rounded-xl"
            onClick={() => action('end')}
          >
            <PhoneOff className="size-4" />
            {t('voiceCall.hangUp')}
          </Button>
        </div>
      )}
      {!active && call.tasks?.some((task) => task.pending) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('voiceCall.tasksContinue')}
        </p>
      )}
    </aside>
  );
}
