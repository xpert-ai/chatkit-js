import { useEffect } from 'react';
import type { ChatkitMessage } from '@xpert-ai/chatkit-types';
import '@xpert-ai/chatkit-web-component';

export default function App() {
  const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) ?? '';
  const assistantId = (import.meta.env.VITE_CHATKIT_ASSISTANT_ID as string | undefined) ?? '';
  const chatkitTarget = (import.meta.env.VITE_CHATKIT_TARGET as string | undefined) ?? '';

  useEffect(() => {
    console.log('🚀 Managed Chatkit Example with Web Component');
    console.log('Backend:', backendOrigin || '(using proxy)');
    console.log('Chatkit URL:', chatkitTarget);
    console.log('Assistant ID:', assistantId);
  }, [backendOrigin, chatkitTarget, assistantId]);

  return (
    <div className="flex h-screen">
      <div className="w-96 p-4 border-r border-gray-300">
        <h1 className="text-2xl font-bold mb-4">Managed Chatkit Example</h1>
        <p className="text-sm text-gray-600 mb-2">Using Web Component</p>

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
        </div>
      </div>

      <xpert-chatkit
        backend-url={backendOrigin}
        chatkit-url={chatkitTarget}
        assistant-id={assistantId}
        className="flex-1"
      />
    </div>
  );
}
