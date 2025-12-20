import { EnhancedChat } from "./components/enhanced-chat";

export function App() {
  return (
    <div className="flex h-screen">
      <EnhancedChat
        className="flex-1"
        title="Chat"
        placeholder="输入消息..."
        showAvatar={true}
        showTimestamp={true}
      />
    </div>
  );
}

export default App;