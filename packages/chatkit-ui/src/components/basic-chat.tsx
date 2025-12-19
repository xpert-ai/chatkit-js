import * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';

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
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);

  const messages = isControlled ? controlledMessages : uncontrolledMessages;

  React.useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages.length]);

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
        'flex h-full w-full flex-col overflow-hidden rounded-lg border bg-background',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="text-sm font-medium">{title}</div>
      </div>

      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">No messages yet.</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground',
                )}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
