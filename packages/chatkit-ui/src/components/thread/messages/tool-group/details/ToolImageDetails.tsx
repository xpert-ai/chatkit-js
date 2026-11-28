import type {
  TMessageContentComponent,
  ToolOutputImageAttachment,
} from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../../../../i18n/useChatkitTranslation';
import { ToolOutputAttachments } from '../../tool-output-attachments';
import { ToolCallDetails } from './ToolCallDetails';
import type { StepStatus } from '../types';

export function ToolImageDetails({
  content,
  images,
  status,
  isThreadPaused,
}: {
  content: TMessageContentComponent;
  images: ToolOutputImageAttachment[];
  status?: StepStatus;
  isThreadPaused?: boolean;
}) {
  const { t } = useChatkitTranslation();
  return (
    <div className="ml-5 mt-2 min-w-0 space-y-2">
      <ToolOutputAttachments
        presentation={{
          type: 'xpert.tool-output',
          version: 1,
          attachments: images,
        }}
        toolCallId={content.id}
        executionId={content.executionId}
      />
      <details className="min-w-0 text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer rounded-chat-item focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t('message.toolGroup.attachments.callDetails')}
        </summary>
        <ToolCallDetails
          content={content}
          status={status}
          isThreadPaused={isThreadPaused}
        />
      </details>
    </div>
  );
}
