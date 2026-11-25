/** A user submission from an A2UI surface; origin fields are context, not authority. */
export type WidgetAgentAction = {
  name: string;
  messageId: string;
  widgetId: string;
  widgetName?: string;
  surfaceId?: string;
  timestamp: string;
  context: Record<string, unknown>;
};

export const WIDGET_ACTION_PREFIX = '[A2UI action]';
export const WIDGET_ACTION_MAX_LENGTH = 32768;

export function encodeWidgetAgentAction(action: WidgetAgentAction): string {
  return `${WIDGET_ACTION_PREFIX}\n\n${JSON.stringify({ action })}`;
}

/** Recognizes only the complete action envelope in the user-input protocol. */
export function parseWidgetAgentAction(
  input: unknown,
): WidgetAgentAction | null {
  if (
    typeof input !== 'string' ||
    input.length > WIDGET_ACTION_MAX_LENGTH ||
    !input.startsWith(WIDGET_ACTION_PREFIX)
  )
    return null;
  try {
    const value: unknown = JSON.parse(
      input.slice(WIDGET_ACTION_PREFIX.length).trim(),
    );
    if (!isWidgetActionEnvelope(value)) return null;
    return value.action;
  } catch {
    return null;
  }
}

export function findWidgetAgentAction(
  messages: readonly { type?: string; content: unknown }[],
  origin: Pick<WidgetAgentAction, 'messageId' | 'surfaceId'> & {
    widgetId?: string;
  },
): WidgetAgentAction | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.type !== 'human') continue;
    const action = parseWidgetAgentAction(message.content);
    if (
      action?.messageId === origin.messageId &&
      action.widgetId === origin.widgetId &&
      action.surfaceId === origin.surfaceId
    )
      return action;
  }
  return null;
}

function isWidgetActionEnvelope(
  value: unknown,
): value is { action: WidgetAgentAction } {
  if (!value || typeof value !== 'object' || !('action' in value)) return false;
  const action = value.action;
  return Boolean(
    action &&
    typeof action === 'object' &&
    'name' in action &&
    typeof action.name === 'string' &&
    'messageId' in action &&
    typeof action.messageId === 'string' &&
    'widgetId' in action &&
    typeof action.widgetId === 'string' &&
    'timestamp' in action &&
    typeof action.timestamp === 'string' &&
    (!('widgetName' in action) || typeof action.widgetName === 'string') &&
    (!('surfaceId' in action) || typeof action.surfaceId === 'string') &&
    'context' in action &&
    action.context &&
    typeof action.context === 'object' &&
    !Array.isArray(action.context),
  );
}
