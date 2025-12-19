import * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

export type EnhancedChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
  avatar?: string;
  name?: string;
};

export type EnhancedChatProps = {
  className?: string;
  title?: string;
  placeholder?: string;
  messages?: EnhancedChatMessage[];
  initialMessages?: EnhancedChatMessage[];
  onMessagesChange?: (messages: EnhancedChatMessage[]) => void;
  onSendMessage?: (
    content: string,
  ) =>
    | void
    | EnhancedChatMessage
    | EnhancedChatMessage[]
    | Promise<void | EnhancedChatMessage | EnhancedChatMessage[]>;
  showAvatar?: boolean;
  showTimestamp?: boolean;
};

export function EnhancedChat({
  className,
  title = 'Chat',
  placeholder = 'Type a message…',
  initialMessages = [],
  messages: controlledMessages,
  onMessagesChange,
  onSendMessage,
  showAvatar = true,
  showTimestamp = true,
}: EnhancedChatProps) {
  const isControlled = controlledMessages !== undefined;
  const [uncontrolledMessages, setUncontrolledMessages] =
    React.useState<EnhancedChatMessage[]>(initialMessages);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const messages = isControlled ? controlledMessages : uncontrolledMessages;

  const scrollToBottom = React.useCallback(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  function commitMessages(next: EnhancedChatMessage[]) {
    if (!isControlled) setUncontrolledMessages(next);
    onMessagesChange?.(next);
  }

  async function handleSend(nextContent: string) {
    const content = nextContent.trim();
    if (!content) return;

    const id =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    const newMessage: EnhancedChatMessage = {
      id,
      role: 'user',
      content,
      createdAt: new Date(),
    };

    const baseMessages = [...(messages ?? []), newMessage];
    commitMessages(baseMessages);
    setDraft('');

    if (!onSendMessage) return;

    try {
      setSending(true);
      const result = await onSendMessage(content);
      const assistantMessages = Array.isArray(result)
        ? result
        : result
          ? [result]
          : [];

      if (assistantMessages.length > 0) {
        const normalized = assistantMessages.map((message) => ({
          createdAt: message.createdAt ?? new Date(),
          ...message,
          id:
            message.id ??
            (globalThis.crypto?.randomUUID?.() ??
              `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`),
        }));
        commitMessages([...baseMessages, ...normalized]);
      }
    } finally {
      setSending(false);
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm',
        className,
      )}
    >
      {/* Header */}
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

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div ref={viewportRef} className="px-6 py-4">
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
              <p className="text-sm text-muted-foreground">Start a conversation by sending a message below.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  {message.role === 'assistant' && showAvatar && (
                    <Avatar className="mt-1 h-8 w-8">
                      <AvatarImage src={message.avatar} alt={message.name || 'AI'} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        AI
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={cn(
                      'max-w-[70%] rounded-2xl px-4 py-2.5',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : message.role === 'system'
                        ? 'bg-muted text-muted-foreground text-xs'
                        : 'bg-muted',
                    )}
                  >
                    <p className="text-sm leading-relaxed break-words">{message.content}</p>
                    {showTimestamp && message.createdAt && (
                      <p
                        className={cn(
                          'mt-1 text-xs',
                          message.role === 'user'
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground',
                        )}
                      >
                        {formatTime(message.createdAt)}
                      </p>
                    )}
                  </div>

                  {message.role === 'user' && showAvatar && (
                    <Avatar className="mt-1 h-8 w-8">
                      <AvatarImage src={message.avatar} alt={message.name || 'You'} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        YU
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex gap-3 justify-start">
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

      {/* Input */}
      <div className="border-t bg-muted/30 p-4">
        <form
          className="flex items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend(draft);
          }}
        >
          <div className="flex-1">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              disabled={sending}
              className="min-h-10 resize-none bg-background"
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={sending || !draft.trim()}
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
        </form>
        <p className="mt-2 text-xs text-muted-foreground text-center">
          Powered by ChatKit AI
        </p>
      </div>
    </div>
  );
}