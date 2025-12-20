import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type EnhancedChatMessage } from '@xpert-ai/chatkit-ui';

type ChatApiResponse = { content: string } | { error: string };

export default function App() {
  const [messages, setMessages] = useState<EnhancedChatMessage[]>([]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) ?? '';
  const assistantId = (import.meta.env.VITE_CHATKIT_ASSISTANT_ID as string | undefined) ?? '';
  const chatkitTarget = (import.meta.env.VITE_CHATKIT_TARGET as string | undefined) ?? '';

  const createSessionUrl = useMemo(() => {
    const base = backendOrigin.replace(/\/$/, '');
    return `${base}/api/create-session`;
  }, [backendOrigin]);

  const chatkitOrigin = useMemo(() => {
    try {
      return new URL(chatkitTarget, window.location.origin).origin;
    } catch {
      return '*';
    }
  }, [chatkitTarget]);

  const postClientSecretToIframe = useCallback(() => {
    if (!clientSecret) return;
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow) return;
    targetWindow.postMessage(
      { type: 'chatkit:client-secret', clientSecret },
      chatkitOrigin,
    );
  }, [clientSecret, chatkitOrigin]);

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

  useEffect(() => {
    postClientSecretToIframe();
  }, [postClientSecretToIframe]);

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
      name: 'AI Assistant',
    } satisfies EnhancedChatMessage;
  }

  return (
    <div className="flex h-screen">
      <div className="w-96 p-4 border-r border-gray-300">
        <h1 className="text-2xl font-bold mb-4">Managed Chatkit Example</h1>
        {sessionLoading && <p>Creating session...</p>}
      </div>
      <iframe
        ref={iframeRef}
        src={chatkitTarget}
        className="flex-1"
        title="Chat"
        onLoad={postClientSecretToIframe}
      ></iframe>
    </div>
  );
}
