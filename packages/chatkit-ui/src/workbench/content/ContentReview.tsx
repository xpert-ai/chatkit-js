import * as React from 'react';
import type {
  ContentClient,
  ContentScope,
  ContentReviewMutation,
} from '@xpert-ai/xpert-sdk';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../components/ui/select';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import type { ReviewSession } from './commands';
import type { EditorLifecycle } from '../editors/editor-lifecycle';

/** Assistant review UI; editor plugins supply resource/anchor context, never AI orchestration. */
export function ContentReview({
  session,
  api,
  scope,
  editors,
  close,
  reopen,
  ask,
}: {
  session: ReviewSession;
  api: ContentClient;
  scope: ContentScope;
  editors: EditorLifecycle;
  close: () => void;
  reopen: () => Promise<void>;
  ask: (text: string) => Promise<unknown>;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const [state, setState] = React.useState(session.state);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [instruction, setInstruction] = React.useState('');
  const [revisionId, setRevisionId] = React.useState('');
  const [preview, setPreview] = React.useState('');
  const controllerRef = React.useRef(new AbortController());
  React.useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, []);
  const label = (key: string) => t(`contentReview.${key}`);
  const requestOptions = () => ({ signal: controllerRef.current.signal });
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (error) {
      if (!controllerRef.current.signal.aborted)
        setError(error instanceof Error ? error.message : label('Failed'));
    } finally {
      if (!controllerRef.current.signal.aborted) setBusy(false);
    }
  }
  async function reload() {
    const value = await api.review(scope, session.resourceId, requestOptions());
    if (!controllerRef.current.signal.aborted) setState(value);
  }
  async function mutate(mutation: ContentReviewMutation, reset = false) {
    if (!(await editors.prepare(session.viewKey)))
      throw new Error(label('Unsaved'));
    controllerRef.current.signal.throwIfAborted();
    await api.mutate(scope, session.resourceId, mutation, requestOptions());
    controllerRef.current.signal.throwIfAborted();
    if (reset) {
      await reopen();
      close();
    } else await reload();
  }
  const locate = (blockId: string) => {
    editors.reveal(session.resourceId, blockId);
    close();
  };
  const baseline = {
    epoch: state.document.epoch,
    expectedSequence: state.document.sequence,
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent style={getSurfaceThemeStyle(theme)} className="w-[52rem]">
        <DialogHeader>
          <DialogTitle>{label('Title')}</DialogTitle>
          <DialogDescription>{state.document.path}</DialogDescription>
        </DialogHeader>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void run(reload)}
        >
          {label('Refresh')}
        </Button>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {state.external && (
          <section className="space-y-[calc(0.75rem*var(--chat-density-scale,1))] border-b border-border pb-[calc(0.75rem*var(--chat-density-scale,1))]">
            <h3 className="font-semibold">{label('ExternalTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {label('ExternalHelp')}
            </p>
            <div className="grid gap-[calc(0.75rem*var(--chat-density-scale,1))] sm:grid-cols-2">
              <div>
                <h4>{label('CollaborativeContent')}</h4>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-sm">
                  {state.markdown}
                </pre>
              </div>
              <div>
                <h4>{label('ExternalContent')}</h4>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-sm">
                  {state.external.markdown}
                </pre>
              </div>
            </div>
            {state.canWrite && (
              <div className="flex flex-wrap gap-[calc(0.5rem*var(--chat-density-scale,1))]">
                {(['file', 'document'] as const).map((choice) => (
                  <Button
                    key={choice}
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        mutate(
                          {
                            operation: 'reconcile',
                            choice,
                            expectedHash: state.external!.hash,
                            ...baseline,
                          },
                          true,
                        ),
                      )
                    }
                  >
                    {label(choice === 'file' ? 'UseExternal' : 'KeepDocument')}
                  </Button>
                ))}
              </div>
            )}
          </section>
        )}
        <section className="space-y-[calc(0.75rem*var(--chat-density-scale,1))]">
          <h3 className="font-semibold">{label('Proposals')}</h3>
          {!state.proposals.length && (
            <p className="text-sm text-muted-foreground">
              {label('NoProposals')}
            </p>
          )}
          {state.proposals.map((proposal) => (
            <article
              key={proposal.id}
              className="space-y-[calc(0.5rem*var(--chat-density-scale,1))] border-b border-border pb-[calc(0.75rem*var(--chat-density-scale,1))]"
            >
              <div className="flex items-center justify-between gap-[calc(0.5rem*var(--chat-density-scale,1))]">
                <span className="text-sm text-muted-foreground">
                  {label('BasedOn')} {proposal.sequence} ·{' '}
                  {label(proposal.status)}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => locate(proposal.blockId)}
                >
                  {label('Locate')}
                </Button>
              </div>
              <div className="grid gap-[calc(0.75rem*var(--chat-density-scale,1))] sm:grid-cols-2">
                <div>
                  <h4>{label('Before')}</h4>
                  <pre className="whitespace-pre-wrap text-sm">
                    {proposal.before}
                  </pre>
                </div>
                <div>
                  <h4>{label('After')}</h4>
                  <pre className="whitespace-pre-wrap text-sm">
                    {proposal.after}
                  </pre>
                </div>
              </div>
              {proposal.status === 'pending' && state.canWrite && (
                <div className="flex gap-[calc(0.5rem*var(--chat-density-scale,1))]">
                  <Button
                    disabled={busy || state.externalChange}
                    onClick={() =>
                      void run(() =>
                        mutate({
                          operation: 'decide',
                          proposalId: proposal.id,
                          accept: true,
                        }),
                      )
                    }
                  >
                    {label('Accept')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        mutate({
                          operation: 'decide',
                          proposalId: proposal.id,
                          accept: false,
                        }),
                      )
                    }
                  >
                    {label('Reject')}
                  </Button>
                </div>
              )}
              {proposal.status === 'stale' && (
                <p className="text-sm text-muted-foreground">
                  {label('Stale')}
                </p>
              )}
            </article>
          ))}
        </section>
        <section className="space-y-[calc(0.75rem*var(--chat-density-scale,1))]">
          <h3 className="font-semibold">{label('Comments')}</h3>
          {!state.comments.length && (
            <p className="text-sm text-muted-foreground">
              {label('NoComments')}
            </p>
          )}
          {state.comments.map((item) => (
            <article
              key={item.id}
              className="border-b border-border pb-[calc(0.75rem*var(--chat-density-scale,1))]"
            >
              <p
                className={`whitespace-pre-wrap ${item.resolved ? 'line-through' : ''}`}
              >
                {item.body}
              </p>
              <div className="flex flex-wrap items-center gap-[calc(0.5rem*var(--chat-density-scale,1))] text-sm text-muted-foreground">
                <span>
                  {item.createdAt} ·{' '}
                  {label(item.blockId ? 'BlockComment' : 'DocumentComment')}
                </span>
                {item.blockId && (
                  <Button variant="ghost" onClick={() => locate(item.blockId!)}>
                    {label('Locate')}
                  </Button>
                )}
                {state.canWrite && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        mutate({
                          operation: 'resolve-comment',
                          commentId: item.id,
                          resolved: !item.resolved,
                        }),
                      )
                    }
                  >
                    {label(item.resolved ? 'Reopen' : 'Resolve')}
                  </Button>
                )}
              </div>
            </article>
          ))}
          {state.canWrite && (
            <>
              <label className="block space-y-[calc(0.5rem*var(--chat-density-scale,1))]">
                {label('NewComment')}
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={10000}
                />
              </label>
              <Button
                variant="outline"
                disabled={busy || !comment.trim()}
                onClick={() =>
                  void run(async () => {
                    await mutate({
                      operation: 'comment',
                      body: comment.trim(),
                      blockId: session.blockId,
                    });
                    setComment('');
                  })
                }
              >
                {label('AddComment')}
              </Button>
            </>
          )}
        </section>
        <section className="space-y-[calc(0.75rem*var(--chat-density-scale,1))]">
          <h3 className="font-semibold">{label('Versions')}</h3>
          <Select
            value={revisionId}
            disabled={busy}
            onValueChange={(id) => {
              setRevisionId(id);
              setPreview('');
              void run(async () => {
                const result = await api.preview(
                  scope,
                  session.resourceId,
                  id,
                  requestOptions(),
                );
                if (!controllerRef.current.signal.aborted)
                  setPreview(result.markdown);
              });
            }}
          >
            <SelectTrigger aria-label={label('SelectVersion')}>
              <SelectValue placeholder={label('ChooseVersion')} />
            </SelectTrigger>
            <SelectContent>
              {state.revisions.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  {version.label} · {version.createdAt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {revisionId && (
            <>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-sm">
                {preview}
              </pre>
              {state.canWrite && (
                <Button
                  variant="outline"
                  disabled={busy || state.externalChange}
                  onClick={() =>
                    void run(() =>
                      mutate(
                        { operation: 'restore', revisionId, ...baseline },
                        true,
                      ),
                    )
                  }
                >
                  {label('Restore')}
                </Button>
              )}
            </>
          )}
        </section>
        {state.canWrite && (
          <section className="space-y-[calc(0.75rem*var(--chat-density-scale,1))] border-t border-border pt-[calc(0.75rem*var(--chat-density-scale,1))]">
            <label className="block space-y-[calc(0.5rem*var(--chat-density-scale,1))]">
              {label('Ask')}
              <Textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder={label('Instruction')}
                maxLength={4000}
              />
            </label>
            <Button
              disabled={busy || !instruction.trim()}
              onClick={() =>
                void run(async () => {
                  await ask(
                    t('contentReview.AskPrompt', {
                      resourceId: session.resourceId,
                      path: state.document.path,
                      instruction,
                    }),
                  );
                  close();
                })
              }
            >
              {label('Send')}
            </Button>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
