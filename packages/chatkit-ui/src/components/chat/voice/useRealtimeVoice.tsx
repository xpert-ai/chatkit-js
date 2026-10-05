import * as React from 'react';
import { Phone } from 'lucide-react';
import type {
  RealtimeVoiceOptions,
  RealtimeVoiceCommand,
  CompletedVoiceCall,
} from '@xpert-ai/chatkit-types';
import { ParentMessengerContext } from '../../../providers/ParentMessenger';
import type { ChatKitAIMessage } from '../../../providers/stream/types';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import type { ChatkitAvatarData } from '../../ui/chatkit-avatar';
import { Button } from '../../ui/button';
import { VoiceCallPanel } from './VoiceCallPanel';

export function mergeCompletedCalls(
  messages: ChatKitAIMessage[],
  completed: CompletedVoiceCall[] = [],
  threadId: string | null,
) {
  const ids = new Set(messages.map((message) => message.id));
  const added: ChatKitAIMessage[] = completed
    .filter((call) => call.threadId === threadId && !ids.has(call.id))
    .map((call) => ({
      id: call.id,
      type: 'human',
      content: [call.content],
      createdAt: call.content.endedAt,
      inputCheckpoint: null,
    }));
  if (!added.length) return messages;
  const result = [...messages];
  for (const call of added.sort(
    (a, b) => Date.parse(a.createdAt!) - Date.parse(b.createdAt!),
  )) {
    const index = result.findIndex(
      (message) =>
        message.createdAt &&
        Date.parse(message.createdAt) > Date.parse(call.createdAt!),
    );
    result.splice(index < 0 ? result.length : index, 0, call);
  }
  return result;
}

export function useRealtimeVoice({
  options,
  assistantId,
  threadId,
  avatar,
}: {
  options?: RealtimeVoiceOptions;
  assistantId: string;
  threadId: string | null;
  avatar: ChatkitAvatarData | null;
}) {
  const messenger = React.useContext(ParentMessengerContext);
  const { t } = useChatkitTranslation();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const starting = React.useRef(false);
  const call = options?.call;
  const active = !!call && call.state !== 'ended' && call.state !== 'error';
  const command = async (input: RealtimeVoiceCommand) => {
    if (input.type === 'start') {
      if (starting.current || active) return;
      starting.current = true;
      setPending(true);
    }
    setError(undefined);
    try {
      if (typeof options?.onCommand === 'function')
        await options.onCommand(input);
      else if (messenger?.isParentAvailable)
        await messenger.sendCommand('onRealtimeVoiceCommand', input);
      else throw new Error('Voice host unavailable');
    } catch {
      setError(t('voiceCall.commandFailed'));
    } finally {
      if (input.type === 'start') {
        starting.current = false;
        setPending(false);
      }
    }
  };
  return {
    callId: call?.id,
    panel: call ? (
      <VoiceCallPanel
        call={call}
        avatar={call.assistantId === assistantId ? avatar : null}
        command={(input) => void command(input)}
        error={error}
      />
    ) : null,
    dial: options?.enabled ? (
      <div className="px-4 pb-4">
        <Button
          variant="secondary"
          className="w-1/2"
          disabled={pending || active}
          onClick={() => void command({ type: 'start', assistantId, threadId })}
        >
          <Phone className="mr-2 size-4" />
          {t('voiceCall.dial')}
        </Button>
        {error && !call && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    ) : null,
  };
}
