import { Chat } from "./components/chat";
import { StreamProvider } from "./providers/Stream";

export type AppProps = {
  clientSecret?: string;
};

export function App({ clientSecret = "" }: AppProps) {
  const apiKey = clientSecret.trim() ? clientSecret : undefined;

  return (
    <div className="flex h-screen">
      <StreamProvider apiKey={apiKey}>
        <Chat
          className="flex-1"
          title="Chat"
          placeholder="输入消息..."
          showAvatar={true}
          clientSecret={clientSecret}
        />
      </StreamProvider>
    </div>
  );
}

export default App;
