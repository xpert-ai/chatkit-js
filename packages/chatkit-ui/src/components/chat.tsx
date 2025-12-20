import * as React from 'react';

import type { Message } from '@langchain/langgraph-sdk';

import { cn } from '../lib/utils';
import { useStreamContext } from '../providers/Stream';
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

function formatMessageContent(content: Message['content']) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const textValue = (part as { text?: unknown }).text;
          return typeof textValue === 'string' ? textValue : JSON.stringify(part);
        }
        return JSON.stringify(part);
      })
      .join('');
  }

  if (content == null) return '';

  return JSON.stringify(content);
}

export function Chat({
  className,
  title = 'Chat',
  placeholder = 'Type a message...',
  clientSecret = '',
  showAvatar = true,
}: ChatProps) {
  const stream = useStreamContext();

  const [draft, setDraft] = React.useState('');
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

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
  };

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
        <Button variant="ghost" size="icon" className="h-8 w-8">
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
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </Button>
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
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
                  className="h-6 w-6"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-medium">No messages yet</h3>
              <p className="text-sm text-muted-foreground">
                Start a conversation by sending a message below.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id ?? `${message.type}-${index}`}
                  className={cn(
                    'flex gap-3',
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
                    <p className="break-words text-sm leading-relaxed">
                      {formatMessageContent(message.content)}
                    </p>
                  </div>
                </div>
              ))}
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
        <form className="flex items-end gap-3" onSubmit={handleSubmit}>
          <div className="flex-1">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={placeholder}
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
