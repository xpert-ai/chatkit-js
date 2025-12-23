import { useEffect } from 'react';
import { useChatKit, XpertChatKit, type ChatKitOptions } from '@xpert-ai/chatkit-react';

// Example options configuration - try changing these values to see the effect!
const chatkitOptions: ChatKitOptions = {
  theme: {
    // Try: 'light' or 'dark'
    colorScheme: 'light',
    // Try: 'pill', 'round', 'soft', 'sharp'
    radius: 'round',
    // Try: 'compact', 'normal', 'spacious'
    density: 'normal',
    typography: {
      // Try: 14, 15, 16, 17, 18
      baseSize: 15,
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    color: {
      accent: {
        // Try different hex colors: '#007bff', '#10b981', '#f59e0b', '#ef4444'
        primary: '#ee5555',
        level: 1,
      },
    },
  },
  composer: {
    placeholder: '随便问我点什么吧～～',
    attachments: {
      enabled: true,
      maxCount: 5,
      maxSize: 10485760, // 10MB
    },
    tools: [
      {
        id: 'create-theme',
        label: 'Create Theme',
        shortLabel: 'Theme',
        icon: 'settings-slider',
        placeholderOverride: 'Describe the theme you want to create...',
      },
      {
        id: 'web-search',
        label: 'Web Search',
        shortLabel: 'Search',
        icon: 'search',
        placeholderOverride: 'Enter your search query...',
      },
    ],
  },
  startScreen: {
    greeting: 'Hello! How can I help you today?',
    prompts: [
      {
        icon: 'circle-question',
        label: 'What can you do?',
        prompt: 'What can you help me with?',
      },
      {
        icon: 'lightbulb',
        label: 'Give me ideas',
        prompt: 'Give me some creative ideas for a project',
      },
    ],
  },
  header: {
    enabled: true,
    title: {
      enabled: true,
      text: 'Xpert Assistant',
    },
  },
};

export default function App() {
  const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) ?? '';
  const assistantId = (import.meta.env.VITE_CHATKIT_ASSISTANT_ID as string | undefined) ?? '';
  const chatkitTarget = (import.meta.env.VITE_CHATKIT_TARGET as string | undefined) ?? '';

  const { control } = useChatKit({
    chatkitUrl: chatkitTarget,
    options: chatkitOptions,
    api: {
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
      }
    },
    onError: (error) => {
      console.error('Failed to create session:', error);
    },
  });

  useEffect(() => {
    console.log('Managed Chatkit Example with React Component');
    console.log('Backend:', backendOrigin || '(using proxy)');
    console.log('Chatkit URL:', control.chatkitUrl);
    console.log('Assistant ID:', assistantId);
    console.log('Theme:', chatkitOptions.theme);
  }, [backendOrigin, control.chatkitUrl, assistantId]);

  return (
    <div className="flex h-screen">
      <div className="w-96 p-4 border-r border-gray-300 bg-white">
        <h1 className="text-2xl font-bold mb-4">Managed Chatkit Example</h1>
        <p className="text-sm text-gray-600 mb-2">Using React Component with Options</p>

        <div className="space-y-2 text-xs text-gray-500">
          <div>
            <strong>Backend:</strong> {backendOrigin || '(proxy)'}
          </div>
          <div>
            <strong>Chatkit URL:</strong>
            <div className="break-all mt-1 p-1 bg-gray-100 rounded text-[10px]">
              {control.chatkitUrl}
            </div>
          </div>
          <div>
            <strong>Assistant:</strong> {assistantId || '(default)'}
          </div>
          <div>
            <strong>Status:</strong> {control.status}
          </div>
          <div className="pt-2 border-t">
            <strong>Theme Config:</strong>
            <pre className="mt-1 p-2 bg-gray-100 rounded text-[10px] overflow-auto max-h-40">
              {JSON.stringify(chatkitOptions.theme, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <XpertChatKit control={control} className="flex-1" />
    </div>
  );
}
