import type { ChatKitReference } from '@xpert-ai/chatkit-types';

export type QuoteSelectionState = {
  reference: ChatKitReference;
  top: number;
  left: number;
};

export function getClosestQuoteContainer(
  node: Node | null,
): HTMLElement | null {
  if (!node) {
    return null;
  }

  const element =
    node instanceof HTMLElement
      ? node
      : node instanceof Text
        ? node.parentElement
        : null;

  return element?.closest('[data-quote-message-id]') ?? null;
}
