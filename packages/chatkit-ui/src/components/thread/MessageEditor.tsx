import { useState } from 'react';
import { Button } from '../ui/button';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export function MessageEditor({
  initialText,
  onSave,
  onCancel,
}: {
  initialText: string;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useChatkitTranslation();
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave(text);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="w-full space-y-2 rounded-2xl border border-input bg-background p-3">
      <textarea
        aria-label={t('threadControl.editMessage')}
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={busy}
        rows={4}
        autoFocus
        className="w-full resize-y bg-transparent text-sm leading-relaxed text-foreground outline-none"
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onCancel}
        >
          {t('threadControl.discardEdit')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy || !text.trim()}
          onClick={() => void save()}
        >
          {t('threadControl.saveBranch')}
        </Button>
      </div>
    </div>
  );
}
