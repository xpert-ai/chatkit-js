import type { ConversationShareSnapshot } from './share-client';
import { MessageList } from '../thread/MessageList';
import { ReadonlyTranscriptContext } from '../thread/ReadonlyTranscriptContext';

/** Accept only the exported text projection, never live messages or execution metadata. */
export function ReadonlyMessageList({
  messages,
}: Pick<ConversationShareSnapshot, 'messages'>) {
  return (
    <ReadonlyTranscriptContext.Provider value>
      <MessageList
        messages={messages.map((message, index) => ({
          id: `shared-${index}`,
          type: message.role === 'human' ? 'user' : 'assistant',
          content: message.text,
          status: 'success',
        }))}
        showActions={false}
        enableQuotes={false}
      />
    </ReadonlyTranscriptContext.Provider>
  );
}
