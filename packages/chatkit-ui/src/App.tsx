import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { Chat } from "./components/chat";
import { StreamProvider } from "./providers/Stream";
import { ThemeProvider } from "./providers/Theme";
import { A2UIProvider, ThemeProvider as A2UIThemeProvider } from "@a2ui/react";

export type AppProps = {
  clientSecret?: string;
  options?: ChatKitOptions | null;
};

export function App({ clientSecret = "", options }: AppProps) {
  const apiKey = clientSecret.trim() ? clientSecret : undefined;

  // Extract options
  const theme = options?.theme;
  const composer = options?.composer;

  return (
    <ThemeProvider theme={theme}>
      <div className="flex h-screen">
        <A2UIProvider onAction={(action) => {
          console.log("A2UI Action:", action);
        }}>
          <StreamProvider apiKey={apiKey}>
            <Chat
              className="flex-1"
              title="Chat"
              placeholder={composer?.placeholder ?? "输入消息..."}
              showAvatar={true}
              clientSecret={clientSecret}
              options={options ?? {}}
            />
          </StreamProvider>
        </A2UIProvider>
      </div>
    </ThemeProvider>
  );
}

export default App;
