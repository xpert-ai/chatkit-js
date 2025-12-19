import * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

export type BasicChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
};

export type BasicChatProps = {
  className?: string;
  title?: string;
  placeholder?: string;
  clientSecret?: string;
  messages?: BasicChatMessage[];
  initialMessages?: BasicChatMessage[];
  onMessagesChange?: (messages: BasicChatMessage[]) => void;
  onSendMessage?: (
    content: string,
  ) =>
    | void
    | BasicChatMessage
    | BasicChatMessage[]
    | Promise<void | BasicChatMessage | BasicChatMessage[]>;
};

export function BasicChat({
  className,
  title = 'Chat',
  clientSecret = '',
  placeholder = 'Type a message…',
  initialMessages = [],
  messages: controlledMessages,
  onMessagesChange,
  onSendMessage,
}: BasicChatProps) {
  const isControlled = controlledMessages !== undefined;
  const [uncontrolledMessages, setUncontrolledMessages] =
    React.useState<BasicChatMessage[]>(initialMessages);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  const messages = isControlled ? controlledMessages : uncontrolledMessages;

  const scrollToBottom = React.useCallback(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  function commitMessages(next: BasicChatMessage[]) {
    if (!isControlled) setUncontrolledMessages(next);
    onMessagesChange?.(next);
  }

  async function handleSend(nextContent: string) {
    const content = nextContent.trim();
    if (!content) return;

    const id =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    const newMessage: BasicChatMessage = {
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

      const result1 = await fetch('http://localhost:3000/api/ai/assistants/count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientSecret}`,
        },
        body: JSON.stringify({ metadata: {} })
      });

      console.log('Response from /api/chatkit/message:', await result1.text());

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

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <div className="font-semibold">{title}</div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className="text-xs text-muted-foreground">Online</span>
        </div>
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div ref={viewportRef} className="px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
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
                  className="h-5 w-5 text-muted-foreground"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No messages yet. Start a conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted',
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex gap-3 justify-start">
                  <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2.5">
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

      <form
        className="flex items-center gap-2 border-t bg-muted/30 p-4"
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
            className="bg-background"
            autoComplete="off"
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={sending || !draft.trim()}
          className="h-9 w-9 shrink-0"
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
    </div>
  );
}
