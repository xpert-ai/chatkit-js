import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { Chat } from "./components/chat";
import { StreamProvider } from "./providers/Stream";
import { ThemeProvider } from "./providers/Theme";

export type AppProps = {
  clientSecret?: string;
  options?: ChatKitOptions | null;
};

export function App({ clientSecret = "", options }: AppProps) {
  const apiKey = clientSecret.trim() ? clientSecret : undefined;

  // Extract options
  const theme = options?.theme;
  const composer = options?.composer;
  const startScreen = options?.startScreen;

  return (
    <ThemeProvider theme={theme}>
      <div className="flex h-screen">
        <StreamProvider apiKey={apiKey}>
          <Chat
            className="flex-1"
            title="Chat"
            placeholder={composer?.placeholder ?? "输入消息..."}
            showAvatar={true}
            clientSecret={clientSecret}
            composer={composer}
            startScreen={startScreen}
          />
        </StreamProvider>
      </div>
    </ThemeProvider>
  );
}

export default App;
