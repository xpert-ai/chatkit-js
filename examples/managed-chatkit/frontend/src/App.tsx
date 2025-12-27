import { useEffect } from 'react';
import { useChatKit, ChatKit } from '@xpert-ai/chatkit-react';
import { ChatKitOptions, ClientToolMessageInput, filterPlaygroundOptions } from '@xpert-ai/chatkit-types';
import { useAppStore } from './store/useAppStore';

// ============================================================================
// Playground 配置 - 从 https://chatkit.studio/playground 复制过来的配置
// 只有白名单内的配置项会生效: theme, composer, startScreen, api
// 其他配置项(如 threadItemActions.feedback)会被自动过滤掉
// ============================================================================
const playgroundConfig: Partial<ChatKitOptions> = {
  theme: {
    colorScheme: 'dark',
    radius: 'pill',
    density: 'normal',
    color: {
      grayscale: {
        hue: 207,
        tint: 7
      },
      accent: {
        primary: '#dfe302',
        level: 1
      },
      surface: {
        background: '#e9c9c9',
        foreground: '#a8df8b'
      }
    },
    typography: {
      baseSize: 14,
      fontFamily: '\'JetBrains Mono\', monospace',
      fontFamilyMono: '\'JetBrains Mono\', monospace',
      fontSources: [
        {
          family: 'JetBrains Mono',
          style: 'normal',
          weight: 300,
          display: 'swap',
          src: 'https://fonts.gstatic.com/s/jetbrainsmono/v23/tDbV2o-flEEny0FZhsfKu5WU4xD1OwGtT0rU3BE.woff2',
          unicodeRange: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'
        }
      // ...and 9 more font sources
      ]
    }
  },
  composer: {
    placeholder: '给agent发消息',
    attachments: {
      enabled: true,
      maxCount: 5,
      maxSize: 10485760
    },
  },
  startScreen: {
    greeting: '',
    prompts: [
      {
        icon: 'circle-question',
        label: 'What is ChatKit?',
        prompt: 'What is ChatKit?'
      }
      // ...and 4 more prompts
    ],
  },
};

// 过滤 playground 配置，只保留白名单内的配置项
const filteredPlaygroundConfig = filterPlaygroundOptions(playgroundConfig);

// 本地配置 - 项目中的固定配置，不会被 playground 配置覆盖
const localConfig: Partial<ChatKitOptions> = {
  header: {
    enabled: true,
    title: {
      enabled: true,
      text: 'Xpert Assistant',
    },
  },
  composer: {
    placeholder: '随便问我点什么吧～～',
    tools: [
      {
        id: 'create-theme',
        label: 'Create Theme',
        shortLabel: 'Theme',
        icon: 'compass',
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
};

// 合并配置: playground 配置覆盖本地配置(仅白名单项)
const chatkitOptions: Partial<ChatKitOptions> = {
  ...localConfig,
  ...filteredPlaygroundConfig,
  // 深度合并 composer (保留 tools，应用 playground 的 attachments)
  composer: {
    ...localConfig.composer,
    ...filteredPlaygroundConfig.composer,
  },
}

export default function App() {
  const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) ?? '';
  const assistantId = (import.meta.env.VITE_CHATKIT_ASSISTANT_ID as string | undefined) ?? '';
  const chatkitTarget = (import.meta.env.VITE_CHATKIT_TARGET as string | undefined) ?? '';

   const setChatkit = useAppStore((state) => state.setChatkit);

  const chatkit = useChatKit({
    ...chatkitOptions,
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
    onClientTool: async ({ name, params, id, tool_call_id }): Promise<ClientToolMessageInput> => {
      console.log(`Client tool invoked: ${name}`, params, id, tool_call_id);
      return {
        tool_call_id: tool_call_id || id,
        name: name,
        status: 'success',
        content: `You invoked the "${name}" tool with parameters: ${JSON.stringify(params)}`,
      };
    },
    onError: (error) => {
      console.error('Failed to create session:', error);
    },
    onReady: () => {
      setChatkit(chatkit);
    },
    onEffect: ({name, data}) => {
      console.log(`Effect triggered: ${name}`, data);
    }
  });

  useEffect(() => {
    console.log('Managed Chatkit Example with React Component');
    console.log('Backend:', backendOrigin || '(using proxy)');
    console.log('Assistant ID:', assistantId);
    console.log('Theme:', chatkitOptions.theme);
  }, [backendOrigin, assistantId]);

  return (
    <div className="flex h-screen">
      <div className="flex-1 p-4 border-r overflow-hidden border-gray-300 bg-white">
        <h1 className="text-2xl font-bold mb-4">Managed Chatkit Example</h1>
        <p className="text-sm text-gray-600 mb-2">Using React Component with Options</p>

        <div className="space-y-2 text-xs text-gray-500">
          <div>
            <strong>Backend:</strong> {backendOrigin || '(proxy)'}
          </div>
          <div>
            <strong>Chatkit URL:</strong>
            <div className="break-all mt-1 p-1 bg-gray-100 rounded text-[10px]">
              {'xxx'}
            </div>
          </div>
          <div>
            <strong>Assistant:</strong> {assistantId || '(default)'}
          </div>
          <div className="pt-2 border-t">
            <strong>Theme Config:</strong>
            <pre className="mt-1 p-2 bg-gray-100 rounded text-[10px] overflow-auto max-h-40">
              {JSON.stringify(chatkitOptions.theme, null, 2)}
            </pre>
          </div>

          <div>
            <button className="mt-2 px-3 py-1 bg-red-500 text-white rounded"
              onClick={() => chatkit.sendUserMessage({ text: 'Hello world!', newThread: true })}
            >
              Trigger Conversation
            </button>
          </div>
        </div>
      </div>

      <ChatKit control={chatkit.control} className="shrink-0 w-[500px]" />
    </div>
  );
}
