/** A live reference to a conversation branch, never a client-supplied transcript. */
export type ChatKitThreadReference = {
  type: 'thread';
  id?: string;
  label?: string;
  conversationId: string;
  threadId: string;
};

export function normalizeThreadReference(
  value: unknown,
): ChatKitThreadReference | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('type' in value) ||
    value.type !== 'thread'
  )
    return null;
  if (
    !('conversationId' in value) ||
    !isLocator(value.conversationId) ||
    !('threadId' in value) ||
    !isLocator(value.threadId)
  )
    return null;
  if (
    'label' in value &&
    value.label !== undefined &&
    (typeof value.label !== 'string' || value.label.length > 300)
  )
    return null;
  if ('id' in value && value.id !== undefined && !isLocator(value.id))
    return null;
  return {
    type: 'thread',
    conversationId: value.conversationId.trim(),
    threadId: value.threadId.trim(),
    ...('label' in value && typeof value.label === 'string'
      ? { label: value.label.trim() }
      : {}),
    ...('id' in value && typeof value.id === 'string'
      ? { id: value.id.trim() }
      : {}),
  };
}

function isLocator(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= 128
  );
}
