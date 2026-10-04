import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import { getBubbleCompletionStatus } from '../../../lib/message-presentation';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { getComponentMessageRenderer } from './component-message-renderers';
import { getToolStepData } from './tool-component-group';
import { MessageBubble } from './message-bubble';

export function hasBubbleToolResult(content: TMessageContentComponent) {
  const data = getToolStepData(content);
  const renderer = getComponentMessageRenderer(content, data);
  // Tool artifacts may be model observations, not results intended for the user.
  return Boolean(renderer?.hasBubbleResult?.(content, data));
}

/** Only declared results escape hidden tool chrome; raw logs stay in transcript. */
export function BubbleToolResults({
  items,
  messageStatus,
}: {
  items: TMessageContentComponent[];
  messageStatus?: string;
}) {
  const { t } = useChatkitTranslation();
  return items.map((content, index) => {
    const data = getToolStepData(content);
    const renderer = getComponentMessageRenderer(content, data);
    const Result = renderer?.renderDetails;
    const hasResult = renderer?.hasBubbleResult?.(content, data);
    const failed =
      messageStatus !== 'success' &&
      getBubbleCompletionStatus(data.status) === 'failed';
    if (!(hasResult && Result) && !failed) return null;
    return (
      <MessageBubble
        key={content.id ?? index}
        mode="bubbles"
        kind={failed ? 'status' : 'rich'}
        data-source-block-id={content.id}
      >
        {hasResult && Result && <Result content={content} data={data} />}
        {failed && (
          <p role="status" className="text-sm text-destructive">
            {t('message.bubbles.failed')}
          </p>
        )}
      </MessageBubble>
    );
  });
}
