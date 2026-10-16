import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { MessageList, type MessageListProps } from '../../thread/MessageList';

export type ChatTranscriptProps = {
  hidden?: boolean;
  isInitialComposer?: boolean;
  chatColumnStyle?: CSSProperties;
  before?: ReactNode;
  empty?: ReactNode;
  after?: ReactNode;
  messageList: MessageListProps;
};

export function ChatTranscript({
  hidden,
  isInitialComposer,
  chatColumnStyle,
  before,
  empty,
  messageList,
  after,
}: ChatTranscriptProps) {
  return (
    <div
      hidden={hidden}
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
