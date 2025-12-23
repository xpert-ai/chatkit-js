import * as React from 'react';

import type { Message } from '@langchain/langgraph-sdk';
import type { ChatkitMessage, XpertComposerOption, XpertToolOption, XpertStartScreenOption } from '@xpert-ai/chatkit-types';

import { cn } from '../lib/utils';
import { useStreamContext } from '../providers/Stream';
import { ComposerMenu } from './composer/ComposerMenu';
import { HistorySidebar, type Conversation } from './history/HistorySidebar';
import { AssistantMessage } from './thread/messages/ai';
import { MessageActions } from './thread/MessageActions';
import { StartScreen } from './thread/StartScreen';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

export type ChatProps = {
  className?: string;
  title?: string;
  placeholder?: string;
  clientSecret?: string;
  showAvatar?: boolean;
  composer?: XpertComposerOption;
  startScreen?: XpertStartScreenOption;
};

const apiUrl = import.meta.env.VITE_CHATKIT_API_BASE as string | undefined;
const assistantId = import.meta.env.VITE_CHATKIT_ASSISTANT_ID as string | undefined;
const apiKeyFromEnv = import.meta.env.VITE_CHATKIT_API_KEY as string | undefined;

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

export function Chat({
  className,
  title = 'Chat',
  placeholder = 'Type a message...',
  clientSecret = '',
  showAvatar = true,
  composer,
  startScreen,
}: ChatProps) {
  const stream = useStreamContext();

  const [draft, setDraft] = React.useState('');
  const [selectedTool, setSelectedTool] = React.useState<XpertToolOption | null>(null);
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [conversations, setConversations] = React.useState<Conversation[]>([
    { id: '1', title: 'Previous conversation 1' },
    { id: '2', title: 'Previous conversation 2' },
  ]);
  const [currentConversationId, setCurrentConversationId] = React.useState<string | undefined>();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Use placeholder from composer options or fallback to prop
  const inputPlaceholder = selectedTool?.placeholderOverride ?? composer?.placeholder ?? placeholder;

  const messages = stream.messages ?? [];
  const trimmedDraft = draft.trim();

  const scrollToBottom = React.useCallback(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const hasApiKey = Boolean(clientSecret.trim() || apiKeyFromEnv?.trim());
  const missingConfig = !apiUrl || !assistantId || !hasApiKey;
  const isSendDisabled = !trimmedDraft || stream.isLoading || missingConfig;

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
      { input: trimmedDraft },
      {
        optimisticValues: (prev) => {
          const prevMessages = prev?.messages ?? [];
          return { ...prev, messages: [...prevMessages, newMessage] };
        },
      },
    );

    // Clear selected tool if not persistent
    if (selectedTool && !selectedTool.persistent) {
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

  const handleToolSelect = (tool: XpertToolOption) => {
    setSelectedTool((prev) => (prev?.id === tool.id ? null : tool));
  };

  const handlePromptClick = (prompt: string) => {
    if (missingConfig || stream.isLoading) return;

    const newMessage: Message = {
      id: createMessageId(),
      type: 'human',
      content: prompt,
    };

    stream.submit(
      { input: prompt },
      {
        optimisticValues: (prev) => {
          const prevMessages = prev?.messages ?? [];
          return { ...prev, messages: [...prevMessages, newMessage] };
        },
      },
    );
  };

  const handleNewConversation = () => {
    const newId = createMessageId();
    setConversations((prev) => [
      { id: newId, title: 'New conversation' },
      ...prev,
    ]);
    setCurrentConversationId(newId);
    // Clear messages and reset thread for new conversation
    stream.reset(null);
  };

  const handleSelectConversation = (id: string) => {
    if (id === currentConversationId) return;
    setCurrentConversationId(id);
    // Reset messages and switch to the conversation's thread
    // For now, we just clear messages since we don't persist conversation data
    stream.reset(id);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(undefined);
    }
  };

  const handleRetry = (messageIndex: number) => {
    // Find the last human message before this AI message to resend
    const messagesUpToIndex = messages.slice(0, messageIndex);
    const lastHumanMessage = [...messagesUpToIndex].reverse().find(
      (m) => String(m.type) === 'human'
    );

    if (lastHumanMessage && typeof lastHumanMessage.content === 'string') {
      stream.submit(
        { input: lastHumanMessage.content },
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
        'flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
        </div>
        <HistorySidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          disabled={stream.isLoading}
        />
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div ref={viewportRef} className="px-6 py-4">
          {errorMessage && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
          {missingConfig && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Missing ChatKit configuration. Check `VITE_CHATKIT_API_BASE`,
              `VITE_CHATKIT_ASSISTANT_ID`, and the `clientSecret` prop.
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
                      ? message.content.map((part) => formatMessageContent(part)).join('')
                      : formatMessageContent(message.content);

                return (
                  <div
                    key={message.id ?? `${message.type}-${index}`}
                    className={cn(
                      'group flex gap-3',
                      message.type === 'human'
                        ? 'justify-end'
                        : 'justify-start',
                    )}
                  >
                    {message.type !== 'human' && showAvatar && (
                      <Avatar className="mt-1 h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          AI
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex flex-col">
                      <div
                        className={cn(
                          'max-w-[70%] rounded-2xl px-4 py-2.5',
                          message.type === 'human'
                            ? 'bg-primary text-primary-foreground'
                            : message.type === 'system'
                              ? 'bg-muted text-muted-foreground text-xs'
                              : 'bg-muted',
                        )}
                      >
                        {isAssistantMessage ? (
                          <AssistantMessage
                            message={{
                              ...(message as ChatkitMessage),
                              type: 'assistant',
                            }}
                          />
                        ) : Array.isArray(message.content) ? (
                          message.content.map((part, partIndex) => (
                            <p
                              key={`${part.type}-${partIndex}`}
                              className="break-words text-sm leading-relaxed"
                            >
                              {formatMessageContent(part)}
                            </p>
                          ))
                        ) : (
                          formatMessageContent(message.content)
                        )}
                      </div>
                      {/* Message actions */}
                      <MessageActions
                        content={messageContent}
                        isAssistant={isAssistantMessage}
                        onRetry={
                          isAssistantMessage && !stream.isLoading
                            ? () => handleRetry(index)
                            : undefined
                        }
                      />
                    </div>
                  </div>
                );
              })}
              {stream.isLoading && (
                <div className="flex justify-start gap-3">
                  {showAvatar && (
                    <Avatar className="mt-1 h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        AI
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="max-w-[70%] rounded-2xl bg-muted px-4 py-2.5">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
                    </div>
                  </div>
                </div>
              )}
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
            disabled={stream.isLoading || missingConfig}
          />

          <div className="flex-1">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={inputPlaceholder}
              disabled={stream.isLoading || missingConfig}
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
              <span className="text-xs font-semibold">Stop</span>
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
              <span className="sr-only">Send message</span>
            </Button>
          )}
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Powered by ChatKit AI
        </p>
      </div>
    </div>
  );
}
