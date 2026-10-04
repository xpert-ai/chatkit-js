import * as React from 'react';
import {
  CHATKIT_TASK_SUMMARY_OPEN_RESOURCE_EFFECT,
  type ChatTaskSummaryOutput,
  type ChatTaskSummaryResourceReference,
} from '@xpert-ai/chatkit-types';
import { ParentMessengerContext } from '../providers/ParentMessenger';
import { useWorkbench } from '../workbench/context';

/** Delivery cards and summary outputs share MIME routing and the same version identity. */
export function useOpenTaskSummaryResource(
  outputs: ChatTaskSummaryOutput[],
  conversationId?: string,
) {
  const messenger = React.useContext(ParentMessengerContext);
  const { openHtmlArtifact, openFileReview } = useWorkbench();
  return React.useCallback(
    (
      resource: ChatTaskSummaryResourceReference,
      messageId?: string,
      title?: string,
    ) => {
      if (
        (resource.type === 'file_change' ||
          resource.type === 'file_change_set') &&
        openFileReview?.(resource)
      )
        return;
      if (resource.type === 'artifact' && resource.artifactVersionId) {
        const output = outputs.find(
          (item) =>
            item.resource?.type === 'artifact' &&
            item.resource.artifactId === resource.artifactId &&
            item.resource.artifactVersionId === resource.artifactVersionId,
        );
        if (
          output?.mimeType?.split(';')[0].trim().toLowerCase() ===
            'text/html' &&
          openHtmlArtifact?.(
            {
              artifactId: resource.artifactId,
              artifactVersionId: resource.artifactVersionId,
            },
            title ?? output.title,
          )
        )
          return;
      }
      messenger?.sendEvent('public_event', [
        'effect',
        {
          name: CHATKIT_TASK_SUMMARY_OPEN_RESOURCE_EFFECT,
          data: {
            resource,
            messageId,
            title,
            ...(conversationId ? { conversationId } : {}),
          },
        },
      ]);
    },
    [outputs, conversationId, openHtmlArtifact, openFileReview, messenger],
  );
}
