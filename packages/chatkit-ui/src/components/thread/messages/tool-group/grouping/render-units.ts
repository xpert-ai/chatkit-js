import type {
  TMessageComponentWidgetData,
  TMessageContentComplex,
  TMessageContentComponent,
  TMessageContentReasoning,
  TMessageContentText,
} from '@xpert-ai/chatkit-types';
import { isNonTranscriptMessageContent } from '../../../../../lib/message-content-presentation';
import { getComponentMessageRenderer } from '../../component-message-renderers';
import { getToolStepData } from '../status/step-status';
import type { ToolComponentRenderUnit } from '../types';

type PendingToolComponent = {
  item: TMessageContentComponent;
  index: number;
};

function isComponentContent(
  content: TMessageContentComplex,
): content is TMessageContentComponent {
  return content.type === 'component';
}

function isTextContent(
  content: TMessageContentComplex,
): content is TMessageContentText {
  return content.type === 'text';
}

function isReasoningContent(
  content: TMessageContentComplex,
): content is TMessageContentReasoning {
  return content.type === 'reasoning';
}

function isWidgetComponent(
  content: TMessageContentComponent,
): content is TMessageContentComponent<TMessageComponentWidgetData> {
  const data = content.data as Record<string, unknown> | undefined;
  return data?.type === 'Widget' && Array.isArray(data.widgets);
}

function isGroupableStepComponent(
  content: TMessageContentComplex | string | undefined,
): content is TMessageContentComponent {
  if (!content || typeof content === 'string') return false;
  if (isNonTranscriptMessageContent(content)) return false;
  if (!isComponentContent(content) || isWidgetComponent(content)) return false;

  const data = getToolStepData(content);
  const renderer = getComponentMessageRenderer(content, data);
  if (renderer) return renderer.presentation === 'grouped-step';

  return data.category === 'Tool';
}

function isSkippableToolGroupSeparator(
  content: TMessageContentComplex | string | undefined,
) {
  if (typeof content === 'string') return !content.trim();
  if (!content) return true;

  if (isTextContent(content)) {
    return !content.text?.trim();
  }

  if (isReasoningContent(content)) {
    return !content.text?.trim();
  }

  return false;
}

function flushPendingTools(
  units: ToolComponentRenderUnit[],
  pendingTools: PendingToolComponent[],
) {
  if (pendingTools.length === 0) return;

  units.push({
    type: 'tool-group',
    items: pendingTools.map((tool) => tool.item),
    startIndex: pendingTools[0].index,
  });

  pendingTools.length = 0;
}

export function buildToolComponentRenderUnits(
  content: Array<TMessageContentComplex | string | undefined>,
  options?: {
    shouldGroupComponent?: (content: TMessageContentComponent) => boolean;
  },
): ToolComponentRenderUnit[] {
  const units: ToolComponentRenderUnit[] = [];
  const pendingTools: PendingToolComponent[] = [];

  content.forEach((item, index) => {
    if (isNonTranscriptMessageContent(item)) {
      return;
    }

    if (
      isGroupableStepComponent(item) &&
      options?.shouldGroupComponent?.(item) !== false
    ) {
      pendingTools.push({ item, index });
      return;
    }

    if (isSkippableToolGroupSeparator(item)) {
      return;
    }

    if (item === undefined) {
      return;
    }

    flushPendingTools(units, pendingTools);
    units.push({ type: 'item', item, index });
  });

  flushPendingTools(units, pendingTools);
  return units;
}
