import * as React from 'react';
import type {
  SharingClient,
  ConversationShareAudience,
  ConversationShareInfo,
  ConversationSharePreview as ConversationSharePreviewData,
} from './share-client';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../ui/button';
import { ConversationSharePreview } from './ConversationSharePreview';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogBody,
  DialogFooter,
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
  onCloseAutoFocus,
}: ConversationShareTarget & {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const { t } = useChatkitTranslation();
  const fieldId = React.useId();
  const [preview, setPreview] = React.useState<ConversationSharePreviewData>();
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
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent
        layout="sectioned"
        className="w-[36rem]"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{t('sharing.title')}</DialogTitle>
          <DialogDescription>{t('sharing.notice')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {loading && <p role="status">{t('sharing.loading')}</p>}
          {preview && (!shares.length || editing) && (
            <>
              <ConversationSharePreview snapshot={preview.snapshot} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor={`${fieldId}-audience`}>
                    {t('sharing.audience')}
                  </Label>
                  <Select
                    disabled={busy}
                    value={audience}
                    onValueChange={(value) => {
                      if (value !== 'organization' && value !== 'public')
                        return;
                      setAudience(value);
                      setAcknowledge(false);
                    }}
                  >
                    <SelectTrigger
                      id={`${fieldId}-audience`}
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="organization">
                        {t('sharing.organization')}
                      </SelectItem>
                      {preview.publicSharingEnabled && (
                        <SelectItem value="public">
                          {t('sharing.public')}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor={`${fieldId}-expires`}>
                    {t('sharing.expires')}
                  </Label>
                  <Select
                    disabled={busy}
                    value={String(days)}
                    onValueChange={(value) => {
                      if (value === '1' || value === '7' || value === '30')
                        setDays(value === '1' ? 1 : value === '30' ? 30 : 7);
                    }}
                  >
                    <SelectTrigger id={`${fieldId}-expires`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {[1, 7, 30].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {t('sharing.days', { count: value })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {audience === 'public' && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={`${fieldId}-consent`}
                    checked={acknowledge}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      setAcknowledge(checked === true)
                    }
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`${fieldId}-consent`}
                    className="font-normal leading-relaxed"
                  >
                    {t('sharing.publicConsent')}
                  </Label>
                </div>
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
              <Input
                aria-label={t('sharing.link')}
                readOnly
                value={existing.url}
                onFocus={(event) => event.target.select()}
                className="min-w-0 flex-1"
              />
              <Button
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
                existing?.url
                  ? 'sharing.existingNotice'
                  : 'sharing.unavailable',
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
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={refresh}
          >
            {t('sharing.refresh')}
          </Button>
          <Button
            variant={shares.length ? 'outline' : 'default'}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
