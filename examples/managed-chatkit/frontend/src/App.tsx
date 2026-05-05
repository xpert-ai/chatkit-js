import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useChatKit, ChatKit } from '@xpert-ai/chatkit-react';
import type {
  ChatKitOptions,
  ChatKitPetOptions,
  ClientToolMessageInput,
  SupportedLocale,
} from '@xpert-ai/chatkit-types';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './store/useAppStore';
import { getLanguage, setLanguage } from './i18n';

type PetPreset =
  | 'default'
  | 'boba'
  | 'bolt'
  | 'atlas'
  | 'launcher'
  | 'off';

type PetPresetOption = {
  id: PetPreset;
  label: string;
};

const DEFAULT_FRAME_URL = 'http://localhost:5173';
const DEMO_PET_ATLAS_PATH = '/pets/boba/spritesheet.webp';

const PET_PRESETS: PetPresetOption[] = [
  { id: 'default', label: 'pet: true' },
  { id: 'boba', label: 'Boba' },
  { id: 'bolt', label: 'Bolt' },
  { id: 'atlas', label: 'Spritesheet URL' },
  { id: 'launcher', label: 'Pet launcher' },
  { id: 'off', label: 'Off' },
];

function resolveFrameAssetUrl(frameUrl: string, assetPath: string): string {
  const nextFrameUrl = frameUrl.trim() || DEFAULT_FRAME_URL;

  try {
    return new URL(assetPath, nextFrameUrl).toString();
  } catch {
    return assetPath;
  }
}

function buildSpritesheetPet(src: string): ChatKitPetOptions {
  return {
    character: { type: 'sprite-atlas', src },
    position: {
      pin: 'bottom-right',
      draggable: true,
      scale: 0.25,
      persist: true,
    },
  };
}

function buildPetOptions(
  preset: PetPreset,
  frameUrl: string,
): boolean | ChatKitPetOptions | undefined {
  switch (preset) {
    case 'default':
      return true;
    case 'boba':
      return buildSpritesheetPet(
        resolveFrameAssetUrl(frameUrl, '/pets/boba/spritesheet.webp'),
      );
    case 'bolt':
      return buildSpritesheetPet(
        resolveFrameAssetUrl(frameUrl, '/pets/bolt/spritesheet.webp'),
      );
    case 'atlas':
      return buildSpritesheetPet(
        resolveFrameAssetUrl(frameUrl, DEMO_PET_ATLAS_PATH),
      );
    case 'launcher':
      return true;
    case 'off':
      return undefined;
  }
}

function getPetPresetDescription(preset: PetPreset): string {
  switch (preset) {
    case 'default':
      return 'Enable pet: true with the default file-backed Boba pet.';
    case 'boba':
    case 'bolt':
      return 'Use one of the file-backed pets bundled with chatkit-ui.';
    case 'atlas':
      return 'Use a locally hosted spritesheet URL directly.';
    case 'launcher':
      return 'Show only the pet at first; clicking it opens the ChatKit panel.';
    case 'off':
      return 'Disable the pet and keep the default ChatKit behavior.';
  }
}

// Final config
export default function App() {
  const { t, i18n } = useTranslation();
  const [locale, setLocale] = useState<SupportedLocale>(() => getLanguage());
  const xpertApiUrl = (import.meta.env.VITE_XPERTAI_API_URL as string | undefined) ?? '';
  const backendOrigin = (import.meta.env.VITE_CHATKIT_BACKEND as string | undefined) ?? '';
  const assistantId = (import.meta.env.VITE_CHATKIT_XPERT_ID as string | undefined) ?? '';
  const frameUrl =
    (import.meta.env.VITE_CHATKIT_TARGET as string | undefined)?.trim() ||
    DEFAULT_FRAME_URL;

  const setChatkit = useAppStore((state) => state.setChatkit);
  const [threads, setThreads] = useState<string[]>([]);
  const [petPreset, setPetPreset] = useState<PetPreset>('off');
  const petPresetDescription = getPetPresetDescription(petPreset);

  // ============================================================================
  // Playground config - copied from https://chatkit.studio/playground
  // Only whitelisted options take effect: theme, composer, startScreen, api
  // Other options (e.g., threadItemActions.feedback) are automatically filtered out
  // ============================================================================
  const playgroundConfig = useMemo<Partial<ChatKitOptions>>(() => ({
    locale,
    theme: {
      colorScheme: 'light',
      radius: 'pill',
      density: 'normal',
      color: {
        grayscale: {
          hue: 120,
          tint: 6
        },
        accent: {
          primary: '#83e58a',
          level: 2
        }
      },
      typography: {
        baseSize: 16,
        fontFamily: 'Inter, sans-serif',
      }
    },
    composer: {
      attachments: {
        enabled: true,
        maxCount: 5,
        maxSize: 10485760
      },
      tools: [
        {
          id: 'search_docs',
          label: t('tools.searchDocs.label'),
          shortLabel: t('tools.searchDocs.shortLabel'),
          placeholderOverride: t('tools.searchDocs.placeholder'),
          icon: 'book-open',
          pinned: false
        }
        // ...and 1 more tool
      ],
    },
    startScreen: {
      greeting: '',
      prompts: [
        {
          icon: 'circle-question',
          label: t('prompts.whatIsChatKit'),
          prompt: t('prompts.whatIsChatKit')
        }
        // ...and 4 more prompts
      ],
    },
    displayMode: petPreset === 'launcher' ? 'pet' : 'chat',
    pet: buildPetOptions(petPreset, frameUrl),
  }), [frameUrl, locale, petPreset, t, i18n.language]);

  const chatkit = useChatKit({
    ...playgroundConfig,
    frameUrl,
    api: {
      apiUrl: xpertApiUrl,
      xpertId: assistantId,
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
    onThreadChange: ({ threadId }) => {
      if (!threadId) return;
      setThreads((prev) => (prev.includes(threadId) ? prev : [...prev, threadId]));
    },
    onEffect: ({name, data}) => {
      console.log(`Effect triggered: ${name}`, data);
    }
  });

  useEffect(() => {
    console.log('Managed Chatkit Example with React Component');
    console.log('Backend:', backendOrigin || '(using proxy)');
    console.log('Assistant ID:', assistantId);
    console.log('Theme:', playgroundConfig.theme);
  }, [backendOrigin, assistantId, playgroundConfig]);

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLang = event.target.value;
    i18n.changeLanguage(nextLang);
    setLocale(nextLang as SupportedLocale);
    setLanguage(nextLang);
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 p-4 border-r overflow-hidden border-gray-300 bg-white">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-gray-600 mt-1">{t('subtitle')}</p>
          </div>
          <div className="pt-4">
            <strong>Threads:</strong>
            <ul className="mt-2 text-xs list-disc list-inside">
              {threads.length === 0 ? (
                <li className="text-gray-500">(no threads yet)</li>
              ) : (
                threads.map((id) => (
                  <li key={id} className="break-all">
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => {
                        console.log('Switching to thread:', id);
                        chatkit.setThreadId(id).catch((e) => {
                          console.error('Failed to set thread id', e);
                        });
                      }}
                    >
                      {id}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <label className="text-xs text-gray-600 flex flex-col gap-1 min-w-[140px]">
            <span className="font-medium">{t('labels.language')}</span>
            <select
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              value={i18n.language}
              onChange={handleLanguageChange}
            >
              <option value="en-US">English</option>
              <option value="zh-Hans">简体中文</option>
            </select>
          </label>
        </div>

        <div className="space-y-2 text-xs text-gray-500">
          <div>
            <strong>{t('labels.backend')}:</strong> {backendOrigin || t('labels.proxy')}
          </div>
          <div>
            <strong>{t('labels.chatkitUrl')}:</strong>
            <div className="break-all mt-1 p-1 bg-gray-100 rounded text-[10px]">
              {frameUrl || t('labels.unset')}
            </div>
          </div>
          <div>
            <strong>{t('labels.assistant')}:</strong> {assistantId || t('labels.default')}
          </div>
          <div className="pt-2 border-t">
            <strong>Pet:</strong>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PET_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={[
                    'rounded border px-2 py-1 text-[11px] font-medium transition',
                    petPreset === preset.id
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                  onClick={() => setPetPreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-gray-500">
              {petPresetDescription}
            </p>
          </div>
          <div className="pt-2 border-t">
            <strong>{t('labels.themeConfig')}:</strong>
            <pre className="mt-1 p-2 bg-gray-100 rounded text-[10px] overflow-auto max-h-40">
              {JSON.stringify(playgroundConfig.theme, null, 2)}
            </pre>
          </div>

          <div className="space-x-2">
            <button className="mt-2 px-3 py-1 bg-red-500 text-white rounded"
              onClick={() => chatkit.sendUserMessage({ text: t('messages.helloWorld'), newThread: true })}
            >
              {t('buttons.triggerConversation')}
            </button>

            <button className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
              onClick={() => chatkit.sendUserMessage({
                text: 'Test with parameters',
                newThread: true,
                state: {
                  the_name: 'Alice',
                }
              })}
            >
              📤 Send with Params
            </button>
          </div>
        </div>
      </div>

      <ChatKit control={chatkit.control} className="shrink-0 w-[500px]" />
    </div>
  );
}
