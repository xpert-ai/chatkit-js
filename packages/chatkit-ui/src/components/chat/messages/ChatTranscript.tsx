import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { MessageList, type MessageListProps } from '../../thread/MessageList';

export type ChatTranscriptProps = {
  isInitialComposer?: boolean;
  chatColumnStyle?: CSSProperties;
  before?: ReactNode;
  empty?: ReactNode;
  after?: ReactNode;
  messageList: MessageListProps;
};

export function ChatTranscript({
  isInitialComposer,
  chatColumnStyle,
  before,
  empty,
  messageList,
  after,
}: ChatTranscriptProps) {
  return (
    <div
      data-slot="chatkit-chat-content"
      className={cn(
        'mx-auto w-full p-4',
        isInitialComposer ? 'mt-auto shrink-0 pb-0' : 'flex-1',
      )}
      style={chatColumnStyle}
    >
      {before}
      {empty ?? <MessageList {...messageList} />}
      {after}
    </div>
  );
}
