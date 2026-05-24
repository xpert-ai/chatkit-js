import { useEffect, useMemo, useState } from 'react';
import { ChatKit, useChatKit } from '@xpert-ai/chatkit-react';
import type {
  ChatKitOptions,
  ClientToolMessageInput,
  SupportedLocale,
} from '@xpert-ai/chatkit-types';
import {
  createOfficeBridgeClientToolHandler,
  createWordOfficeAdapter,
} from '../office-bridge';
import { createChatKitSession, type ChatKitSession } from './session';
import { waitForOfficeReady, type OfficeReadyState } from './office-ready';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readLocale(): SupportedLocale {
  const language = navigator.language.toLowerCase();
  return language.startsWith('zh') ? 'zh-Hans' : 'en';
}

type ChatPaneProps = {
  initialSession: ChatKitSession;
};

function ChatPane({ initialSession }: ChatPaneProps) {
  const [session, setSession] = useState(initialSession);
  const [error, setError] = useState<string | null>(null);
  const officeBridgeHandler = useMemo(
    () =>
      createOfficeBridgeClientToolHandler({
        adapter: createWordOfficeAdapter(),
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
            ? await createChatKitSession(currentClientSecret)
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
        placeholder: 'Ask XpertAI to edit this document...',
        attachments: {
          enabled: true,
        },
      },
      startScreen: {
        greeting: 'Word Copilot is ready.',
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
          text: 'XpertAI Word Copilot',
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
    [officeBridgeHandler, session],
  );

  const chatkit = useChatKit(chatkitOptions);

  return (
    <main className="taskpane">
      {error ? <div className="status-banner error">{error}</div> : null}
      <ChatKit control={chatkit.control} className="chatkit-shell" />
    </main>
  );
}

export default function App() {
  const [officeReady, setOfficeReady] = useState<OfficeReadyState | null>(null);
  const [session, setSession] = useState<ChatKitSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    async function initialize() {
      try {
        const [readyState, chatkitSession] = await Promise.all([
          waitForOfficeReady(),
          createChatKitSession(),
        ]);

        if (!disposed) {
          setOfficeReady(readyState);
          setSession(chatkitSession);
        }
      } catch (initializationError) {
        if (!disposed) {
          setError(getErrorMessage(initializationError));
        }
      }
    }

    void initialize();

    return () => {
      disposed = true;
    };
  }, []);

  if (error) {
    return (
      <main className="taskpane centered">
        <div className="status-card">
          <h1>XpertAI Word Copilot</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!officeReady || !session) {
    return (
      <main className="taskpane centered">
        <div className="status-card">
          <h1>XpertAI Word Copilot</h1>
          <p>Connecting...</p>
        </div>
      </main>
    );
  }

  return <ChatPane initialSession={session} />;
}
