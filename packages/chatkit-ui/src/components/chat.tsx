import { ChatView } from './chat/ChatView';
import { SendTransitionProvider } from './chat/messages/SendTransition';
import type { ReactNode } from 'react';
import { useAssistantConversation } from './chat/useAssistantConversation';
import { useGroupConversation } from './group/useGroupConversation';
import {
  GroupConversationProvider,
  useGroupConversationState,
} from './group/GroupConversationProvider';
import type { ChatViewModel } from './chat/ChatViewModel';
import type { ChatProps } from './chat/types';
export type { ChatProps, ChatReferenceRequest } from './chat/types';

type RuntimeProps = ChatProps & {
  children: (view: ChatViewModel) => ReactNode;
};
function AssistantRuntime({ children, ...props }: RuntimeProps) {
  return children(useAssistantConversation(props));
}
function GroupRuntime({ children, ...props }: RuntimeProps) {
  const shared = useGroupConversationState();
  return shared ? (
    <GroupChatRuntime {...props}>{children}</GroupChatRuntime>
  ) : (
    <GroupConversationProvider {...props}>
      <GroupChatRuntime {...props}>{children}</GroupChatRuntime>
    </GroupConversationProvider>
  );
}
function GroupChatRuntime({ children, ...props }: RuntimeProps) {
  return children(useGroupConversation(props));
}

/** Both conversation kinds run through the original Chat rendering path.
 * Only the runtime adapter changes: a group session must never query a private
 * assistant stream with group credentials.
 */
export function Chat(props: ChatProps) {
  const Runtime = props.options?.group ? GroupRuntime : AssistantRuntime;
  return (
    <SendTransitionProvider key={props.options?.group?.id ?? 'assistant'}>
      <Runtime key={props.options?.group?.id ?? 'assistant'} {...props}>
        {(view) => <ChatView view={view} surface={props.surface} />}
      </Runtime>
    </SendTransitionProvider>
  );
}
