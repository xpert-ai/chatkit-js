import * as React from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Input } from '../ui/input';

export type ConversationTitleProps = {
  title: string;
  onSave?: (title: string) => Promise<void>;
};

/** Key by conversation ID so navigation discards an unfinished title edit. */
export function ConversationTitle({ title, onSave }: ConversationTitleProps) {
  const { t } = useChatkitTranslation();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(title);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const editingRef = React.useRef(false);
  const savingRef = React.useRef(false);
  const composingRef = React.useRef(false);
  const restoreFocusRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const errorId = React.useId();

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [editing]);

  const finish = (restoreFocus: boolean) => {
    editingRef.current = false;
    restoreFocusRef.current = restoreFocus;
    setEditing(false);
    setError(null);
  };

  const save = async (restoreFocus: boolean) => {
    if (!onSave || savingRef.current || !editingRef.current) return;
    const nextTitle = draft.trim();
    if (!nextTitle) {
      setError(t('chat.conversationTitle.required'));
      return;
    }
    if (nextTitle === title.trim()) {
      finish(restoreFocus);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave(nextTitle);
      if (mountedRef.current) finish(restoreFocus);
    } catch {
      if (mountedRef.current) setError(t('chat.conversationTitle.saveFailed'));
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  if (!onSave) {
    return (
      <p
        className="h-4 truncate text-xs leading-4 text-muted-foreground"
        title={title}
      >
        {title}
      </p>
    );
  }

  if (!editing) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className="group flex h-4 max-w-full items-center gap-1 rounded text-left text-xs leading-4 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={title}
        aria-label={t('chat.conversationTitle.rename')}
        onClick={() => {
          setDraft(title);
          setError(null);
          editingRef.current = true;
          setEditing(true);
        }}
      >
        <span className="truncate">{title}</span>
        <Pencil
          aria-hidden="true"
          className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100"
        />
      </button>
    );
  }

  return (
    <div
      className="min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          void save(false);
      }}
    >
      <div className="flex h-4 items-center gap-1" aria-busy={saving}>
        <Input
          ref={inputRef}
          value={draft}
          readOnly={saving}
          className="h-4 min-w-0 rounded-none border-0 border-b border-transparent bg-transparent p-0 text-xs leading-4 shadow-none focus-visible:border-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label={t('chat.conversationTitle.label')}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onKeyDown={(event) => {
            if (
              composingRef.current ||
              event.nativeEvent.isComposing ||
              event.keyCode === 229
            )
              return;
            if (event.key === 'Enter') {
              event.preventDefault();
              void save(true);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              if (!savingRef.current) finish(true);
            }
          }}
        />
        <button
          type="button"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          disabled={saving}
          aria-label={t('chat.conversationTitle.save')}
          title={t('chat.conversationTitle.save')}
          onClick={() => void save(true)}
        >
          {saving ? (
            <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          disabled={saving}
          aria-label={t('chat.conversationTitle.cancel')}
          title={t('chat.conversationTitle.cancel')}
          onClick={() => finish(true)}
        >
          <X aria-hidden="true" className="h-3 w-3" />
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
