import * as React from 'react';
import type {
  SharingClient,
  ConversationShareAudience,
  ConversationShareInfo,
  ConversationSharePreview,
} from './share-client';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import { Button } from '../ui/button';
import { ReadonlyMessageList } from './ReadonlyMessageList';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export type ConversationShareTarget = {
  client: SharingClient;
  conversationId: string;
  threadId: string;
  disabled?: boolean;
};

/** Copy after the asynchronous create, including browsers that expire clipboard user activation. */
async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    return;
  } catch {
    /* Fall back to a selected text field. */
  }
  const input = document.createElement('textarea');
  input.value = url;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  try {
    if (!document.execCommand('copy')) throw new Error('copy');
  } finally {
    input.remove();
  }
}

export function ConversationShareDialog({
  client,
  conversationId,
  threadId,
  open,
  onOpenChange,
}: ConversationShareTarget & {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const [preview, setPreview] = React.useState<ConversationSharePreview>();
  const [shares, setShares] = React.useState<ConversationShareInfo[]>([]);
  const existing = shares.find((share) => share.url);
  const [editing, setEditing] = React.useState(false);
  const [audience, setAudience] =
    React.useState<ConversationShareAudience>('organization');
  const [days, setDays] = React.useState<1 | 7 | 30>(7);
  const [acknowledge, setAcknowledge] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [revision, refresh] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setShares([]);
    setEditing(false);
    setCopied(false);
    setPreview(undefined);
    setError('');
    setAcknowledge(false);
    void Promise.allSettled([
      client.conversations.previewShare(conversationId, threadId),
      client.conversations.listShares(conversationId),
    ]).then(([p, s]) => {
      if (!active) return;
      if (p.status === 'fulfilled') {
        setPreview(p.value);
        if (!p.value.publicSharingEnabled) setAudience('organization');
      } else setError(t('sharing.unavailable'));
      if (s.status === 'fulfilled') {
        setShares(s.value);
        if (
          s.value[0]?.audience === 'organization' ||
          (p.status === 'fulfilled' && p.value.publicSharingEnabled)
        ) {
          setAudience(s.value[0]?.audience ?? 'organization');
        }
      } else {
        setError(t('sharing.unavailable'));
        setPreview(undefined);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [client, conversationId, threadId, open, revision, t]);
  const copy = async (url: string) => {
    try {
      await copyLink(url);
      setCopied(true);
    } catch {
      setError(t('sharing.copyFailed'));
    }
  };
  const create = async () => {
    if (!preview || busy) return;
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      const result = await client.conversations.createShare(conversationId, {
        threadId,
        digest: preview.digest,
        audience,
        expiresInDays: days,
        acknowledgePublic: acknowledge,
      });
      setEditing(false);
      setShares([result]);
      await copy(result.url);
    } catch {
      setError(t('sharing.createFailed'));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      await client.conversations.revokeShare(conversationId, id);
      setShares((rows) => rows.filter((row) => row.id !== id));
      setEditing(false);
      setCopied(false);
    } catch {
      setError(t('sharing.revokeFailed'));
    } finally {
      setBusy(false);
    }
  };
  const control =
    'h-[calc(var(--chat-density-scale,1)*2.5rem)] px-[calc(var(--chat-density-scale,1)*0.75rem)] rounded-chat-item';
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent
        style={getSurfaceThemeStyle(theme)}
        className="w-[44rem] rounded-chat-panel gap-[calc(var(--chat-density-scale,1)*1rem)] p-[calc(var(--chat-density-scale,1)*1.5rem)]"
      >
        <DialogHeader>
          <DialogTitle>{t('sharing.title')}</DialogTitle>
          <DialogDescription>{t('sharing.notice')}</DialogDescription>
        </DialogHeader>
        {loading && <p role="status">{t('sharing.loading')}</p>}
        {preview && (!shares.length || editing) && (
          <>
            <section
              aria-label={t('sharing.preview')}
              className="max-h-[35vh] overflow-y-auto rounded-chat-panel border border-border p-[calc(var(--chat-density-scale,1)*1rem)] space-y-[calc(var(--chat-density-scale,1)*1rem)]"
            >
              <h3 className="font-semibold">{preview.snapshot.title}</h3>
              <ReadonlyMessageList messages={preview.snapshot.messages} />
            </section>
            <label className="grid gap-1 text-sm">
              {t('sharing.audience')}
              <select
                disabled={busy}
                value={audience}
                onChange={(event) => {
                  setAudience(
                    event.target.value === 'public' ? 'public' : 'organization',
                  );
                  setAcknowledge(false);
                }}
                className={`${control} border border-border bg-background text-foreground focus-visible:outline-ring`}
              >
                <option value="organization">
                  {t('sharing.organization')}
                </option>
                {preview.publicSharingEnabled && (
                  <option value="public">{t('sharing.public')}</option>
                )}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              {t('sharing.expires')}
              <select
                disabled={busy}
                value={days}
                onChange={(event) =>
                  setDays(
                    event.target.value === '1'
                      ? 1
                      : event.target.value === '30'
                        ? 30
                        : 7,
                  )
                }
                className={`${control} border border-border bg-background text-foreground focus-visible:outline-ring`}
              >
                {[1, 7, 30].map((value) => (
                  <option value={value} key={value}>
                    {t('sharing.days', { count: value })}
                  </option>
                ))}
              </select>
            </label>
            {audience === 'public' && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={acknowledge}
                  disabled={busy}
                  onChange={(event) => setAcknowledge(event.target.checked)}
                />
                {t('sharing.publicConsent')}
              </label>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {existing?.url && (
          <div className="flex gap-2">
            <input
              aria-label={t('sharing.link')}
              readOnly
              value={existing.url}
              onFocus={(event) => event.target.select()}
              className={`${control} min-w-0 flex-1 border border-border bg-background text-foreground text-sm`}
            />
            <Button
              className={control}
              disabled={busy || loading}
              onClick={() => {
                if (existing.url) void copy(existing.url);
              }}
            >
              {t('sharing.copy')}
            </Button>
          </div>
        )}
        {shares.length > 0 && !editing && (
          <p className="text-sm text-muted-foreground">
            {t(
              existing?.url ? 'sharing.existingNotice' : 'sharing.unavailable',
            )}
          </p>
        )}
        {copied && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('sharing.copied')}
          </p>
        )}
        {shares.map((share) => (
          <div
            key={share.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span>
              {t(`sharing.${share.audience}`)} ·{' '}
              {new Date(share.expiresAt).toLocaleString()}
            </span>
            <Button
              variant="destructive"
              className={control}
              disabled={busy}
              onClick={() => void revoke(share.id)}
            >
              {t('sharing.revoke')}
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          {t('sharing.revocationNotice')}
        </p>
        {preview?.managementUrl &&
          /^https?:\/\//i.test(preview.managementUrl) && (
            <a
              href={preview.managementUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline underline-offset-4"
            >
              {t('sharing.manageLinks')}
            </a>
          )}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            className={control}
            disabled={busy || loading}
            onClick={refresh}
          >
            {t('sharing.refresh')}
          </Button>
          <Button
            variant={shares.length ? 'outline' : 'default'}
            className={control}
            disabled={
              busy ||
              loading ||
              !preview ||
              ((!shares.length || editing) &&
                audience === 'public' &&
                !acknowledge)
            }
            onClick={() => {
              if (shares.length && !editing) setEditing(true);
              else void create();
            }}
          >
            {t(
              busy
                ? 'sharing.working'
                : shares.length
                  ? editing
                    ? 'sharing.replace'
                    : 'sharing.editShare'
                  : 'sharing.create',
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
