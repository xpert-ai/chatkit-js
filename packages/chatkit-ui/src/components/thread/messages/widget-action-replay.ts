import type { Types } from '@xpert-ai/a2ui-react';
import type { WidgetAgentAction } from '@xpert-ai/chatkit-types';

/** Restore only scalar values explicitly bound by the submitted button in this snapshot. */
export function replayWidgetSubmission(
  messages: Types.ServerToClientMessage[],
  receipt: WidgetAgentAction | null,
): Types.ServerToClientMessage[] {
  if (!receipt) return messages;
  const updates: Types.ServerToClientMessage[] = [];
  for (const message of messages) {
    for (const component of message.surfaceUpdate?.components ?? []) {
      const button = component.component?.Button;
      if (!button || typeof button !== 'object' || !('action' in button))
        continue;
      const action = button.action;
      if (
        !action ||
        typeof action !== 'object' ||
        !('name' in action) ||
        action.name !== receipt.name ||
        !('context' in action) ||
        !Array.isArray(action.context)
      )
        continue;
      for (const binding of action.context) {
        if (
          !binding ||
          typeof binding !== 'object' ||
          !('key' in binding) ||
          typeof binding.key !== 'string' ||
          !('value' in binding)
        )
          continue;
        const source: unknown = binding.value;
        if (
          !source ||
          typeof source !== 'object' ||
          !('path' in source) ||
          typeof source.path !== 'string' ||
          !source.path.startsWith('/')
        )
          continue;
        if (
          source.path
            .split('/')
            .some((key) =>
              ['__proto__', 'prototype', 'constructor'].includes(key),
            )
        )
          continue;
        const value = receipt.context[binding.key];
        let item: Types.ValueMap;
        if (typeof value === 'string') item = { key: '.', valueString: value };
        else if (typeof value === 'number')
          item = { key: '.', valueNumber: value };
        else if (typeof value === 'boolean')
          item = { key: '.', valueBoolean: value };
        else continue;
        updates.push({
          dataModelUpdate: {
            surfaceId: message.surfaceUpdate!.surfaceId,
            path: source.path,
            contents: [item],
          },
        });
      }
    }
  }
  return [...messages, ...updates];
}
