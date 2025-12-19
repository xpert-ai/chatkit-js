import React, { useEffect, useMemo, useState } from 'react';
import { BasicChat, type BasicChatMessage } from '@xpert-ai/chatkit-ui';

type ChatApiResponse = { content: string } | { error: string };

export default function App() {
  const [messages, setMessages] = useState<BasicChatMessage[]>([
    {
      id: 'seed-1',
      role: 'assistant',
      content: '你好！这是一个最简 ChatKit UI demo。',
      createdAt: new Date(),
    },
  ]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) ?? '';
  const assistantId = (import.meta.env.VITE_CHATKIT_ASSISTANT_ID as string | undefined) ?? '';

  const createSessionUrl = useMemo(() => {
    const base = backendOrigin.replace(/\/$/, '');
    return `${base}/api/create-session`;
  }, [backendOrigin]);

  useEffect(() => {
    let cancelled = false;

    async function createSession() {
      setSessionLoading(true);
      setSessionError(null);

      try {
        const response = await fetch(createSessionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(assistantId ? { assistantId } : {}),
        });

        const payload = (await response.json().catch(() => null)) as
          | { client_secret?: string; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error || `HTTP ${response.status}`);
        }

        const nextSecret = payload?.client_secret;
        if (!nextSecret) throw new Error('Missing client_secret in response');
        if (!cancelled) setClientSecret(nextSecret);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create session';
        if (!cancelled) setSessionError(message);
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    }

    void createSession();
    return () => {
      cancelled = true;
    };
  }, [createSessionUrl, assistantId]);

  async function handleSendMessage(content: string) {
    const response = await fetch(`${backendOrigin.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        messages: [
          ...messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          { role: 'user', content },
        ],
      }),
    });

    const payload = (await response.json().catch(() => null)) as ChatApiResponse | null;
    if (!response.ok) {
      const error =
        payload && 'error' in payload && payload.error ? payload.error : `HTTP ${response.status}`;
      throw new Error(error);
    }

    const assistantContent = payload && 'content' in payload ? payload.content : null;
    if (!assistantContent) throw new Error('Missing content from /api/chat');

    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: assistantContent,
      createdAt: new Date(),
    } satisfies BasicChatMessage;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Managed ChatKit Demo</h1>
          <div className="text-sm text-muted-foreground">
            {sessionLoading
              ? 'Creating session…'
              : sessionError
                ? `Session error: ${sessionError}`
                : clientSecret
                  ? `Session ready: ${clientSecret.slice(0, 12)}…`
                  : 'Session not created'}
          </div>
        </div>
      </div>
      <BasicChat
        className="h-[600px]"
        title="Chat"
        clientSecret={clientSecret}
        placeholder="输入消息..."
        messages={messages}
        onMessagesChange={setMessages}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}
