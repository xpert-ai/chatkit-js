import {
  editMentions,
  validMentions,
  insertMention,
  hasUnboundMention,
} from './group-mentions';
import { useWorkbench } from '../../workbench/context';
import { useGroupComposer } from './useGroupComposer';
import { useGroupHeaderActions } from './useGroupHeaderActions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { GroupMembers } from './GroupMembers';
import { GroupAvatar } from './GroupAvatar';
import { GroupInteractions } from './GroupInteractions';
import { GroupRunStatus } from './GroupRunStatus';
import {
  AssistantPresence,
  AssistantSummaryDialog,
  type AssistantPresenceProps,
} from '../chat/header/AssistantPresence';
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { AtSign, Users, X } from 'lucide-react';
import type {
  ChatGroupMessage,
  ChatGroupSendInput,
  ChatGroupMention,
} from '@xpert-ai/xpert-sdk';
import type { ChatProps } from '../chat/types';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useGroupConversationState } from './GroupConversationProvider';
import { useChatDraft } from '../chat/composer/useChatDraft';
import {
  readComposerPartsFromElement,
  getComposerPlainText,
  getComposerSelectionOffsets,
} from '../../lib/composer-parts';
import { ChatkitAvatar, normalizeChatkitAvatar } from '../ui/chatkit-avatar';
import { useTheme } from '../../providers/Theme';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

import type { ChatViewModel } from '../chat/ChatViewModel';
import { getGroupMessageListProps } from './getGroupMessageListProps';
export function useGroupConversation(props: ChatProps): ChatViewModel {
  const groupId = props.options?.group?.id ?? '';

  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const draft = useChatDraft();
  const editor = draft.composerInputRef;
  const text = draft.draft;
  const [mentionIndex, setMentionIndex] = useState(0);
  const [recipientOpen, setRecipientOpen] = useState(false);
  const { state, connected, error, setError, client, send, loadMore } =
    useGroupConversationState()!;
  const group = state.snapshot;
  const [mentions, setMentions] = useState<ChatGroupMention[]>([]);
  const workbench = useWorkbench();
  const [mention, setMention] = useState<string | null>(null);
  const [reply, setReply] = useState<ChatGroupMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const presenceMotionId = useId();
  const membersTrigger = useRef<HTMLButtonElement>(null);
  const membersOpener = useRef<HTMLElement | null>(null);
  const changeMembersOpen = (open: boolean) => {
    if (open && document.activeElement instanceof HTMLElement)
      membersOpener.current = document.activeElement;
    setMembersOpen(open);
  };
  const pending = useRef<ChatGroupSendInput | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const nearEnd = useRef(true);
  useEffect(() => {
    if (nearEnd.current && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [state]);
  const newestSequence = group?.messages.at(-1)?.sequence;
  useEffect(() => {
    const acknowledge = () => {
      if (
        newestSequence &&
        nearEnd.current &&
        document.visibilityState === 'visible'
      )
        void client.groups
          .preferences(groupId, { readSequence: newestSequence })
          .catch(() => undefined);
    };
    acknowledge();
    document.addEventListener('visibilitychange', acknowledge);
    return () => document.removeEventListener('visibilitychange', acknowledge);
  }, [client, groupId, newestSequence]);
  const members = group?.members ?? [];
  const headerVisible =
    props.surface !== 'side' && props.options?.header?.enabled !== false;
  const characterPresentation =
    headerVisible && props.options?.header?.character?.enabled !== false;
  const groupTitle = group?.title ?? t('group.loading');
  const groupStatus = `${t('group.members', { count: members.filter((member) => member.active).length })} · ${connected ? t('group.connected') : t('group.reconnecting')}`;
  const presence: AssistantPresenceProps = {
    avatar: null,
    avatarContent: <GroupAvatar members={members} className="size-full" />,
    name: groupTitle,
    statusText: groupStatus,
    state: 'idle',
    waitingForInput: false,
    reducedMotion: props.options?.header?.character?.reducedMotion,
    motionId: presenceMotionId,
    open: detailsOpen,
    onOpenChange: setDetailsOpen,
  };
  const memberName = (id: string) =>
    members.find((member) => member.id === id)?.name ?? id;
  const boundMentions = validMentions(text, mentions, members);
  const primary = members.find(
    (member) =>
      member.active &&
      member.kind === 'assistant' &&
      member.subjectId === group?.xpertId,
  );
  const recipients = boundMentions.length
    ? [...new Set(boundMentions.map((mention) => mention.participantId))]
    : primary
      ? [primary.id]
      : [];
  const composer = useGroupComposer({
    client,
    groupId,
    options: props.options,
    member:
      recipients.length === 1
        ? members.find(
            (member) =>
              member.id === recipients[0] && member.kind === 'assistant',
          )
        : undefined,
    activityKey:
      group?.runs
        .map((run) => `${run.participantId}:${run.status}`)
        .join(',') ?? '',
  });
  const composerKey = JSON.stringify(composer.input);
  useEffect(() => {
    pending.current = null;
  }, [composerKey]);
  const candidates = members.filter(
    (member) =>
      member.active &&
      member.id !== group?.viewerParticipantId &&
      member.name
        .toLocaleLowerCase()
        .includes((mention ?? '').toLocaleLowerCase()),
  );
  function selectMention(id: string) {
    const member = members.find((member) => member.id === id);
    if (!member) return;
    const next = insertMention(text, boundMentions, member);
    setMentions(next.mentions);
    draft.setComposerText(next.text);
    setMention(null);
    setMentionIndex(0);
    editor.current?.focus();
    pending.current = null;
  }
  function syncEditor(element: HTMLDivElement) {
    const parts = readComposerPartsFromElement(element, new Map());
    setMentions(editMentions(text, getComposerPlainText(parts), mentions));
    draft.commitComposerParts(parts);
    setMention(
      getComposerPlainText(parts).match(/(?:^|\s)@([^\s@]*)$/)?.[1] ?? null,
    );
    setMentionIndex(0);
    pending.current = null;
  }
  function replaceEditorSelection(value: string) {
    const selection =
      editor.current && getComposerSelectionOffsets(editor.current);
    if (!selection) return;
    const next =
      text.slice(0, selection.start) + value + text.slice(selection.end);
    setMentions(editMentions(text, next, mentions));
    draft.setComposerText(next, selection.start + value.length);
    setMention(next.match(/(?:^|\s)@([^\s@]*)$/)?.[1] ?? null);
    setMentionIndex(0);
    pending.current = null;
  }
  const fail = (reason: unknown) =>
    setError(reason instanceof Error ? reason.message : String(reason));
  const headerActions = useGroupHeaderActions({
    options: props.options,
    group,
    membersOpen,
    membersButton: (
      <Button
        variant="ghost"
        ref={membersTrigger}
        onClick={() => changeMembersOpen(!membersOpen)}
        aria-haspopup="dialog"
        size="icon"
        aria-label={t('group.membersTitle')}
        title={t('group.membersTitle')}
        aria-expanded={membersOpen}
      >
        <Users className="size-4" />
      </Button>
    ),
    onMembers: () => changeMembersOpen(true),
    onLoadMore: () => void loadMore().catch(fail),
    onNavigateMessage: (id) => {
      nearEnd.current = false;
      document
        .getElementById(`group-message-${id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    onFocusComposer: () => editor.current?.focus(),
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!group || !text.trim() || sending || composer.blocked) return;
    if (hasUnboundMention(text, boundMentions)) {
      setError(t('group.selectMention'));
      return;
    }
    const base = {
      ...(composer.input ? { composer: composer.input } : {}),
      text,
      mentions: boundMentions,
      clientMessageId: pending.current?.clientMessageId ?? crypto.randomUUID(),
    };
    const input: ChatGroupSendInput = {
      ...base,
      ...(reply ? { replyToMessageId: reply.id } : {}),
    };
    pending.current = input;
    setSending(true);
    try {
      await send(input);
      draft.setComposerText('');
      setMentions([]);
      composer.afterSend();
      setReply(null);
      pending.current = null;
      nearEnd.current = true;
    } catch (reason) {
      fail(reason);
    } finally {
      setSending(false);
    }
  }
  return {
    layout: {
      viewportRef: viewport,
      className: props.className,
      overlay: headerVisible ? (
        <AssistantSummaryDialog
          presence={presence}
          summary={headerActions.summaryProps}
          title={t('group.details')}
          closeLabel={t('group.closeDetails')}
        >
          <div className="flex items-center justify-between gap-3 border-b px-5 pb-4">
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {members
                .filter((member) => member.active)
                .map((member) => member.name)
                .join(' · ')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsOpen(false);
                changeMembersOpen(true);
              }}
            >
              <Users className="size-4" />
              {t('group.membersTitle')}
            </Button>
          </div>
        </AssistantSummaryDialog>
      ) : undefined,
      conversationKind: 'group',
      enabled: false,
      dropTitle: t('chat.dropFilesTitle'),
      dropHint: t('chat.dropFilesHint'),
      onFiles: () => false,
      onScroll: (event) => {
        const element = event.currentTarget;
        nearEnd.current =
          element.scrollHeight - element.scrollTop - element.clientHeight < 100;
      },
    },
    header: {
      visible: headerVisible,
      characterPresentation,
      style: { maxWidth: props.options?.layout?.maxWidth ?? 960 },
      avatar: (
        <button
          type="button"
          className="rounded-md outline-offset-4"
          aria-label={t('group.details')}
          aria-haspopup="dialog"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen(true)}
        >
          <GroupAvatar members={members} />
        </button>
      ),
      title: groupTitle,
      subtitle: (
        <p className="text-xs text-muted-foreground" role="status">
          {groupStatus}
        </p>
      ),
      actions: headerActions.actions,
    },
    headerPresence: characterPresentation ? (
      <AssistantPresence {...presence} />
    ) : undefined,
    transcript: {
      chatColumnStyle: { maxWidth: props.options?.layout?.maxWidth ?? 960 },
      before: (
        <>
          {group?.hasMore && (
            <Button variant="ghost" onClick={() => void loadMore().catch(fail)}>
              {t('group.loadMore')}
            </Button>
          )}
        </>
      ),
      empty:
        (group &&
          group.messages.length === 0 &&
          Object.keys(state.live).length === 0 && (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <Users
                className="mb-4 size-8 text-muted-foreground"
                strokeWidth={1.4}
              />
              <h3 className="text-base font-medium">{group.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                {t('group.emptyHint')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => changeMembersOpen(true)}
              >
                <Users className="size-3.5" />
                {t('group.invite')}
              </Button>
            </div>
          )) ||
        undefined,
      messageList: group
        ? getGroupMessageListProps({
            t,
            group: group,
            live: state.live,
            client: client,
            onError: fail,
            onOpenRuntime: workbench.openGroupAssistant
              ? (messageId, participantId) =>
                  workbench.openGroupAssistant?.({ messageId, participantId })
              : undefined,
            onReply: (message) => {
              setReply(message);
              selectMention(message.communication.senderId);
              pending.current = null;
              editor.current?.focus();
            },
          })
        : { messages: [] },
      after: group && (
        <GroupRunStatus group={group} client={client} onError={fail} />
      ),
    },
    composerBefore: (
      <>
        {group && (
          <GroupInteractions client={client} group={group} onError={fail} />
        )}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-destructive"
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              aria-label={t('group.dismiss')}
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      </>
    ),
    composer: {
      ...composer.controls,
      onSubmit: (event) => void submit(event),
      style: getSurfaceThemeStyle(theme),
      leadingActions: (
        <div className="pointer-events-auto min-w-0">
          <Popover open={recipientOpen} onOpenChange={setRecipientOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!group}
                className="max-w-full gap-1.5 px-2 text-muted-foreground"
                aria-label={t('group.sendTo')}
              >
                <AtSign className="size-4 shrink-0" />
                <span className="truncate">
                  {recipients.length
                    ? recipients.map(memberName).join(', ')
                    : t('group.primaryAssistant')}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="w-64 p-2">
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {t('group.sendTo')}
              </p>
              <div className="max-h-56 overflow-auto">
                {members
                  .filter(
                    (member) =>
                      member.active && member.id !== group?.viewerParticipantId,
                  )
                  .map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        selectMention(member.id);
                        setRecipientOpen(false);
                        pending.current = null;
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <ChatkitAvatar
                          label={member.name}
                          avatar={normalizeChatkitAvatar(member.avatar)}
                          className="size-6 shrink-0"
                        />
                        <span className="truncate">@{member.name}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(`group.kind.${member.kind}`)}
                      </span>
                    </button>
                  ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ),
      send: {
        disabled: !group || !text.trim() || sending || composer.blocked,
        sendLabel: t('group.send'),
      },
      beforeEditor: (
        <>
          {composer.attachments}
          {reply && (
            <div className="mb-2 flex items-center justify-between gap-2 border-l-2 border-border px-2 py-1 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">
                {t('group.replying', {
                  name: memberName(reply.communication.senderId),
                })}
              </span>
              <button
                type="button"
                onClick={() => {
                  setReply(null);
                  pending.current = null;
                }}
                aria-label={t('group.cancelReply')}
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          {mention !== null && (
            <div
              role="listbox"
              id="group-mentions"
              aria-label={t('group.mentions')}
              className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-64 overflow-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg"
            >
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {t('group.mentions')}
              </p>
              {candidates.map((member, index) => (
                <button
                  type="button"
                  role="option"
                  id={`group-mention-${member.id}`}
                  aria-selected={index === mentionIndex}
                  key={member.id}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted',
                    index === mentionIndex && 'bg-muted',
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectMention(member.id)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChatkitAvatar
                      label={member.name}
                      avatar={normalizeChatkitAvatar(member.avatar)}
                      className="size-6 shrink-0"
                    />
                    <span className="truncate">@{member.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`group.kind.${member.kind}`)}
                  </span>
                </button>
              ))}
              {!candidates.length && (
                <p className="p-3 text-sm text-muted-foreground">
                  {t('group.noMembers')}
                </p>
              )}
            </div>
          )}
        </>
      ),
      editor: {
        inputRef: editor,
        inline: composer.inline,
        hasInline: composer.hasInline,
        value: text,
        version: draft.composerDomVersion,
        focus: draft.focusComposerAt,
        'aria-label': t('group.composer'),
        placeholder: t('group.placeholder'),
        disabled: !group || sending,
        'aria-controls': mention !== null ? 'group-mentions' : undefined,
        'aria-activedescendant':
          mention !== null && candidates[mentionIndex]
            ? `group-mention-${candidates[mentionIndex].id}`
            : undefined,
        onCompositionStart: () => {
          draft.isComposerComposingRef.current = true;
        },
        onCompositionEnd: () => {
          draft.isComposerComposingRef.current = false;
        },
        onKeyDown: (event) => {
          if (
            draft.isComposerComposingRef.current ||
            event.nativeEvent.isComposing ||
            event.keyCode === 229
          )
            return;
          if (event.key === 'Escape') {
            setMention(null);
            return;
          }
          if (mention !== null && candidates.length) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setMentionIndex(
                (index) =>
                  (index +
                    (event.key === 'ArrowDown' ? 1 : -1) +
                    candidates.length) %
                  candidates.length,
              );
              return;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault();
              selectMention(candidates[mentionIndex]?.id ?? candidates[0].id);
              return;
            }
          }
          if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            replaceEditorSelection('\n');
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void submit(event);
          }
        },
        onInput: (event) => {
          syncEditor(event.currentTarget);
        },
        onPaste: (event) => {
          event.preventDefault();
          // Public group messages are text-only; never paste hidden HTML/resources.
          replaceEditorSelection(event.clipboardData.getData('text/plain'));
        },
        children: (
          <>
            {draft.renderedComposerParts.map((part, index) =>
              part.type === 'text' ? (
                <Fragment key={index}>{part.text}</Fragment>
              ) : null,
            )}
          </>
        ),
      },
    },
    footer: (
      <>
        {headerActions.footer}
        <Dialog open={membersOpen} onOpenChange={changeMembersOpen}>
          <DialogContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              (membersOpener.current?.isConnected &&
              !membersOpener.current.closest('[inert]')
                ? membersOpener.current
                : membersTrigger.current
              )?.focus();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('group.membersTitle')}</DialogTitle>
              <DialogDescription>{group?.title}</DialogDescription>
            </DialogHeader>
            {group && (
              <GroupMembers client={client} group={group} onError={fail} />
            )}
          </DialogContent>
        </Dialog>
      </>
    ),
  };
}
