import type { RuntimeCapabilityOption } from './runtime-capabilities';

export const COMPOSER_CAPABILITY_TOKEN_LENGTH = 1;
export const COMPOSER_CAPABILITY_TOKEN = '\uFFFC';
export const COMPOSER_CAPABILITY_SELECTOR = '[data-composer-capability-key]';

export type ComposerTextPart = {
  type: 'text';
  text: string;
};

export type ComposerCapabilityPart = {
  type: 'capability';
  key: string;
  capability: RuntimeCapabilityOption;
};

export type ComposerPart = ComposerTextPart | ComposerCapabilityPart;

export type ComposerSelectionOffsets = {
  start: number;
  end: number;
};

export function createComposerTextParts(text: string): ComposerPart[] {
  return text ? [{ type: 'text', text }] : [];
}

export function createComposerCapabilityPart(
  capability: RuntimeCapabilityOption,
  key: string,
): ComposerCapabilityPart {
  return {
    type: 'capability',
    key,
    capability,
  };
}

export function getComposerPlainText(parts: ComposerPart[]): string {
  return parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
}

export function getComposerEditingText(parts: ComposerPart[]): string {
  return parts
    .map((part) =>
      part.type === 'text' ? part.text : COMPOSER_CAPABILITY_TOKEN,
    )
    .join('');
}

export function getComposerEditingLength(parts: ComposerPart[]): number {
  return parts.reduce(
    (length, part) => length + getComposerPartLength(part),
    0,
  );
}

export function getComposerPartLength(part: ComposerPart): number {
  return part.type === 'text'
    ? part.text.length
    : COMPOSER_CAPABILITY_TOKEN_LENGTH;
}

export function normalizeComposerParts(parts: ComposerPart[]): ComposerPart[] {
  const normalized: ComposerPart[] = [];
  for (const part of parts) {
    if (part.type === 'text') {
      if (!part.text) {
        continue;
      }
      const previous = normalized[normalized.length - 1];
      if (previous?.type === 'text') {
        previous.text += part.text;
      } else {
        normalized.push({ type: 'text', text: part.text });
      }
      continue;
    }
    normalized.push(part);
  }
  return normalized;
}

export function getComposerCapabilityPartMap(
  parts: ComposerPart[],
): Map<string, ComposerCapabilityPart> {
  const map = new Map<string, ComposerCapabilityPart>();
  for (const part of parts) {
    if (part.type === 'capability') {
      map.set(part.key, part);
    }
  }
  return map;
}

export function getComposerCapabilityKeys(parts: ComposerPart[]): Set<string> {
  const keys = new Set<string>();
  for (const part of parts) {
    if (part.type === 'capability') {
      keys.add(part.key);
    }
  }
  return keys;
}

export function getComposerCapabilitySelectionKeys(
  parts: ComposerPart[],
): Set<string> {
  const keys = new Set<string>();
  for (const part of parts) {
    if (part.type === 'capability') {
      keys.add(getRuntimeCapabilityOptionKey(part.capability));
    }
  }
  return keys;
}

export function getRuntimeCapabilityOptionKey(
  option: Pick<RuntimeCapabilityOption, 'type' | 'id'>,
): string {
  return `${option.type}:${option.id}`;
}

export function sliceComposerParts(
  parts: ComposerPart[],
  start: number,
  end: number,
): ComposerPart[] {
  const result: ComposerPart[] = [];
  let offset = 0;

  for (const part of parts) {
    const length = getComposerPartLength(part);
    const partStart = offset;
    const partEnd = offset + length;
    offset = partEnd;

    if (partEnd <= start) {
      continue;
    }
    if (partStart >= end) {
      break;
    }

    if (part.type === 'capability') {
      if (partStart >= start && partEnd <= end) {
        result.push(part);
      }
      continue;
    }

    const textStart = Math.max(0, start - partStart);
    const textEnd = Math.min(part.text.length, end - partStart);
    const text = part.text.slice(textStart, textEnd);
    if (text) {
      result.push({ type: 'text', text });
    }
  }

  return normalizeComposerParts(result);
}

export function replaceComposerRange(
  parts: ComposerPart[],
  start: number,
  end: number,
  replacement: ComposerPart[],
): ComposerPart[] {
  const safeStart = Math.max(0, Math.min(start, end));
  const safeEnd = Math.max(safeStart, end);
  const length = getComposerEditingLength(parts);
  const before = sliceComposerParts(parts, 0, Math.min(safeStart, length));
  const after = sliceComposerParts(parts, Math.min(safeEnd, length), length);
  return normalizeComposerParts([...before, ...replacement, ...after]);
}

export function removeComposerCapabilityTokens(
  parts: ComposerPart[],
  option: Pick<RuntimeCapabilityOption, 'type' | 'id'>,
): ComposerPart[] {
  return normalizeComposerParts(
    parts.filter(
      (part) =>
        part.type !== 'capability' ||
        part.capability.type !== option.type ||
        part.capability.id !== option.id,
    ),
  );
}

export function findAdjacentComposerCapability(
  parts: ComposerPart[],
  offset: number,
  direction: 'before' | 'after',
): ComposerCapabilityPart | null {
  let cursor = 0;
  for (const part of parts) {
    const length = getComposerPartLength(part);
    const start = cursor;
    const end = cursor + length;
    cursor = end;

    if (part.type !== 'capability') {
      continue;
    }

    if (direction === 'before' && offset === end) {
      return part;
    }
    if (direction === 'after' && offset === start) {
      return part;
    }
  }
  return null;
}

export function readComposerPartsFromElement(
  element: HTMLElement,
  existingCapabilities: Map<string, ComposerCapabilityPart>,
): ComposerPart[] {
  const parts: ComposerPart[] = [];
  const appendText = (text: string) => {
    if (!text) {
      return;
    }
    parts.push({ type: 'text', text: text.replace(/\u00a0/g, ' ') });
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.textContent ?? '');
      return;
    }

    if (!(node instanceof HTMLElement)) {
      node.childNodes.forEach(walk);
      return;
    }

    if (node.matches(COMPOSER_CAPABILITY_SELECTOR)) {
      const key = node.dataset.composerCapabilityKey;
      const capability = key ? existingCapabilities.get(key) : null;
      if (capability) {
        parts.push(capability);
      }
      return;
    }

    if (node.tagName === 'BR') {
      appendText('\n');
      return;
    }

    node.childNodes.forEach(walk);
  };

  element.childNodes.forEach(walk);
  return normalizeComposerParts(parts);
}

export function getComposerSelectionOffsets(
  root: HTMLElement,
): ComposerSelectionOffsets | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (
    !isNodeInside(root, range.startContainer) ||
    !isNodeInside(root, range.endContainer)
  ) {
    return null;
  }

  return {
    start: getComposerPointOffset(
      root,
      range.startContainer,
      range.startOffset,
    ),
    end: getComposerPointOffset(root, range.endContainer, range.endOffset),
  };
}

export function getComposerSelectionOffset(root: HTMLElement): number | null {
  const offsets = getComposerSelectionOffsets(root);
  return offsets ? offsets.end : null;
}

export function setComposerSelectionOffset(
  root: HTMLElement,
  offset: number,
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const range = document.createRange();
  const target = findDomPointForComposerOffset(root, Math.max(0, offset));
  range.setStart(target.node, target.offset);
  range.collapse(true);

  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  root.focus();
  selection.removeAllRanges();
  selection.addRange(range);
}

function isNodeInside(root: HTMLElement, node: Node): boolean {
  return node === root || root.contains(node);
}

function getComposerPointOffset(
  root: HTMLElement,
  node: Node,
  nodeOffset: number,
): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, nodeOffset);
  return getComposerEditingTextFromNode(range.cloneContents()).length;
}

function getComposerEditingTextFromNode(node: Node): string {
  let value = '';

  const walk = (current: Node) => {
    if (current.nodeType === Node.TEXT_NODE) {
      value += current.textContent ?? '';
      return;
    }

    if (
      !(current instanceof HTMLElement) &&
      !(current instanceof DocumentFragment)
    ) {
      current.childNodes.forEach(walk);
      return;
    }

    if (
      current instanceof HTMLElement &&
      current.matches(COMPOSER_CAPABILITY_SELECTOR)
    ) {
      value += COMPOSER_CAPABILITY_TOKEN;
      return;
    }

    if (current instanceof HTMLElement && current.tagName === 'BR') {
      value += '\n';
      return;
    }

    current.childNodes.forEach(walk);
  };

  walk(node);
  return value;
}

function findDomPointForComposerOffset(
  root: HTMLElement,
  offset: number,
): { node: Node; offset: number } {
  let remaining = offset;
  let lastNode: Node = root;
  let lastOffset = root.childNodes.length;

  const walk = (node: Node): { node: Node; offset: number } | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = (node.textContent ?? '').length;
      if (remaining <= textLength) {
        return { node, offset: remaining };
      }
      remaining -= textLength;
      lastNode = node;
      lastOffset = textLength;
      return null;
    }

    if (!(node instanceof HTMLElement)) {
      for (const child of Array.from(node.childNodes)) {
        const result = walk(child);
        if (result) {
          return result;
        }
      }
      return null;
    }

    if (node.matches(COMPOSER_CAPABILITY_SELECTOR)) {
      const parent = node.parentNode ?? root;
      const index = Array.prototype.indexOf.call(parent.childNodes, node);
      if (remaining <= 0) {
        return { node: parent, offset: index };
      }
      if (remaining <= COMPOSER_CAPABILITY_TOKEN_LENGTH) {
        return { node: parent, offset: index + 1 };
      }
      remaining -= COMPOSER_CAPABILITY_TOKEN_LENGTH;
      lastNode = parent;
      lastOffset = index + 1;
      return null;
    }

    if (node.tagName === 'BR') {
      const parent = node.parentNode ?? root;
      const index = Array.prototype.indexOf.call(parent.childNodes, node);
      if (remaining <= 0) {
        return { node: parent, offset: index };
      }
      if (remaining <= 1) {
        return { node: parent, offset: index + 1 };
      }
      remaining -= 1;
      lastNode = parent;
      lastOffset = index + 1;
      return null;
    }

    for (const child of Array.from(node.childNodes)) {
      const result = walk(child);
      if (result) {
        return result;
      }
    }

    lastNode = node;
    lastOffset = node.childNodes.length;
    return null;
  };

  const result = walk(root);
  return result ?? { node: lastNode, offset: lastOffset };
}
