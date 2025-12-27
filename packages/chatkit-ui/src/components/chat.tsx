import * as React from 'react';

import type { ChatMessage, Message } from '@xpert-ai/xpert-sdk';
import type { ChatkitMessage, ChatKitOptions, ToolOption } from '@xpert-ai/chatkit-types';

import { cn } from '../lib/utils';
import { useStreamContext } from '../providers/Stream';
import { ComposerMenu } from './composer/ComposerMenu';
import { HistorySidebar } from './history/HistorySidebar';
import { AssistantMessage } from './thread/messages/ai';
import { MessageActions } from './thread/MessageActions';
import { StartScreen } from './thread/StartScreen';
// Avatar import removed - AI avatar disabled
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { useStreamManager } from '../hooks/useStream';
import { useThreads } from '../hooks/useThreads';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';

export type ChatProps = {
  className?: string;
  title?: string;
  placeholder?: string;
  clientSecret?: string;
  options?: ChatKitOptions | null;
};

const apiUrl = import.meta.env.VITE_CHATKIT_API_BASE as string | undefined;
const assistantId = import.meta.env.VITE_CHATKIT_ASSISTANT_ID as string | undefined;
const apiKeyFromEnv = import.meta.env.VITE_CHATKIT_API_KEY as string | undefined;
const DEFAULT_HISTORY_LIMIT = 200;

function createMessageId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function formatMessageContent(content: Message['content'][number]): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const textValue = (part as { text?: unknown }).text;
          return typeof textValue === 'string' ? textValue : '';
        }
        return '';
      })
      .join('');
  }

  if (content == null) return '';

  // Handle object with text property (e.g., {"type":"text","text":"..."})
  if (typeof content === 'object' && 'text' in content) {
    const textValue = (content as { text?: unknown }).text;
    return typeof textValue === 'string' ? textValue : '';
  }

  return '';
}

function normalizeRoleToMessageType(role?: string): Message['type'] {
  const normalized = (role ?? '').toLowerCase();
  if (normalized === 'user' || normalized === 'human') return 'human';
  if (normalized === 'assistant' || normalized === 'ai') return 'ai';
  if (normalized === 'system') return 'system';
  if (normalized === 'tool') return 'tool';
  return 'ai';
}

function mapChatMessageToUiMessage(message: ChatMessage): Message {
  return {
    id: message.id ?? createMessageId(),
    type: normalizeRoleToMessageType(message.role),
    content: message.content ?? '',
    ...(message.reasoning ? { reasoning: message.reasoning as any } : {}),
    ...(message.executionId ? { executionId: message.executionId } : {}),
  } as Message;
}

function sortMessagesByCreatedAt(items: ChatMessage[]): ChatMessage[] {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.createdAt ?? '');
    const bTime = Date.parse(b.createdAt ?? '');
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return -1;
    if (Number.isNaN(bTime)) return 1;
    return aTime - bTime;
  });
}

export function Chat({
  className,
  options,
  title,
  placeholder,
  clientSecret = '',
}: ChatProps) {
  const { t } = useChatkitTranslation();
  const composer = options?.composer;
  const startScreen = options?.startScreen;
  const {setStream} = useStreamManager();
  const stream = useStreamContext();

  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);

  // Minimum loading dots display time (ms)
  const LOADING_DOTS_MIN_DURATION = 800;
  const [showLoadingDots, setShowLoadingDots] = React.useState(false);
  const loadingStartTimeRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setStream(stream);
  }, [setStream, stream]);

  // Handle loading dots with minimum display time
  React.useEffect(() => {
    if (stream.isLoading) {
      // Start showing loading dots
      if (!loadingStartTimeRef.current) {
        loadingStartTimeRef.current = Date.now();
        setShowLoadingDots(true);
      }
    } else {
      // Loading finished - check if we need to keep dots visible
      if (loadingStartTimeRef.current) {
        const elapsed = Date.now() - loadingStartTimeRef.current;
        const remaining = LOADING_DOTS_MIN_DURATION - elapsed;

        if (remaining > 0) {
          // Keep dots visible for remaining time
          const timer = setTimeout(() => {
            setShowLoadingDots(false);
            loadingStartTimeRef.current = null;
          }, remaining);
          return () => clearTimeout(timer);
        } else {
          // Minimum time already passed
          setShowLoadingDots(false);
          loadingStartTimeRef.current = null;
        }
      }
    }
  }, [stream.isLoading]);

  const [draft, setDraft] = React.useState('');
  const [selectedTool, setSelectedTool] = React.useState<ToolOption | null>(null);
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const {
    conversations,
    createConversation,
    deleteConversation,
    refreshConversations,
    isLoading: isThreadsLoading,
  } = useThreads();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resolvedTitle = title ?? t('chat.title');
  const resolvedPlaceholder = placeholder ?? t('chat.placeholder');

  // Use placeholder from composer options or fallback to prop/i18n
  const inputPlaceholder =
    selectedTool?.placeholderOverride ?? composer?.placeholder ?? resolvedPlaceholder;

  const messages = stream.messages ?? [];
  const trimmedDraft = draft.trim();

  const scrollToBottom = React.useCallback((smooth = false) => {
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      // Find the actual Radix ScrollArea Viewport element
      const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: smooth ? 'smooth' : 'instant',
        });
      }
    });
  }, []);

  // Auto-scroll when messages change or during streaming
  React.useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Also scroll when streaming content updates (for smooth following)
  React.useEffect(() => {
    if (stream.isLoading) {
      scrollToBottom();
    }
  }, [stream.isLoading, messages, scrollToBottom]);

  const hasApiKey = Boolean(clientSecret.trim() || apiKeyFromEnv?.trim());
  const missingConfig = !apiUrl || !assistantId || !hasApiKey;
  const isSendDisabled =
    !trimmedDraft || stream.isLoading || missingConfig || isHistoryLoading;

  React.useEffect(() => {
    if (missingConfig) return;
    void refreshConversations();
  }, [missingConfig, refreshConversations]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSendDisabled) return;

    const newMessage: Message = {
      id: createMessageId(),
      type: 'human',
      content: trimmedDraft,
    };

    setDraft('');

    stream.submit(
      { input: { input: trimmedDraft } },
      {
        optimisticValues: (prev) => {
          const prevMessages = prev?.messages ?? [];
          return { ...prev, messages: [...prevMessages, newMessage] };
        },
      },
    );

    // Immediately scroll to bottom to show the new message
    scrollToBottom(true);

    // Clear selected tool if not persistent
    if (selectedTool && !selectedTool.pinned) {
      setSelectedTool(null);
    }
    // Clear attachments after submit
    setAttachments([]);
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxCount = composer?.attachments?.maxCount ?? 10;
    const maxSize = composer?.attachments?.maxSize ?? 100 * 1024 * 1024; // 100MB default

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSize) {
        console.warn(`File ${file.name} exceeds max size of ${maxSize} bytes`);
        continue;
      }
      validFiles.push(file);
    }

    setAttachments((prev) => {
      const combined = [...prev, ...validFiles];
      return combined.slice(0, maxCount);
    });

    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToolSelect = (tool: ToolOption) => {
    setSelectedTool((prev) => (prev?.id === tool.id ? null : tool));
  };

  const handlePromptClick = (prompt: string) => {
    if (missingConfig || stream.isLoading || isHistoryLoading) return;

    const newMessage: Message = {
      id: createMessageId(),
      type: 'human',
      content: prompt,
    };

    stream.submit(
      { input: { input: prompt } },
      {
        optimisticValues: (prev) => {
          const prevMessages = prev?.messages ?? [];
          return { ...prev, messages: [...prevMessages, newMessage] };
        },
      },
    );

    // Scroll to bottom to show the new message
    scrollToBottom(true);
  };

  const loadConversationMessages = React.useCallback(
    async (conversationId: string, threadId?: string | null) => {
      if (missingConfig) {
        setHistoryError(t('chat.missingConfigShort'));
        return;
      }
      setHistoryError(null);
      setIsHistoryLoading(true);
      try {
        stream.stop();
      } catch {
        // ignore stop errors from an already-idle stream
      }
      try {
        const response = await stream.client.conversations.listMessages(conversationId, {
          limit: DEFAULT_HISTORY_LIMIT,
          offset: 0,
        });
        const sorted = sortMessagesByCreatedAt(response.items ?? []);
        const mapped = sorted.map(mapChatMessageToUiMessage);
        stream.reset(threadId ?? null, mapped as Message[]);
        setActiveConversationId(conversationId);
      } catch (err) {
        console.warn('Failed to load conversation messages', err);
        setHistoryError(
          err instanceof Error ? err.message : t('chat.errors.loadMessages'),
        );
        stream.reset(threadId ?? null, []);
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [missingConfig, stream, t],
  );

  React.useEffect(() => {
    if (!stream.threadId) return;
    if (isHistoryLoading) return;
    const matched = conversations.find((item) => item.threadId === stream.threadId);
    if (!matched) return;
    if (activeConversationId && activeConversationId === matched.id) return;
    if (messages.length > 0) {
      setActiveConversationId(matched.id);
      return;
    }
    void loadConversationMessages(matched.id, matched.threadId ?? null);
  }, [
    conversations,
    stream.threadId,
    messages.length,
    activeConversationId,
    isHistoryLoading,
    loadConversationMessages,
  ]);

  const handleNewConversation = async () => {
    if (missingConfig || stream.isLoading || isHistoryLoading) return;
    setHistoryError(null);
    try {
      const created = await createConversation({ title: t('history.newConversationTitle') });
      setActiveConversationId(created.id);
      stream.reset(created.threadId ?? null, []);
      await refreshConversations();
    } catch (err) {
      console.warn('Failed to create conversation', err);
      setHistoryError(
        err instanceof Error ? err.message : t('chat.errors.createConversation'),
      );
    }
  };

  const handleSelectConversation = (id: string) => {
    if (isHistoryLoading) return;
    setHistoryError(null);
    const conversation = conversations.find((item) => item.id === id);
    const nextThreadId = conversation?.threadId ?? null;
    if (id === activeConversationId && stream.threadId === nextThreadId) return;
    void loadConversationMessages(id, nextThreadId);
  };

  const handleDeleteConversation = (id: string) => {
    setHistoryError(null);
    void deleteConversation(id)
      .then(() => {
        if (activeConversationId === id) {
          stream.reset(null, []);
          setActiveConversationId(null);
        }
        return refreshConversations();
      })
      .catch((err) => {
        console.warn('Failed to delete conversation', err);
        setHistoryError(
          err instanceof Error ? err.message : t('chat.errors.deleteConversation'),
        );
      });
  };

  const handleRetry = (messageIndex: number) => {
    // Find the last human message before this AI message to resend
    const messagesUpToIndex = messages.slice(0, messageIndex);
    const lastHumanMessage = [...messagesUpToIndex].reverse().find(
      (m) => String(m.type) === 'human'
    );

    if (lastHumanMessage && typeof lastHumanMessage.content === 'string') {
      stream.submit(
        { input: {input: lastHumanMessage.content} },
        {
          optimisticValues: (prev) => {
            // Remove the AI message that we're retrying
            const prevMessages = prev?.messages ?? [];
            return {
              ...prev,
              messages: prevMessages.slice(0, messageIndex),
            };
          },
        },
      );
    }
  };

  // Build accept string for file input
  const acceptMimes = composer?.attachments?.accept
    ? Object.entries(composer.attachments.accept)
        .map(([mime, exts]) => [mime, ...exts.map((e) => `.${e}`)].join(','))
        .join(',')
    : undefined;

  const errorMessage =
    stream.error instanceof Error ? stream.error.message : undefined;

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-hidden bg-background shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <div>
            <h2 className="text-lg font-semibold">{resolvedTitle}</h2>
            <p className="text-xs text-muted-foreground">{t('chat.statusOnline')}</p>
          </div>
        </div>
        <HistorySidebar
          conversations={conversations}
          currentConversationId={activeConversationId ?? undefined}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          disabled={missingConfig || stream.isLoading || isThreadsLoading || isHistoryLoading}
        />
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div ref={viewportRef} className="px-6 py-4">
          {errorMessage && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
          {historyError && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {historyError}
            </div>
          )}
          {missingConfig && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t('chat.missingConfigDetail')}
            </div>
          )}
          {isHistoryLoading && (
            <div className="mb-4 rounded-lg border border-muted px-3 py-2 text-sm text-muted-foreground">
              {t('chat.loadingConversation')}
            </div>
          )}
          {messages.length === 0 ? (
            <StartScreen
              startScreen={startScreen}
              onPromptClick={handlePromptClick}
            />
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => {
                const messageType = String(message.type);
                const isAssistantMessage =
                  messageType === 'assistant' || messageType === 'ai';

                const messageContent =
                  typeof message.content === 'string'
                    ? message.content
                    : Array.isArray(message.content)
                      ? message.content.map((part) => formatMessageContent(part as any)).join('')
                      : formatMessageContent(message.content);

                return (
                  <div
                    key={message.id ?? `${message.type}-${index}`}
                    className={cn(
                      'group flex gap-3',
                      message.type === 'human'
                        ? 'justify-end'
                        : 'justify-start -ml-1',  // AI messages: slightly closer to left
                    )}
                  >
                    <div className="flex flex-col">
                      <div
                        className={cn(
                          'max-w-full rounded-2xl',
                          message.type === 'human'
                            ? 'bg-primary text-primary-foreground px-4 py-2.5'
                            : message.type === 'system'
                              ? 'bg-muted text-muted-foreground text-xs px-4 py-2.5'
                              : 'py-1',  // AI messages: minimal padding, no background
                        )}
                      >
                        {isAssistantMessage ? (
                          <AssistantMessage
                            message={{
                              ...(message as ChatkitMessage),
                              type: 'assistant',
                            }}
                            isStreaming={stream.isLoading && index === messages.length - 1}
                          />
                        ) : Array.isArray(message.content) ? (
                          message.content.map((part, partIndex) => (
                            <p
                              key={`${part.type}-${partIndex}`}
                              className="break-words text-sm leading-relaxed"
                            >
                              {formatMessageContent(part as any)}
                            </p>
                          ))
                        ) : (
                          formatMessageContent(message.content)
                        )}
                      </div>
                      {/* Message actions - hidden during streaming, retry only for last AI message */}
                      <MessageActions
                        content={messageContent}
                        isAssistant={isAssistantMessage}
                        isStreaming={stream.isLoading && index === messages.length - 1}
                        onRetry={
                          isAssistantMessage && !stream.isLoading && index === messages.length - 1
                            ? () => handleRetry(index)
                            : undefined
                        }
                      />
                    </div>
                  </div>
                );
              })}
              {/* Show loading indicator with minimum display time */}
              {showLoadingDots && (() => {
                const lastMessage = messages[messages.length - 1];
                const lastMessageType = lastMessage ? String(lastMessage.type) : '';
                const isLastMessageFromAI = lastMessageType === 'ai' || lastMessageType === 'assistant';
                // Hide dots once AI has substantial content
                const lastMsgContent = lastMessage?.content;
                const hasSubstantialContent = isLastMessageFromAI &&
                  ((typeof lastMsgContent === 'string' && lastMsgContent.length > 10) ||
                   (Array.isArray(lastMsgContent) && lastMsgContent.length > 0));
                if (hasSubstantialContent) return null;
                return (
                  <div className="flex justify-start gap-3 -ml-2">
                    <div className="max-w-full rounded-2xl py-2.5">
                      <div className="flex gap-1.5">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]"></div>
                        <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]"></div>
                        <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60"></div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t bg-muted/30 p-4">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptMimes}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-sm"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(index)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Selected tool indicator */}
        {selectedTool && (
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {selectedTool.shortLabel ?? selectedTool.label}
            </span>
            <button
              type="button"
              onClick={() => setSelectedTool(null)}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <form className="flex items-end gap-2" onSubmit={handleSubmit}>
          {/* Composer Menu (plus button) */}
          <ComposerMenu
            composer={composer}
            onAttachmentClick={handleAttachmentClick}
            onToolSelect={handleToolSelect}
            selectedTool={selectedTool}
            disabled={stream.isLoading || missingConfig || isHistoryLoading}
          />

          <div className="flex-1">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={inputPlaceholder}
              disabled={stream.isLoading || missingConfig || isHistoryLoading}
              className="min-h-10 resize-none bg-background"
              autoComplete="off"
            />
          </div>
          {stream.isLoading ? (
            <Button
              type="button"
              size="icon"
              onClick={() => stream.stop()}
              className="h-10 w-10 shrink-0"
            >
              <span className="text-xs font-semibold">{t('chat.stop')}</span>
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={isSendDisabled}
              className="h-10 w-10 shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              <span className="sr-only">{t('chat.send')}</span>
            </Button>
          )}
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t('chat.poweredBy')}
        </p>
      </div>
    </div>
  );
}
