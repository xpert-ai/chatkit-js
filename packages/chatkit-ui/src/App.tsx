import * as React from 'react';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { Chat } from "./components/chat";
import { StreamProvider } from "./providers/Stream";
import { ThemeProvider } from "./providers/Theme";
import { A2UIProvider } from "@a2ui/react";
import { setLanguage } from "./i18n";

export type AppProps = {
  clientSecret?: string;
  options?: ChatKitOptions | null;
};

export function App({ clientSecret = "", options }: AppProps) {
  const apiKey = clientSecret.trim() ? clientSecret : undefined;

  // Extract options
  const theme = options?.theme;
  const locale = options?.locale;

  React.useEffect(() => {
    if (!locale) return;
    setLanguage(locale);
  }, [locale]);

  return (
    <ThemeProvider theme={theme}>
      <div className="flex h-screen">
        <A2UIProvider onAction={(action) => {
          console.log("A2UI Action:", action);
        }}>
          <StreamProvider apiKey={apiKey}>
            <Chat
              className="flex-1"
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
