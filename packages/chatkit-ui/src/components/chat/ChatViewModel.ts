import type { ComponentProps, ReactNode } from 'react';
import type { ChatLayout } from './ChatLayout';
import type { ChatHeaderProps } from './header/ChatHeader';
import type { ChatTranscriptProps } from './messages/ChatTranscript';
import type { ChatComposerFormProps } from './composer/ChatComposerForm';

/** Conversation runtimes provide data and capabilities; Chat owns all rendering. */
export type ChatViewModel = {
  layout: Omit<ComponentProps<typeof ChatLayout>, 'children'>;
  header: ChatHeaderProps;
  headerPresence?: ReactNode;
  navigation?: ReactNode;
  transcript: ChatTranscriptProps;
  afterTranscript?: ReactNode;
  composer: ChatComposerFormProps;
  composerBefore?: ReactNode;
  composerAfter?: ReactNode;
  footer?: ReactNode;
};
