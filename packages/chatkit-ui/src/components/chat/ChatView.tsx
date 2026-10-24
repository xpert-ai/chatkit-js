import { ChatLayout, ChatComposerDock } from './ChatLayout';
import { ChatHeader } from './header/ChatHeader';
import { ChatTranscript } from './messages/ChatTranscript';
import { ChatComposerForm } from './composer/ChatComposerForm';
import type { ChatViewModel } from './ChatViewModel';
import {
  usePublishWorkbenchChat,
  useWorkbenchChat,
} from '../../workbench/floating-chat/context';

export function ChatView({
  view,
  surface,
}: {
  view: ChatViewModel;
  surface?: 'main' | 'side';
}) {
  const workbench = useWorkbenchChat();
  usePublishWorkbenchChat(surface !== 'side' ? view.workbench : undefined);
  const presentation =
    surface !== 'side' && workbench?.floating ? workbench.mode : undefined;
  const compact = presentation === 'compact' || presentation === 'minimized';
  return (
    <ChatLayout {...view.layout} presentation={presentation}>
      <div
        data-window-drag-scope=""
        hidden={!!presentation}
        className={
          view.header.characterPresentation
            ? 'pointer-events-none sticky top-0 z-10 grid w-full min-w-0 shrink-0 grid-cols-1'
            : 'contents'
        }
      >
        <ChatHeader {...view.header} />
        {view.headerPresence}
      </div>
      {!compact && view.navigation}
      <ChatTranscript {...view.transcript} hidden={compact} />
      {!compact && view.afterTranscript}
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
  );
}
