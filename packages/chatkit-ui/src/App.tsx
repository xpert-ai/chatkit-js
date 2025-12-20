import { EnhancedChat } from "./components/enhanced-chat";
import { StreamProvider } from "./providers/Stream";

export function App() {
  return (
    <div className="flex h-screen">
      <StreamProvider>
        <EnhancedChat
          className="flex-1"
          title="Chat"
          placeholder="输入消息..."
          showAvatar={true}
          showTimestamp={true}
          messages={[{
            id: "1",
            type: "human",
            content: "Hello! How can I assist you today?"
          }]}
        />
      </StreamProvider>
    </div>
  );
}

export default App;