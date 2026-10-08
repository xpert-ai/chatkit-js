import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStreamContext } from '../../providers/Stream';
import { collectToolAfterInterrupts, resumeAfterTool, type ToolAfterInterrupt } from '../../lib/tool-after';
import { Button } from '../ui/button';

export function ToolAfterPanel() {
  const stream = useStreamContext();
  const { t } = useTranslation();
  const [pending, setPending] = useState<ToolAfterInterrupt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setPending([]);
    if (stream.isReady && stream.runtimeScopeReady !== false && !stream.isLoading && stream.threadId) {
      void stream.client.threads.get(stream.threadId).then((thread) => {
        if (active) setPending(collectToolAfterInterrupts(thread.operation).filter((item) => !item.app));
      }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [stream.client, stream.isReady, stream.runtimeScopeReady, stream.threadId, stream.isLoading, stream.historyMessageLoadVersion]);
  if (!pending.length) return null;
  return <div className="flex items-center gap-2 rounded-lg border p-3" role="status">
    <span className="flex-1 text-sm">{t('ToolAfter.Paused', { defaultValue: 'Tool completed. Waiting to continue.' })}</span>
    {error ? <span role="alert">{error}</span> : null}
    <Button disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { await resumeAfterTool(stream, pending[0].toolCallId); setPending((items) => items.slice(1)); }
      catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
      finally { setBusy(false); }
    }}>{t('ToolAfter.Continue', { defaultValue: 'Continue' })}</Button>
  </div>;
}
