import type { ChatKitMessagePresentationOptions } from '@xpert-ai/chatkit-types';

/** API boundary: the published TXpertOptions is exposed at Assistant.config.options. */
export function readAssistantMessagePresentation(
  config: unknown,
): ChatKitMessagePresentationOptions | undefined {
  if (!config || typeof config !== 'object' || !('options' in config)) return;
  const options = config.options;
  if (
    !options ||
    typeof options !== 'object' ||
    !('messagePresentation' in options)
  )
    return;
  const presentation = options.messagePresentation;
  if (
    !presentation ||
    typeof presentation !== 'object' ||
    !('mode' in presentation)
  )
    return;
  const mode = presentation.mode;
  if (mode === 'transcript' || mode === 'bubbles') return { mode };
}
