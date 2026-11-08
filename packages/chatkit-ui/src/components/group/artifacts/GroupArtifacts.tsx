import { useEffect, useState } from 'react';
import type {
  Client,
  ChatGroupSnapshot,
  GroupArtifactGrant,
  GroupArtifactReference,
} from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { ResourceAnalysisSummary } from './ResourceAnalysisSummary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '../../ui/alert-dialog';

/** Mounted for one group only; leaving closes viewers and aborts outstanding credential-scoped requests. */
export function GroupArtifacts({
  client,
  group,
  onClose,
  onOpen,
  onRemove,
}: {
  client: Client;
  group: ChatGroupSnapshot;
  onClose(): void;
  onOpen(reference: GroupArtifactReference): void;
  onRemove?(reference: GroupArtifactReference): void;
}) {
  const { t } = useChatkitTranslation();
  const owner =
    group.members.find((m) => m.id === group.viewerParticipantId && m.active)
      ?.role === 'owner';
  const [references, setReferences] = useState<GroupArtifactReference[]>([]),
    [offers, setOffers] = useState<GroupArtifactGrant[]>([]);
  const [referenceOffset, setReferenceOffset] = useState<number | null>(0),
    [offerOffset, setOfferOffset] = useState<number | null>(0);
  const [removal, setRemoval] = useState<GroupArtifactReference | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const [analysisConsent, setAnalysisConsent] = useState<
    Record<string, boolean>
  >({});
  const [scope] = useState(() => ({ controller: new AbortController() }));
  async function load(more = false) {
    const signal = scope.controller.signal;
    setBusy(true);
    setError(false);
    try {
      const [refs, pending] = await Promise.all([
        more && referenceOffset === null
          ? null
          : client.groups.artifacts.list(
              group.id,
              { offset: more ? (referenceOffset ?? 0) : 0 },
              { signal: signal },
            ),
        !owner || (more && offerOffset === null)
          ? null
          : client.groups.artifacts.offers(
              group.id,
              { offset: more ? (offerOffset ?? 0) : 0 },
              { signal: signal },
            ),
      ]);
      if (signal.aborted) return;
      if (refs) {
        setReferences((old) => (more ? [...old, ...refs.items] : refs.items));
        setReferenceOffset(refs.nextOffset);
      }
      if (pending) {
        setOffers((old) => (more ? [...old, ...pending.items] : pending.items));
        setOfferOffset(pending.nextOffset);
      }
    } catch {
      if (!signal.aborted) setError(true);
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    scope.controller = controller;
    void load();
    return () => controller.abort();
  }, [client, group.id, owner, scope]);
  async function mutate(action: (signal: AbortSignal) => Promise<unknown>) {
    const signal = scope.controller.signal;
    setBusy(true);
    setError(false);
    try {
      await action(signal);
      if (!signal.aborted) {
        setRemoval(null);
        await load();
      }
    } catch {
      if (!signal.aborted) setError(true);
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent layout="sectioned">
        <DialogHeader>
          <DialogTitle>{t('group.artifacts.title')}</DialogTitle>
          <DialogDescription>
            {group.title} · {t('group.artifacts.hint')}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto p-(--dialog-padding) pt-0">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void load()}
          >
            {t('group.artifacts.refresh')}
          </Button>
          {error && (
            <p role="alert" className="text-destructive">
              {t('group.artifacts.failed')}
            </p>
          )}
          {busy && (
            <p role="status" className="text-muted-foreground">
              {t('group.artifacts.loading')}
            </p>
          )}
          {!busy &&
            !references.length &&
            !offers.some((g) => g.status === 'offered') && (
              <p className="text-muted-foreground">
                {t('group.artifacts.empty')}
              </p>
            )}
          {references.map((ref) => (
            <div
              key={ref.id}
              className="flex flex-wrap items-center gap-2 border-b pb-3"
            >
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{ref.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t('group.artifacts.version', {
                    number: ref.versionNumber,
                  })}
                </p>
                {ref.analysis && (
                  <ResourceAnalysisSummary policy={ref.analysis} />
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => onOpen(ref)}>
                {t('group.artifacts.open')}
              </Button>
              {owner && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setRemoval(ref)}
                >
                  {t('group.artifacts.remove')}
                </Button>
              )}
            </div>
          ))}
          {owner &&
            offers
              .filter((g) => g.status === 'offered')
              .map((grant) => (
                <div
                  key={grant.id}
                  className="flex flex-wrap items-center gap-2 border-b pb-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">
                      {grant.title || t('group.artifacts.untitled')}
                    </p>
                    {grant.analysis && (
                      <div className="mt-2 space-y-2">
                        <ResourceAnalysisSummary policy={grant.analysis} />
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            disabled={busy}
                            checked={analysisConsent[grant.id] === true}
                            onCheckedChange={(checked) =>
                              setAnalysisConsent((current) => ({
                                ...current,
                                [grant.id]: checked === true,
                              }))
                            }
                          />
                          {t('group.artifacts.acceptAnalysis')}
                        </label>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('group.artifacts.pending')} ·{' '}
                      {t('group.artifacts.version', {
                        number: grant.versionNumber,
                      })}
                    </p>
                  </div>
                  <Button
                    disabled={busy}
                    size="sm"
                    onClick={() =>
                      void mutate((signal) =>
                        client.groups.artifacts.accept(
                          group.id,
                          {
                            grantId: grant.id,
                            expectedRevision: grant.revision,
                            ...(grant.analysis
                              ? {
                                  acceptAnalysis:
                                    analysisConsent[grant.id] === true,
                                }
                              : {}),
                          },
                          { signal: signal },
                        ),
                      )
                    }
                  >
                    {t('group.artifacts.accept')}
                  </Button>
                </div>
              ))}
          {(referenceOffset !== null || (owner && offerOffset !== null)) && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void load(true)}
            >
              {t('group.artifacts.more')}
            </Button>
          )}
        </div>
        {removal && (
          <AlertDialog
            open
            onOpenChange={(open) => {
              if (!open && !busy) setRemoval(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('group.artifacts.remove')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('group.artifacts.removeHint', { title: removal.title })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>
                  {t('group.artifacts.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={(event) => {
                    event.preventDefault();
                    void mutate(async (signal) => {
                      await client.groups.artifacts.remove(
                        group.id,
                        removal.id,
                        { expectedRevision: removal.revision },
                        { signal },
                      );
                      if (!signal.aborted) onRemove?.(removal);
                    });
                  }}
                >
                  {t('group.artifacts.remove')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
