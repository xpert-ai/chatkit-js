import type { ReactNode } from 'react';
import { ChatLayout, ChatComposerDock } from './chat/ChatLayout';
import { ChatHeader } from './chat/header/ChatHeader';
import { ChatTranscript } from './chat/messages/ChatTranscript';
import { ChatComposerForm } from './chat/composer/ChatComposerForm';
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
    <Runtime key={props.options?.group?.id ?? 'assistant'} {...props}>
      {(view) => (
        <ChatLayout {...view.layout}>
          <div
            data-window-drag-scope=""
            className={
              view.header.characterPresentation
                ? 'pointer-events-none sticky top-0 z-10 grid w-full min-w-0 shrink-0 grid-cols-1'
                : 'contents'
            }
          >
            <ChatHeader {...view.header} />
            {view.headerPresence}
          </div>
          {view.navigation}
          <ChatTranscript {...view.transcript} />
          {view.afterTranscript}
          <ChatComposerDock
            initial={view.transcript.isInitialComposer}
            style={view.transcript.chatColumnStyle}
          >
            {view.composerBefore}
            <ChatComposerForm {...view.composer} />
            {view.composerAfter}
          </ChatComposerDock>
          {view.footer}
        </ChatLayout>
      )}
    </Runtime>
  );
}
