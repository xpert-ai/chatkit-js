import type { ChatKitThreadReference } from '@xpert-ai/chatkit-types';
import type { RuntimeCapabilityOption } from './runtime-capabilities';

export const COMPOSER_CAPABILITY_TOKEN_LENGTH = 1;
export const COMPOSER_CAPABILITY_TOKEN = '\uFFFC';
export const COMPOSER_CAPABILITY_SELECTOR =
  '[data-composer-capability-key], [data-composer-thread-key]';

export type ComposerTextPart = {
  type: 'text';
  text: string;
};

export type ComposerCapabilityPart = {
  type: 'capability';
  key: string;
  capability: RuntimeCapabilityOption;
};

export type ComposerThreadPart = {
  type: 'thread';
  key: string;
  reference: ChatKitThreadReference;
};

export type ComposerPart =
  | ComposerTextPart
  | ComposerCapabilityPart
  | ComposerThreadPart;

export function getComposerTokenPartMap(
  parts: ComposerPart[],
): Map<string, ComposerCapabilityPart | ComposerThreadPart> {
  return new Map(
    parts
      .filter(
        (part): part is ComposerCapabilityPart | ComposerThreadPart =>
          part.type !== 'text',
      )
      .map((part) => [part.key, part]),
  );
}

export function getComposerThreadReferences(
  parts: ComposerPart[],
): ChatKitThreadReference[] {
  return parts.flatMap((part) =>
    part.type === 'thread' ? [part.reference] : [],
  );
}

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

    if (part.type !== 'text') {
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

export function findAdjacentComposerToken(
  parts: ComposerPart[],
  offset: number,
  direction: 'before' | 'after',
): ComposerCapabilityPart | ComposerThreadPart | null {
  let cursor = 0;
  for (const part of parts) {
    const length = getComposerPartLength(part);
    const start = cursor;
    const end = cursor + length;
    cursor = end;

    if (part.type === 'text') {
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

type ComposerDomPoint = { node: Node; offset: number };
type ComposerDomSegment = {
  node: Node;
  text: string;
  token?: HTMLElement;
  start: ComposerDomPoint;
  end: ComposerDomPoint;
};

// Chromium's contenteditable creates block children for Enter and multiline
// insertion. Use the same line boundaries for serialization and caret offsets.
function composerDomSegments(root: Node): ComposerDomSegment[] {
  const segments: ComposerDomSegment[] = [];
  const isBlock = (node: Node) =>
    node instanceof HTMLElement &&
    (node.tagName === 'DIV' || node.tagName === 'P');
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      segments.push({
        node,
        text,
        start: { node, offset: 0 },
        end: { node, offset: text.length },
      });
      return;
    }
    if (node instanceof HTMLElement) {
      const parent = node.parentNode ?? root;
      const index = Array.prototype.indexOf.call(parent.childNodes, node);
      if (node.matches(COMPOSER_CAPABILITY_SELECTOR)) {
        segments.push({
          node,
          text: COMPOSER_CAPABILITY_TOKEN,
          token: node,
          start: { node: parent, offset: index },
          end: { node: parent, offset: index + 1 },
        });
        return;
      }
      if (node.tagName === 'BR') {
        if (node.hasAttribute('data-composer-trailing-break')) return;
        // An otherwise empty line contains a browser caret placeholder.
        if (
          parent.childNodes.length === 1 &&
          (parent === root || isBlock(parent))
        )
          return;
        segments.push({
          node,
          text: '\n',
          start: { node: parent, offset: index },
          end: { node: parent, offset: index + 1 },
        });
        return;
      }
    }
    const children = Array.from(node.childNodes);
    children.forEach((child, index) => {
      if (index > 0 && (isBlock(child) || isBlock(children[index - 1]))) {
        segments.push({
          node: child,
          text: '\n',
          start: { node, offset: index },
          end: { node: child, offset: 0 },
        });
      }
      walk(child);
    });
  };
  walk(root);
  return segments;
}

export function readComposerPartsFromElement(
  element: HTMLElement,
  existingCapabilities: ReadonlyMap<
    string,
    ComposerCapabilityPart | ComposerThreadPart
  >,
): ComposerPart[] {
  const parts: ComposerPart[] = [];
  for (const segment of composerDomSegments(element)) {
    if (segment.token) {
      const key =
        segment.token.dataset.composerCapabilityKey ??
        segment.token.dataset.composerThreadKey;
      const part = key ? existingCapabilities.get(key) : undefined;
      if (part) parts.push(part);
    } else {
      parts.push({ type: 'text', text: segment.text.replace(/\u00a0/g, ' ') });
    }
  }
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
  return composerDomSegments(node)
    .map((segment) => segment.text)
    .join('');
}

function findDomPointForComposerOffset(
  root: HTMLElement,
  offset: number,
): ComposerDomPoint {
  let remaining = offset;
  for (const segment of composerDomSegments(root)) {
    if (remaining <= 0) return segment.start;
    if (remaining <= segment.text.length) {
      return segment.node.nodeType === Node.TEXT_NODE
        ? { node: segment.node, offset: remaining }
        : segment.end;
    }
    remaining -= segment.text.length;
  }
  return { node: root, offset: root.childNodes.length };
}
