import { useEffect } from 'react';
import { useXpertChatkit, XpertChatkit } from '@xpert-ai/chatkit-react';

export default function App() {
  const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) ?? '';
  const assistantId = (import.meta.env.VITE_CHATKIT_ASSISTANT_ID as string | undefined) ?? '';
  const chatkitTarget = (import.meta.env.VITE_CHATKIT_TARGET as string | undefined) ?? '';

  const { control } = useXpertChatkit({
    chatkitUrl: chatkitTarget,
    getClientSecret: async () => {
      const createSessionUrl = backendOrigin
        ? `${backendOrigin.replace(/\/$/, '')}/api/create-session`
        : '/api/create-session';

      const response = await fetch(createSessionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(assistantId ? { assistantId } : {}),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.client_secret) {
        throw new Error('Missing client_secret in response');
      }

      return data.client_secret;
    },
    onError: (error) => {
      console.error('Failed to create session:', error);
    },
  });

  useEffect(() => {
    console.log('Managed Chatkit Example with React Component');
    console.log('Backend:', backendOrigin || '(using proxy)');
    console.log('Chatkit URL:', chatkitTarget);
    console.log('Assistant ID:', assistantId);
  }, [backendOrigin, chatkitTarget, assistantId]);

  return (
    <div className="flex h-screen">
      <div className="w-96 p-4 border-r border-gray-300">
        <h1 className="text-2xl font-bold mb-4">Managed Chatkit Example</h1>
        <p className="text-sm text-gray-600 mb-2">Using React Component</p>

        <div className="space-y-2 text-xs text-gray-500">
          <div>
            <strong>Backend:</strong> {backendOrigin || '(proxy)'}
          </div>
          <div>
            <strong>Chatkit:</strong> {chatkitTarget}
          </div>
          <div>
            <strong>Assistant:</strong> {assistantId || '(default)'}
          </div>
          <div>
            <strong>Status:</strong> {control.status}
          </div>
        </div>
      </div>

      <XpertChatkit control={control} className="flex-1" />
    </div>
  );
}
