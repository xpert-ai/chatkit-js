import { parseWidgetAgentAction } from '@xpert-ai/chatkit-types';

export function widgetActionText(content: unknown): string | null {
  const action = parseWidgetAgentAction(content);
  if (!action) return null;
  return Object.entries(action.context)
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
    )
    .join(' · ');
}
