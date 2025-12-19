import React, { useState } from 'react';
import { BasicChat, type BasicChatMessage } from '@xpert-ai/chatkit-ui';

export default function App() {
  const [messages, setMessages] = useState<BasicChatMessage[]>([
    {
      id: 'seed-1',
      role: 'assistant',
      content: '你好！这是一个最简 ChatKit UI demo。',
      createdAt: new Date(),
    },
  ]);

  async function handleSendMessage(content: string) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: `收到：${content}`,
      createdAt: new Date(),
    } satisfies BasicChatMessage;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Managed ChatKit Demo</h1>
      <BasicChat
        className="h-[600px]"
        title="Chat"
        placeholder="输入消息..."
        messages={messages}
        onMessagesChange={setMessages}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}

