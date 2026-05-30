import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ChatKit, useChatKit } from '@xpert-ai/chatkit-react';
import type {
  ChatKitOptions,
  ClientToolMessageInput,
  SupportedLocale,
} from '@xpert-ai/chatkit-types';
import {
  createOfficeBridgeClientToolHandler,
  createWpsWordAdapter,
} from '../office-bridge';
import {
  clearUserApiKeyConfig,
  createProxyChatKitSession,
  createUserApiKeyChatKitSession,
  normalizeUserApiKeyConfig,
  readCompleteUserApiKeyConfig,
  readSessionMode,
  readUserApiKeyConfigDraft,
  saveUserApiKeyConfig,
  type ChatKitSession,
  type ChatKitSessionMode,
  type UserApiKeyChatKitConfig,
} from './session';
import { waitForWpsReady, type WpsReadyState } from './wps-ready';

type SessionFactory = (currentClientSecret?: string | null) => Promise<ChatKitSession>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readLocale(): SupportedLocale {
  const language = navigator.language.toLowerCase();
  return language.startsWith('zh') ? 'zh-Hans' : 'en';
}

type ChatPaneProps = {
  createSession: SessionFactory;
  initialSession: ChatKitSession;
  onConfigure?: () => void;
};

function ChatPane({ createSession, initialSession, onConfigure }: ChatPaneProps) {
  const [session, setSession] = useState(initialSession);
  const [error, setError] = useState<string | null>(null);
  const officeBridgeHandler = useMemo(
    () =>
      createOfficeBridgeClientToolHandler({
        adapter: createWpsWordAdapter(),
      }),
    [],
  );

  const chatkitOptions = useMemo<ChatKitOptions>(
    () => ({
      frameUrl: session.frameUrl,
      locale: readLocale(),
      api: {
        apiUrl: session.apiUrl,
        xpertId: session.xpertId,
        getClientSecret: async (currentClientSecret) => {
          const nextSession = currentClientSecret
            ? await createSession(currentClientSecret)
            : session;
          setSession(nextSession);
          return nextSession.organizationId
            ? {
                secret: nextSession.client_secret,
                organizationId: nextSession.organizationId,
              }
            : nextSession.client_secret;
        },
      },
      theme: {
        colorScheme: 'light',
        radius: 'round',
        density: 'compact',
        typography: {
          baseSize: 14,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        color: {
          accent: {
            primary: '#0f766e',
            level: 1,
          },
        },
      },
      composer: {
        placeholder: 'Ask XpertAI to edit this WPS document...',
        attachments: {
          enabled: true,
        },
      },
      startScreen: {
        greeting: 'WPS Copilot is ready.',
        prompts: [
          {
            icon: 'sparkle',
            label: 'Draft an outline',
            prompt: 'Create a structured outline for this document.',
          },
          {
            icon: 'square-text',
            label: 'Improve selection',
            prompt: 'Rewrite the selected paragraph to be clearer and more concise.',
          },
        ],
      },
      header: {
        enabled: true,
        title: {
          enabled: true,
          text: 'XpertAI WPS Copilot',
        },
      },
      onClientTool: async (call): Promise<ClientToolMessageInput> => {
        setError(null);
        const result = await officeBridgeHandler(call);
        if (result.status === 'error') {
          setError(typeof result.content === 'string' ? result.content : 'Office tool failed.');
        }
        return result;
      },
      onError: (chatkitError: Error) => {
        setError(getErrorMessage(chatkitError));
      },
    }),
    [createSession, officeBridgeHandler, session],
  );

  const chatkit = useChatKit(chatkitOptions);

  return (
    <main className="taskpane">
      {error ? (
        <div className="status-banner error">
          <span>{error}</span>
          {onConfigure ? (
            <button className="link-button" type="button" onClick={onConfigure}>
              Settings
            </button>
          ) : null}
        </div>
      ) : null}
      <ChatKit control={chatkit.control} className="chatkit-shell" />
    </main>
  );
}

type UserApiKeySettingsProps = {
  error?: string | null;
  initialConfig: Partial<UserApiKeyChatKitConfig>;
  isConnecting: boolean;
  onSave: (config: UserApiKeyChatKitConfig) => void;
};

function readInputValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === 'string' ? value : undefined;
}

function UserApiKeySettings({
  error,
  initialConfig,
  isConnecting,
  onSave,
}: UserApiKeySettingsProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      setLocalError(null);
      onSave(
        normalizeUserApiKeyConfig({
          apiUrl: readInputValue(formData, 'apiUrl'),
          apiKey: readInputValue(formData, 'apiKey'),
          xpertId: readInputValue(formData, 'xpertId'),
          frameUrl: readInputValue(formData, 'frameUrl'),
          expiresAfter: Number(readInputValue(formData, 'expiresAfter')),
        }),
      );
    } catch (settingsError) {
      setLocalError(getErrorMessage(settingsError));
    }
  }

  function handleClear() {
    clearUserApiKeyConfig();
    window.location.reload();
  }

  return (
    <main className="taskpane settings">
      <form className="settings-panel" onSubmit={handleSubmit}>
        <div className="settings-header">
          <h1>XpertAI WPS Copilot</h1>
          <p>Use your own XpertAI API key on this device.</p>
        </div>

        {error || localError ? (
          <div className="settings-error">{localError ?? error}</div>
        ) : null}

        <label>
          <span>API URL</span>
          <input
            name="apiUrl"
            required
            defaultValue={initialConfig.apiUrl ?? ''}
            autoComplete="url"
          />
        </label>

        <label>
          <span>API Key</span>
          <input
            name="apiKey"
            required
            type="password"
            defaultValue={initialConfig.apiKey ?? ''}
            autoComplete="off"
          />
        </label>

        <label>
          <span>Xpert ID</span>
          <input
            name="xpertId"
            required
            defaultValue={initialConfig.xpertId ?? ''}
            autoComplete="off"
          />
        </label>

        <label>
          <span>ChatKit Frame URL</span>
          <input
            name="frameUrl"
            required
            defaultValue={initialConfig.frameUrl ?? ''}
            autoComplete="url"
          />
        </label>

        <label>
          <span>Secret TTL Seconds</span>
          <input
            name="expiresAfter"
            inputMode="numeric"
            defaultValue={initialConfig.expiresAfter ?? 600}
          />
        </label>

        <div className="settings-actions">
          <button disabled={isConnecting} type="submit">
            {isConnecting ? 'Connecting...' : 'Save and Connect'}
          </button>
          <button disabled={isConnecting} type="button" onClick={handleClear}>
            Clear
          </button>
        </div>
      </form>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="taskpane centered">
      <div className="status-card">
        <h1>XpertAI WPS Copilot</h1>
        <p>Connecting...</p>
      </div>
    </main>
  );
}

type ErrorStateProps = {
  message: string;
};

function ErrorState({ message }: ErrorStateProps) {
  return (
    <main className="taskpane centered">
      <div className="status-card">
        <h1>XpertAI WPS Copilot</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}

export default function App() {
  const [sessionMode] = useState<ChatKitSessionMode>(() => readSessionMode());
  const [wpsReady, setWpsReady] = useState<WpsReadyState | null>(null);
  const [session, setSession] = useState<ChatKitSession | null>(null);
  const [userConfig, setUserConfig] = useState<UserApiKeyChatKitConfig | null>(
    () => readCompleteUserApiKeyConfig(),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const connectWithUserConfig = useCallback(async (config: UserApiKeyChatKitConfig) => {
    setIsConnecting(true);
    setError(null);
    try {
      const nextSession = await createUserApiKeyChatKitSession(config);
      saveUserApiKeyConfig(config);
      setUserConfig(config);
      setSession(nextSession);
      setSettingsOpen(false);
    } catch (connectionError) {
      setSession(null);
      setSettingsOpen(true);
      setError(getErrorMessage(connectionError));
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    async function initialize() {
      try {
        const readyState = await waitForWpsReady();
        if (disposed) {
          return;
        }
        setWpsReady(readyState);

        if (sessionMode === 'proxy') {
          const chatkitSession = await createProxyChatKitSession();
          if (!disposed) {
            setSession(chatkitSession);
            setIsConnecting(false);
          }
          return;
        }

        const storedUserConfig = readCompleteUserApiKeyConfig();
        setUserConfig(storedUserConfig);
        if (!storedUserConfig) {
          setSettingsOpen(true);
          setIsConnecting(false);
          return;
        }

        await connectWithUserConfig(storedUserConfig);
      } catch (initializationError) {
        if (!disposed) {
          setError(getErrorMessage(initializationError));
          setSettingsOpen(sessionMode === 'user-api-key');
          setIsConnecting(false);
        }
      }
    }

    void initialize();

    return () => {
      disposed = true;
    };
  }, [connectWithUserConfig, sessionMode]);

  const createSession = useCallback<SessionFactory>(
    (currentClientSecret) => {
      if (sessionMode === 'proxy') {
        return createProxyChatKitSession(currentClientSecret);
      }
      if (!userConfig) {
        return Promise.reject(new Error('XPERTAI_API_KEY is not configured.'));
      }
      return createUserApiKeyChatKitSession(userConfig);
    },
    [sessionMode, userConfig],
  );

  if (!wpsReady && !settingsOpen) {
    return error ? <ErrorState message={error} /> : <LoadingState />;
  }

  if (sessionMode === 'user-api-key' && (settingsOpen || !session)) {
    return (
      <UserApiKeySettings
        error={error}
        initialConfig={readUserApiKeyConfigDraft()}
        isConnecting={isConnecting}
        onSave={connectWithUserConfig}
      />
    );
  }

  if (error && !session) {
    return <ErrorState message={error} />;
  }

  if (!session) {
    return <LoadingState />;
  }

  return (
    <ChatPane
      createSession={createSession}
      initialSession={session}
      onConfigure={
        sessionMode === 'user-api-key' ? () => setSettingsOpen(true) : undefined
      }
    />
  );
}
