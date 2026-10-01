import { useMemo } from 'react';
import { extractAssistantAvatar } from '../../ui/chatkit-avatar';
import { useAssistantInfo } from '../../../hooks/useAssistantInfo';
import { readAssistantMessagePresentation } from '../../../lib/assistant-message-presentation';
import type { useChatEnvironment } from './useChatEnvironment';

type ChatAssistantOptions = Pick<
  ReturnType<typeof useChatEnvironment>,
  't' | 'missingConfig' | 'stream'
> & {
  title: string | undefined;
  placeholder: string | undefined;
};

export function useChatAssistant({
  title,
  t,
  placeholder,
  missingConfig,
  stream,
}: ChatAssistantOptions) {
  const assistant = useAssistantInfo(
    missingConfig ? null : stream.client,
    stream.assistantId,
  );
  const assistantName =
    typeof assistant?.metadata?.title === 'string' &&
    assistant.metadata.title.trim()
      ? assistant.metadata.title
      : assistant?.name;
  const assistantAvatar = useMemo(
    () => (assistant ? extractAssistantAvatar(assistant) : null),
    [assistant],
  );
  const assistantMessagePresentation = useMemo(
    () => readAssistantMessagePresentation(assistant?.config),
    [assistant],
  );
  const resolvedTitle = title ?? t('chat.title');
  const resolvedPlaceholder = placeholder ?? t('chat.placeholder');
  const assistantTitle = assistantName || resolvedTitle;

  return {
    resolvedPlaceholder,
    assistantTitle,
    assistantAvatar,
    assistantMessagePresentation,
  };
}
