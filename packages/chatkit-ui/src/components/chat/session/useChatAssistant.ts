import * as React from 'react';
import {
  extractAssistantAvatar,
  type ChatkitAvatarData,
} from '../../ui/chatkit-avatar';
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
  const [assistantName, setAssistantName] = React.useState<string | null>(null);
  const [assistantAvatar, setAssistantAvatar] =
    React.useState<ChatkitAvatarData | null>(null);

  const resolvedTitle = title ?? t('chat.title');
  const resolvedPlaceholder = placeholder ?? t('chat.placeholder');
  const assistantTitle = assistantName || resolvedTitle;

  // Fetch assistant name from API
  React.useEffect(() => {
    if (missingConfig || !stream.client || !stream.assistantId) {
      setAssistantName(null);
      setAssistantAvatar(null);
      return;
    }

    setAssistantName(null);
    setAssistantAvatar(null);

    let cancelled = false;
    stream.client.assistants
      .get(stream.assistantId)
      .then((assistant) => {
        if (cancelled || !assistant) return;
        const assistantTitle =
          typeof assistant.metadata?.title === 'string' &&
          assistant.metadata.title.trim()
            ? assistant.metadata.title
            : assistant.name;
        setAssistantName(assistantTitle);
        setAssistantAvatar(extractAssistantAvatar(assistant));
      })
      .catch((err) => {
        if (cancelled) return;
        setAssistantAvatar(null);
        console.warn('[Chat] Failed to load assistant info:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [missingConfig, stream.client, stream.assistantId]);
  return { resolvedPlaceholder, assistantTitle, assistantAvatar };
}
