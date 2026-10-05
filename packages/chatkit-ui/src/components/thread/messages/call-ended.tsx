import { PhoneOff } from 'lucide-react';
import type { CallEndedContent } from '@xpert-ai/chatkit-types';
import { formatCallDuration } from '../../../lib/call-duration';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

export function CallEndedMessage({ call }: { call: CallEndedContent }) {
  const { t } = useChatkitTranslation();
  return (
    <div className="flex justify-end" data-slot="call-ended-message">
      <div className="inline-flex items-center gap-2 rounded-2xl bg-primary/15 px-4 py-3 text-sm text-foreground">
        <PhoneOff className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="tabular-nums">
            {formatCallDuration(call.durationSeconds)}
          </span>{' '}
          · {t('voiceCall.ended')}
        </span>
      </div>
    </div>
  );
}
