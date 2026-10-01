import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import { parseToolOutputPresentation } from '../../../lib/tool-output-attachments';
import { getBubbleCompletionStatus } from '../../../lib/message-presentation';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { getComponentMessageRenderer } from './component-message-renderers';
import { getToolStepData } from './tool-component-group';
import { ToolOutputAttachments } from './tool-output-attachments';
import { MessageBubble } from './message-bubble';

export function hasBubbleToolResult(content: TMessageContentComponent) {
  const data = getToolStepData(content);
  const renderer = getComponentMessageRenderer(content, data);
  return Boolean(
    parseToolOutputPresentation(data.artifact) ||
    renderer?.hasBubbleResult?.(content, data),
  );
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
    const attachments = parseToolOutputPresentation(data.artifact);
    const renderer = getComponentMessageRenderer(content, data);
    const Result = renderer?.renderDetails;
    const hasResult = renderer?.hasBubbleResult?.(content, data);
    const failed =
      messageStatus !== 'success' &&
      getBubbleCompletionStatus(data.status) === 'failed';
    if (!attachments && !(hasResult && Result) && !failed) return null;
    return (
      <MessageBubble
        key={content.id ?? index}
        mode="bubbles"
        kind={failed ? 'status' : 'rich'}
        data-source-block-id={content.id}
      >
        {attachments && (
          <ToolOutputAttachments
            presentation={attachments}
            toolCallId={content.id}
            executionId={content.executionId}
          />
        )}
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
