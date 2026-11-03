import * as React from 'react';
import { safeRandomUUID } from '@xpert-ai/chatkit-web-shared';
import type { ChatConversation } from '@xpert-ai/xpert-sdk';
import type { ThreadItem } from '../../hooks/useThreads';
import type { ChatKitAIMessage } from '../../providers/stream/types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  getConversationActions,
  type ConversationActionContext,
} from './conversation-actions';
import {
  copyConversationText,
  downloadConversation,
  readConversationTranscript,
  serializeConversation,
} from './conversation-transcript';

export type ConversationMenuDialog =
  | 'rename'
  | 'delete'
  | 'branch'
  | 'share'
  | 'export'
  | 'error'
  | null;

export function useConversationMenu(
  context: ConversationActionContext,
  target: ThreadItem,
) {
  const { t } = useChatkitTranslation();
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<ConversationMenuDialog>(null);
  const [detail, setDetail] = React.useState<ChatConversation | null>(null);
  const [messages, setMessages] = React.useState<ChatKitAIMessage[] | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [draft, setDraft] = React.useState(target.title);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const request = React.useRef<AbortController | null>(null);
  const busyRef = React.useRef(false);
  const lifetime = React.useRef(0);
  const latest = React.useRef({ context, target });
  latest.current = { context, target };
  const branchRequest = React.useRef<{
    messageId: string;
    requestId: string;
    result?: ChatConversation;
  } | null>(null);

  React.useEffect(() => {
    lifetime.current += 1;
    setOpen(false);
    setDialog(null);
    setDetail(null);
    setMessages(null);
    setBusy(false);
    busyRef.current = false;
    branchRequest.current = null;
    return () => {
      lifetime.current += 1;
      request.current?.abort();
    };
  }, [context.client, context.scopeKey, target.recordId, target.id]);

  const actions = getConversationActions(
    context,
    target,
    detail,
    messages,
    busy,
  );
  React.useEffect(() => {
    if (!context.ready || (dialog === 'share' && actions.share.disabled)) {
      setOpen(false);
      setDialog(null);
    }
  }, [context.ready, dialog, actions.share.disabled]);

  const load = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setDetail(null);
    setMessages(null);
    setError('');
    setNotice('');
    setLoading(true);
    const current = () =>
      request.current === controller && !controller.signal.aborted;
    try {
      const record = await context.client.conversations.get(target.recordId, {
        signal: controller.signal,
      });
      if (!current()) return;
      if (record.id !== target.recordId)
        throw new Error('Conversation mismatch');
      setDetail(record);
      setDraft(record.title || target.title);
      if (typeof context.client.conversations.searchMessages === 'function') {
        const transcript = await readConversationTranscript(
          context.client,
          target,
          controller.signal,
        );
        if (current()) setMessages(transcript);
      }
    } catch {
      if (current()) setError(t('conversationMenu.loadFailed'));
    } finally {
      if (current()) setLoading(false);
    }
  };

  const onOpenChange = (value: boolean) => {
    if (busyRef.current) return;
    setOpen(value);
    if (
      value &&
      context.ready &&
      typeof context.client.conversations?.get === 'function'
    )
      void load();
  };
  // An open menu must not reuse a transcript captured before a new run completed.
  const reloadRef = React.useRef(load);
  reloadRef.current = load;
  const previousRunning = React.useRef(context.running);
  React.useEffect(() => {
    if (previousRunning.current === context.running) return;
    previousRunning.current = context.running;
    if (open) void reloadRef.current();
  }, [context.running, open]);
  const run = async (action: () => Promise<void>, close = true) => {
    if (busyRef.current || !context.ready) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const epoch = lifetime.current;
    try {
      await action();
      if (epoch === lifetime.current && close) setDialog(null);
    } catch {
      if (epoch === lifetime.current) {
        setError(t('conversationMenu.actionFailed'));
        setDialog((value) => value ?? 'error');
      }
    } finally {
      if (epoch === lifetime.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  /** Re-read mutable state at action time; browsing metadata is not authorization. */
  const validate = async (name: 'rename' | 'delete' | 'branch') => {
    const epoch = lifetime.current;
    const record = await context.client.conversations.get(target.recordId);
    if (epoch !== lifetime.current) throw new Error('Conversation changed');
    const policy = getConversationActions(
      latest.current.context,
      latest.current.target,
      record,
      messages,
    );
    setDetail(record);
    if (!policy[name].visible || policy[name].disabled)
      throw new Error('Action unavailable');
  };

  const rename = () => {
    if (actions.rename.disabled || !actions.rename.visible) return;
    const title = draft.trim();
    if (!title) {
      setError(t('chat.conversationTitle.required'));
      return;
    }
    return run(async () => {
      const epoch = lifetime.current;
      await validate('rename');
      await context.rename(target, title);
      if (epoch === lifetime.current)
        setDetail((value) => value && { ...value, title });
    });
  };
  const remove = () => {
    if (actions.delete.disabled || !actions.delete.visible) return;
    return run(async () => {
      await validate('delete');
      await context.delete(target);
    });
  };
  const branch = (messageId: string) => {
    if (
      actions.branch.disabled ||
      !actions.replies.some((item) => item.id === messageId)
    )
      return;
    return run(async () => {
      await validate('branch');
      if (branchRequest.current?.messageId !== messageId)
        branchRequest.current = { messageId, requestId: safeRandomUUID() };
      const attempt = branchRequest.current;
      const epoch = lifetime.current;
      attempt.result ??= await context.client.conversations.branch(
        target.recordId,
        {
          sourceThreadId: target.id,
          afterMessageId: messageId,
          requestId: attempt.requestId,
        },
      );
      if (epoch === lifetime.current && latest.current.context.ready)
        context.navigate(attempt.result);
    });
  };
  const sideChat = () => {
    if (actions.sideChat.disabled || !actions.sideChat.visible) return;
    return run(async () => {
      await context.sideChat?.();
    });
  };
  const exportTranscript = (format: 'markdown' | 'text', download = false) => {
    if (actions.export.disabled || !actions.export.visible || !messages) return;
    return run(async () => {
      const epoch = lifetime.current;
      const title = detail?.title || target.title;
      const text = serializeConversation(title, messages, format, {
        user: t('sharing.user'),
        assistant: t('sharing.assistant'),
        textOnly: t('conversationMenu.textOnly'),
      });
      if (download) downloadConversation(title, text);
      else await copyConversationText(text);
      if (epoch === lifetime.current)
        setNotice(
          t(
            download
              ? 'conversationMenu.downloaded'
              : 'conversationMenu.copied',
          ),
        );
    }, false);
  };
  const openDialog = (value: ConversationMenuDialog) => {
    setError('');
    setNotice('');
    setDialog(value);
  };
  const closeDialog = (value: boolean) => {
    if (!value && !busyRef.current) setDialog(null);
  };
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    triggerRef.current?.focus();
  };
  return {
    t,
    open,
    onOpenChange,
    dialog,
    openDialog,
    closeDialog,
    detail,
    actions,
    busy,
    loading,
    error,
    notice,
    draft,
    setDraft,
    triggerRef,
    restoreFocus,
    rename,
    remove,
    branch,
    sideChat,
    exportTranscript,
    reload: load,
  };
}
