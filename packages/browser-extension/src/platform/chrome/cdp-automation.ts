import type { ClientToolMessageInput } from '@xpert-ai/chatkit-types';
import {
  HOST_PAGE_AUTOMATION_TOOL_NAMES,
  type HostPageAutomationClientToolCall,
} from 'packages/host-automation/src';
import { showHostAutomationEffect } from '../../visual-effect';

export type ChromeDebuggee = {
  tabId: number;
};

export type ChromeDebuggerApi = {
  attach: (target: ChromeDebuggee, requiredVersion: string) => Promise<void>;
  detach: (target: ChromeDebuggee) => Promise<void>;
  sendCommand: (
    target: ChromeDebuggee,
    method: string,
    commandParams?: Record<string, unknown>,
  ) => Promise<unknown>;
};

export type ChromeCdpAutomationApi = {
  debugger?: ChromeDebuggerApi;
};

type CdpAutomationTab = {
  id: number;
  url?: string;
};

type CdpRuntimeEvaluation = {
  result?: {
    value?: unknown;
    unserializableValue?: string;
    description?: string;
  };
  exceptionDetails?: {
    text?: string;
    exception?: {
      description?: string;
      value?: unknown;
    };
  };
};

type CdpAxTree = {
  nodes?: Array<{
    nodeId?: string;
    backendDOMNodeId?: number;
    role?: { value?: unknown };
    name?: { value?: unknown };
    value?: { value?: unknown };
    disabled?: { value?: unknown };
    checked?: { value?: unknown };
    expanded?: { value?: unknown };
    focused?: { value?: unknown };
  }>;
};

type CdpResolvedNode = {
  object?: {
    objectId?: unknown;
  };
};

type ViewportSize = {
  width: number;
  height: number;
};

type ScrollOffset = {
  x: number;
  y: number;
};

type ScreenshotCoordinateSpace = 'viewport-css-px';

type ScreenshotMetadata = {
  viewport?: ViewportSize;
  imageSize?: ViewportSize;
  devicePixelRatio?: number;
  scroll?: ScrollOffset;
  coordinateSpace: ScreenshotCoordinateSpace;
};

type HitTestInfo = {
  coordinateSpace: ScreenshotCoordinateSpace;
  hitTarget?: unknown;
  hitStack: unknown[];
};

type CdpResolvedPoint = {
  point: { x: number; y: number };
  target?: unknown;
  requested?: unknown;
  actionability?: unknown;
};

const CDP_PROTOCOL_VERSION = '1.3';
const HOST_PAGE_TOOL_NAME_SET = new Set<string>(
  HOST_PAGE_AUTOMATION_TOOL_NAMES,
);

type HostPageScreenshotArtifact = ScreenshotMetadata & {
  type: 'host_page_screenshot';
  mimeType: 'image/png' | 'image/jpeg';
  data: string;
};

function normalizeParams(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readParamRef(params: Record<string, unknown>, key: string) {
  const value = params[key];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function createToolMessage(
  call: HostPageAutomationClientToolCall,
  status: 'success' | 'error',
  content: unknown,
  artifact?: unknown,
): ClientToolMessageInput {
  return {
    tool_call_id: call.tool_call_id ?? call.id,
    name: call.name,
    status,
    content: JSON.stringify(content),
    ...(artifact === undefined ? {} : { artifact }),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function getObjectField(
  value: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const field = (value as Record<string, unknown>)[key];
  return field && typeof field === 'object' && !Array.isArray(field)
    ? (field as Record<string, unknown>)
    : undefined;
}

function getNumberField(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return getFiniteNumber((value as Record<string, unknown>)[key]);
}

function createScreenshotToolContent(result: unknown): {
  content: unknown;
  artifact?: HostPageScreenshotArtifact;
} {
  const record =
    result && typeof result === 'object' && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : {};
  const mimeType =
    record.mimeType === 'image/png' || record.mimeType === 'image/jpeg'
      ? record.mimeType
      : undefined;
  const data = typeof record.data === 'string' ? record.data : '';
  const metadata: ScreenshotMetadata = {
    viewport: getViewportSize(record.viewport),
    imageSize: getViewportSize(record.imageSize),
    devicePixelRatio: getFiniteNumber(record.devicePixelRatio),
    scroll: getScrollOffset(record.scroll),
    coordinateSpace: 'viewport-css-px',
  };
  const resultContent = {
    mimeType,
    dataLength: data.length,
    ...(metadata.viewport ? { viewport: metadata.viewport } : {}),
    ...(metadata.imageSize ? { imageSize: metadata.imageSize } : {}),
    ...(metadata.devicePixelRatio === undefined
      ? {}
      : { devicePixelRatio: metadata.devicePixelRatio }),
    ...(metadata.scroll ? { scroll: metadata.scroll } : {}),
    coordinateSpace: metadata.coordinateSpace,
  };

  if (!mimeType || !data) {
    return {
      content: {
        ok: true,
        result: resultContent,
      },
    };
  }

  return {
    content: {
      ok: true,
      result: resultContent,
    },
    artifact: {
      type: 'host_page_screenshot',
      mimeType,
      data,
      ...(metadata.viewport ? { viewport: metadata.viewport } : {}),
      ...(metadata.imageSize ? { imageSize: metadata.imageSize } : {}),
      ...(metadata.devicePixelRatio === undefined
        ? {}
        : { devicePixelRatio: metadata.devicePixelRatio }),
      ...(metadata.scroll ? { scroll: metadata.scroll } : {}),
      coordinateSpace: metadata.coordinateSpace,
    },
  };
}

function getViewportSize(value: unknown): ViewportSize | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const width = getNumberField(value, 'width');
  const height = getNumberField(value, 'height');
  return width !== undefined && height !== undefined
    ? { width, height }
    : undefined;
}

function getScrollOffset(value: unknown): ScrollOffset | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const x = getNumberField(value, 'x');
  const y = getNumberField(value, 'y');
  return x !== undefined && y !== undefined ? { x, y } : undefined;
}

function ensureDebugger(api: ChromeCdpAutomationApi): ChromeDebuggerApi {
  if (!api.debugger) {
    throw new Error('Chrome debugger API is not available.');
  }

  return api.debugger;
}

async function withDebuggerSession<T>(
  api: ChromeCdpAutomationApi,
  tabId: number,
  run: (sendCommand: ChromeDebuggerApi['sendCommand']) => Promise<T>,
): Promise<T> {
  const debuggerApi = ensureDebugger(api);
  const target = { tabId };
  await debuggerApi.attach(target, CDP_PROTOCOL_VERSION);

  try {
    return await run((debuggee, method, commandParams) =>
      debuggerApi.sendCommand(debuggee, method, commandParams),
    );
  } finally {
    await debuggerApi.detach(target).catch(() => undefined);
  }
}

async function sendCdpCommand(
  sendCommand: ChromeDebuggerApi['sendCommand'],
  tabId: number,
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  return sendCommand({ tabId }, method, params);
}

function getEvaluationValue(value: unknown): unknown {
  const evaluation = value as CdpRuntimeEvaluation;
  if (evaluation.exceptionDetails) {
    const exception = evaluation.exceptionDetails.exception;
    throw new Error(
      typeof exception?.value === 'string'
        ? exception.value
        : (exception?.description ??
            evaluation.exceptionDetails.text ??
            'CDP Runtime.evaluate failed.'),
    );
  }

  return evaluation.result?.value;
}

async function evaluatePageScript(
  sendCommand: ChromeDebuggerApi['sendCommand'],
  tabId: number,
  script: (...args: unknown[]) => unknown,
  args: unknown[] = [],
  dependencies: Array<(...args: unknown[]) => unknown> = [],
): Promise<unknown> {
  const dependencySource = dependencies
    .map((dependency) => dependency.toString())
    .join('; ');
  const expression = `${dependencySource ? `${dependencySource}; ` : ''}${pageResolveTargetScript.toString()}; (${script.toString()})(...${JSON.stringify(args)})`;
  const evaluation = await sendCdpCommand(
    sendCommand,
    tabId,
    'Runtime.evaluate',
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    },
  );
  return getEvaluationValue(evaluation);
}

function readStringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function summarizeAxTree(value: unknown) {
  const tree = value as CdpAxTree;
  return (tree.nodes ?? [])
    .filter(
      (node) =>
        readStringField(node.role?.value) || readStringField(node.name?.value),
    )
    .slice(0, 120)
    .map((node) => ({
      axRef: node.nodeId,
      backendDOMNodeId: node.backendDOMNodeId,
      role: readStringField(node.role?.value),
      name: readStringField(node.name?.value),
      value: readStringField(node.value?.value),
      disabled: node.disabled?.value === true,
      checked:
        typeof node.checked?.value === 'boolean'
          ? node.checked.value
          : readStringField(node.checked?.value),
      expanded:
        typeof node.expanded?.value === 'boolean'
          ? node.expanded.value
          : undefined,
      focused: node.focused?.value === true,
    }));
}

function summarizeDomSnapshot(value: unknown) {
  const snapshot = value as {
    documents?: unknown[];
    strings?: unknown[];
    errors?: unknown[];
  };
  return {
    documents: snapshot.documents?.length ?? 0,
    strings: snapshot.strings?.length ?? 0,
    errors: snapshot.errors?.length ?? 0,
  };
}

function decodeBase64Bytes(value: string): Uint8Array | undefined {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return undefined;
  }
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) + bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function parsePngSize(bytes: Uint8Array): ViewportSize | undefined {
  const hasPngHeader =
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[12] === 0x49 &&
    bytes[13] === 0x48 &&
    bytes[14] === 0x44 &&
    bytes[15] === 0x52;
  if (!hasPngHeader) {
    return undefined;
  }

  return {
    width: readUint32(bytes, 16),
    height: readUint32(bytes, 20),
  };
}

function parseJpegSize(bytes: Uint8Array): ViewportSize | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return undefined;
  }

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const segmentLength = readUint16(bytes, offset + 2);
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      return {
        height: readUint16(bytes, offset + 5),
        width: readUint16(bytes, offset + 7),
      };
    }

    if (segmentLength < 2) {
      return undefined;
    }
    offset += 2 + segmentLength;
  }

  return undefined;
}

function parseImageSize(
  data: string,
  mimeType: 'image/png' | 'image/jpeg',
): ViewportSize | undefined {
  const bytes = decodeBase64Bytes(data);
  if (!bytes) {
    return undefined;
  }

  return mimeType === 'image/png' ? parsePngSize(bytes) : parseJpegSize(bytes);
}

function readViewportFromLayoutMetrics(
  value: unknown,
): ViewportSize | undefined {
  const visualViewport = getObjectField(value, 'visualViewport');
  const layoutViewport = getObjectField(value, 'layoutViewport');
  const viewport = visualViewport ?? layoutViewport;
  if (!viewport) {
    return undefined;
  }

  const width = getNumberField(viewport, 'clientWidth');
  const height = getNumberField(viewport, 'clientHeight');
  return width !== undefined && height !== undefined
    ? { width, height }
    : undefined;
}

function pageReadableContentScript(rawArgs: unknown) {
  type ReadableField = { name: string; value: string };
  type ReadableBlock = {
    blockId?: string;
    type: string;
    heading?: string;
    level?: number;
    text?: string;
    fields?: ReadableField[];
    items?: string[];
    headers?: string[];
    rows?: string[][];
    rect?: { x: number; y: number; width: number; height: number };
    preview?: string[];
    itemCount?: number;
    chars?: number;
    truncated?: boolean;
    readHint?: { tool: 'host_page_read'; args: { blockId: string } };
  };
  type ReadableContent = {
    blocks: ReadableBlock[];
    outline?: Array<{
      index: number;
      blockId?: string;
      type: string;
      heading?: string;
      level?: number;
      itemCount?: number;
      chars?: number;
      truncated?: boolean;
    }>;
    suggestedReads?: Array<{
      blockId?: string;
      type: string;
      heading?: string;
      reason: string;
      args: { blockId?: string; pageSize?: number };
    }>;
    totalBlocks: number;
    truncated: boolean;
    coverage: {
      status: 'complete' | 'partial';
      visibleTextCaptured: boolean;
      truncatedBlocks: number;
      collapsedSections: number;
      crossOriginFrames: number;
      virtualizedListsDetected: number;
      visualOnlyRegions: number;
    };
    warnings?: string[];
  };

  const params =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as {
          mode?: string;
          blockId?: string;
          query?: string;
          page?: number;
          pageSize?: number;
          maxChars?: number;
        })
      : {};
  const MAX_BLOCKS = 80;
  const MAX_SUGGESTED_READS = 12;
  const MAX_PREVIEW_ITEMS = 2;
  const MAX_BLOCK_TEXT_CHARS = 4_000;
  const MAX_TEXT_CHARS = 600;
  const MAX_ITEMS = 80;
  const MAX_TABLE_ROWS = 80;
  const MAX_TABLE_COLUMNS = 12;
  const normalizeText = (value: string | null | undefined) =>
    (value ?? '').replace(/\s+/g, ' ').trim();
  const truncateText = (value: string, maxChars = MAX_TEXT_CHARS) =>
    value.length > maxChars
      ? `${value.slice(0, maxChars)}... [truncated ${value.length - maxChars} chars]`
      : value;
  const truncateOptionalText = (value: string | undefined, maxChars = MAX_TEXT_CHARS) =>
    value ? truncateText(value, maxChars) : undefined;
  const getElementText = (element: Element) => {
    const text = normalizeText(element.textContent);
    return text ? truncateText(text) : undefined;
  };
  const getOwnText = (element: Element) => {
    const text = normalizeText(
      Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? '')
        .join(' '),
    );
    return text ? truncateText(text) : undefined;
  };
  const isVisibleElement = (element: Element) => {
    const view = element.ownerDocument.defaultView ?? window;
    if (
      !(element instanceof view.HTMLElement) &&
      !(element instanceof view.SVGElement)
    ) {
      return false;
    }
    if (element instanceof view.HTMLElement && element.hidden) return false;
    const style = view.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const getRect = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  };
  const findPreviousHeading = (element: Element) => {
    let current: Element | null = element;
    while (current) {
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.matches('h1,h2,h3,h4,h5,h6,[role="heading"]')) {
          return getElementText(sibling);
        }
        const nested = sibling.querySelector(
          'h1,h2,h3,h4,h5,h6,[role="heading"]',
        );
        if (nested) return getElementText(nested);
        sibling = sibling.previousElementSibling;
      }
      current = current.parentElement;
    }
    return undefined;
  };
  const collectTextParts = (element: Element): string[] => {
    const directParts = Array.from(element.children)
      .map((child) => getOwnText(child) ?? getElementText(child))
      .filter((text): text is string => Boolean(text));
    if (directParts.length > 1) return directParts;
    if (element.children.length === 1) {
      return collectTextParts(element.children[0]);
    }
    return directParts;
  };
  const getKeyValueField = (element: Element) => {
    if (
      Array.from(element.children).some(
        (child) => collectTextParts(child).length === 2,
      )
    ) {
      return undefined;
    }
    const parts = collectTextParts(element);
    if (parts.length !== 2) return undefined;
    const [name, value] = parts;
    if (!name || !value || name === value || name.length > 120) {
      return undefined;
    }
    return { name, value };
  };
  const buildPreview = (block: ReadableBlock) => {
    if (block.fields) {
      return block.fields
        .slice(0, MAX_PREVIEW_ITEMS)
        .map((field) => `${field.name}: ${field.value}`);
    }
    if (block.items) return block.items.slice(0, MAX_PREVIEW_ITEMS);
    if (block.rows) {
      return block.rows
        .slice(0, MAX_PREVIEW_ITEMS)
        .map((row) => row.join(' | '));
    }
    return block.text ? [block.text] : [];
  };
  const getItemCount = (block: ReadableBlock) => {
    if (block.fields) return block.fields.length;
    if (block.items) return block.items.length;
    if (block.rows) return block.rows.length;
    return block.text ? 1 : 0;
  };
  const getCharCount = (block: ReadableBlock) =>
    [
      block.heading,
      block.text,
      ...(block.items ?? []),
      ...(block.fields ?? []).flatMap((field) => [field.name, field.value]),
      ...(block.headers ?? []),
      ...(block.rows ?? []).flat(),
    ].reduce((total, text) => total + (text?.length ?? 0), 0);
  const finalizeBlocks = (drafts: ReadableBlock[]) =>
    drafts.slice(0, MAX_BLOCKS).map((block, index) => {
      const chars = getCharCount(block);
      const blockId = `b${index + 1}`;
      return {
        ...block,
        blockId,
        preview: buildPreview(block),
        itemCount: getItemCount(block),
        chars,
        truncated: chars > MAX_BLOCK_TEXT_CHARS,
        readHint: {
          tool: 'host_page_read' as const,
          args: { blockId },
        },
      };
    });
  const createOutline = (blocks: ReadableBlock[]) =>
    blocks.map((block, index) => ({
      index,
      blockId: block.blockId,
      type: block.type,
      heading: block.heading,
      level: block.level,
      itemCount: block.itemCount,
      chars: block.chars,
      truncated: block.truncated,
    }));
  const getSuggestedReadReason = (block: ReadableBlock) => {
    if (block.truncated) return 'block_truncated';
    if (block.type === 'keyValueList') return 'structured_fields';
    if (block.type === 'table') return 'structured_table';
    if ((block.itemCount ?? 0) > MAX_PREVIEW_ITEMS) return 'preview_incomplete';
    return 'long_readable_block';
  };
  const getSuggestedReadScore = (block: ReadableBlock) => {
    const typeScore =
      block.type === 'keyValueList'
        ? 100
        : block.type === 'table'
          ? 90
          : block.type === 'list'
            ? 80
            : block.type === 'paragraph'
              ? 50
              : 10;
    return (
      typeScore +
      (block.truncated ? 40 : 0) +
      Math.min(block.itemCount ?? 0, 20) +
      Math.min(Math.floor((block.chars ?? 0) / 400), 20)
    );
  };
  const createSuggestedReads = (blocks: ReadableBlock[]) =>
    blocks
      .filter(
        (block) =>
          block.type !== 'heading' &&
          (block.truncated ||
            (block.itemCount ?? 0) > MAX_PREVIEW_ITEMS ||
            (block.chars ?? 0) > MAX_TEXT_CHARS),
      )
      .map((block, index) => ({
        block,
        index,
        score: getSuggestedReadScore(block),
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, MAX_SUGGESTED_READS)
      .sort((left, right) => left.index - right.index)
      .map(({ block }) => ({
        blockId: block.blockId,
        type: block.type,
        heading: block.heading,
        reason: getSuggestedReadReason(block),
        args: {
          blockId: block.blockId,
          pageSize:
            block.fields || block.items || block.rows
              ? Math.min(20, Math.max(1, block.itemCount ?? 1))
              : undefined,
        },
      }));
  const createReadableContentIndex = (
    readableContent: ReadableContent,
  ): ReadableContent => ({
    ...readableContent,
    outline: createOutline(readableContent.blocks),
    suggestedReads: createSuggestedReads(readableContent.blocks),
    blocks: readableContent.blocks.map((block) => ({
      blockId: block.blockId,
      type: block.type,
      heading: block.heading,
      level: block.level,
      preview: block.preview,
      itemCount: block.itemCount,
      chars: block.chars,
      truncated: block.truncated,
      rect: block.rect,
      readHint: block.readHint,
    })),
  });
  const addKeyValueLists = (root: Element, blocks: ReadableBlock[]) => {
    const fields: Array<ReadableField & { element: Element }> = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const element = node as Element;
      if (isVisibleElement(element)) {
        const field = getKeyValueField(element);
        if (field) fields.push({ ...field, element });
      }
      node = walker.nextNode();
    }
    if (fields.length === 0) return;
    blocks.push({
      type: 'keyValueList',
      heading: findPreviousHeading(fields[0].element),
      fields: fields
        .slice(0, MAX_ITEMS)
        .map(({ name, value }) => ({ name, value })),
      rect: getRect(fields[0].element),
    });
  };
  const addLists = (root: Element, blocks: ReadableBlock[]) => {
    for (const list of Array.from(
      root.querySelectorAll('ul,ol,[role="list"]'),
    )) {
      if (!isVisibleElement(list)) continue;
      const items = Array.from(list.children)
        .map((child) => getElementText(child))
        .filter((text): text is string => Boolean(text))
        .slice(0, MAX_ITEMS);
      if (items.length === 0) continue;
      blocks.push({
        type: 'list',
        heading: findPreviousHeading(list),
        items,
        rect: getRect(list),
      });
    }
  };
  const addTables = (root: Element, blocks: ReadableBlock[]) => {
    for (const table of Array.from(
      root.querySelectorAll('table,[role="table"],[role="grid"]'),
    )) {
      if (!isVisibleElement(table)) continue;
      const rows = Array.from(table.querySelectorAll('tr,[role="row"]'))
        .map((row) =>
          Array.from(
            row.querySelectorAll(
              'th,td,[role="columnheader"],[role="cell"],[role="gridcell"]',
            ),
          )
            .map((cell) => getElementText(cell))
            .filter((text): text is string => Boolean(text))
            .slice(0, MAX_TABLE_COLUMNS),
        )
        .filter((row) => row.length > 0)
        .slice(0, MAX_TABLE_ROWS);
      if (rows.length === 0) continue;
      const headers = rows[0]?.every((cell) => cell.length <= 120)
        ? rows[0]
        : undefined;
      blocks.push({
        type: 'table',
        heading: findPreviousHeading(table),
        headers,
        rows: headers ? rows.slice(1) : rows,
        rect: getRect(table),
      });
    }
  };
  const addTextBlocks = (root: Element, blocks: ReadableBlock[]) => {
    const selector = 'h1,h2,h3,h4,h5,h6,[role="heading"],p,article,section';
    for (const element of Array.from(root.querySelectorAll(selector))) {
      if (blocks.length >= MAX_BLOCKS) break;
      if (!isVisibleElement(element)) continue;
      const tag = element.tagName.toLowerCase();
      const text = getOwnText(element) ?? getElementText(element);
      if (!text) continue;
      if (tag.match(/^h[1-6]$/) || element.getAttribute('role') === 'heading') {
        const level = tag.match(/^h[1-6]$/)
          ? Number(tag.slice(1))
          : Number(element.getAttribute('aria-level') ?? 0) || 2;
        blocks.push({
          type: 'heading',
          level,
          text,
          rect: getRect(element),
        });
      } else if (text.length >= 24) {
        blocks.push({
          type: 'paragraph',
          text,
          rect: getRect(element),
        });
      }
    }
  };
  const getCollapsedSectionCount = (root: Element) =>
    root.querySelectorAll(
      '[aria-expanded="false"],[data-expanded="false"],details:not([open]),[hidden]',
    ).length;
  const getCrossOriginFrameCount = (root: Element) =>
    Array.from(root.querySelectorAll('iframe')).filter((frame) => {
      try {
        return !(frame as HTMLIFrameElement).contentDocument;
      } catch {
        return true;
      }
    }).length;
  const extract = (): ReadableContent => {
    const start = document.body ?? document.documentElement;
    if (!start) {
      return {
        blocks: [],
        totalBlocks: 0,
        truncated: false,
        coverage: {
          status: 'complete',
          visibleTextCaptured: false,
          truncatedBlocks: 0,
          collapsedSections: 0,
          crossOriginFrames: 0,
          virtualizedListsDetected: 0,
          visualOnlyRegions: 0,
        },
      };
    }
    const drafts: ReadableBlock[] = [];
    addKeyValueLists(start, drafts);
    addLists(start, drafts);
    addTables(start, drafts);
    addTextBlocks(start, drafts);
    const blocks = finalizeBlocks(drafts);
    const truncatedBlocks = blocks.filter((block) => block.truncated).length;
    const collapsedSections = getCollapsedSectionCount(start);
    const crossOriginFrames = getCrossOriginFrameCount(start);
    const partial =
      drafts.length > blocks.length ||
      truncatedBlocks > 0 ||
      collapsedSections > 0 ||
      crossOriginFrames > 0;
    const warnings: string[] = [];
    if (collapsedSections > 0) {
      warnings.push('Some content is inside collapsed sections.');
    }
    if (crossOriginFrames > 0) {
      warnings.push('Some frame content could not be read from DOM.');
    }
    return {
      blocks,
      totalBlocks: drafts.length,
      truncated: drafts.length > blocks.length || truncatedBlocks > 0,
      coverage: {
        status: partial ? 'partial' : 'complete',
        visibleTextCaptured: blocks.length > 0,
        truncatedBlocks,
        collapsedSections,
        crossOriginFrames,
        virtualizedListsDetected: 0,
        visualOnlyRegions: 0,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  };
  const pageBounds = (total: number, page: number, pageSize: number) => {
    const safePageSize = Math.max(1, Math.min(100, Math.floor(pageSize)));
    const pageCount = Math.max(1, Math.ceil(total / safePageSize));
    const safePage = Math.max(1, Math.min(pageCount, Math.floor(page)));
    const start = (safePage - 1) * safePageSize;
    return {
      page: safePage,
      pageSize: safePageSize,
      pageCount,
      start,
      end: Math.min(total, start + safePageSize),
    };
  };
  const getSerializedLength = (value: unknown) => JSON.stringify(value).length;
  const getStringField = (value: Record<string, unknown>, key: string) => {
    const field = value[key];
    return typeof field === 'string' && field.trim() ? field : undefined;
  };
  const getNumberField = (value: Record<string, unknown>, key: string) => {
    const field = value[key];
    return typeof field === 'number' && Number.isFinite(field)
      ? field
      : undefined;
  };
  const finalizeReadResult = (
    result: Record<string, unknown>,
    maxChars: number,
    forceTruncated = false,
  ) => {
    const draft = {
      ...result,
      truncated: Boolean(result.truncated) || forceTruncated,
    };
    const draftLength = getSerializedLength(draft);
    const payload = {
      ...draft,
      chars: draftLength,
    };
    if (getSerializedLength(payload) <= maxChars) {
      return payload;
    }

    return {
      blockId: getStringField(result, 'blockId'),
      type: getStringField(result, 'type'),
      heading: truncateOptionalText(getStringField(result, 'heading'), 120),
      scope: getStringField(result, 'scope'),
      page: getNumberField(result, 'page'),
      pageSize: 0,
      pageCount: getNumberField(result, 'pageCount'),
      nextPage: getNumberField(result, 'nextPage'),
      chars: draftLength,
      truncated: true,
      budgetExceeded: true,
      warning:
        'Read result exceeded maxChars; retry with a smaller pageSize or a narrower blockId/query.',
    };
  };
  const fitReadResult = (
    maxChars: number,
    requestedPageSize: number,
    build: (pageSize: number) => Record<string, unknown>,
  ) => {
    let candidatePageSize = requestedPageSize;
    while (candidatePageSize >= 1) {
      const result = build(candidatePageSize);
      const payload = finalizeReadResult(
        result,
        maxChars,
        candidatePageSize < requestedPageSize,
      );
      if (getSerializedLength(payload) <= maxChars) {
        return payload;
      }
      candidatePageSize = Math.floor(candidatePageSize / 2);
    }

    return finalizeReadResult(build(1), maxChars, true);
  };
  const read = (readableContent: ReadableContent) => {
    const page = typeof params.page === 'number' ? params.page : 1;
    const pageSize = typeof params.pageSize === 'number' ? params.pageSize : 20;
    const maxChars =
      typeof params.maxChars === 'number' && Number.isFinite(params.maxChars)
        ? Math.max(500, Math.min(12_000, Math.floor(params.maxChars)))
        : 4_000;
    const query = params.query?.trim().toLowerCase();
    const candidates = query
      ? readableContent.blocks.filter((block) =>
          JSON.stringify(block).toLowerCase().includes(query),
        )
      : readableContent.blocks;
    const block = params.blockId
      ? readableContent.blocks.find(
          (candidate) => candidate.blockId === params.blockId,
        )
      : undefined;
    if (block?.fields) {
      return fitReadResult(maxChars, pageSize, (candidatePageSize) => {
        const bounds = pageBounds(block.fields?.length ?? 0, page, candidatePageSize);
        return {
          ...block,
          fields: block.fields?.slice(bounds.start, bounds.end),
          page: bounds.page,
          pageSize: bounds.pageSize,
          pageCount: bounds.pageCount,
          nextPage: bounds.page < bounds.pageCount ? bounds.page + 1 : undefined,
        };
      });
    }
    if (block?.items) {
      return fitReadResult(maxChars, pageSize, (candidatePageSize) => {
        const bounds = pageBounds(block.items?.length ?? 0, page, candidatePageSize);
        return {
          ...block,
          items: block.items?.slice(bounds.start, bounds.end),
          page: bounds.page,
          pageSize: bounds.pageSize,
          pageCount: bounds.pageCount,
          nextPage: bounds.page < bounds.pageCount ? bounds.page + 1 : undefined,
        };
      });
    }
    if (block?.rows) {
      return fitReadResult(maxChars, pageSize, (candidatePageSize) => {
        const bounds = pageBounds(block.rows?.length ?? 0, page, candidatePageSize);
        return {
          ...block,
          rows: block.rows?.slice(bounds.start, bounds.end),
          page: bounds.page,
          pageSize: bounds.pageSize,
          pageCount: bounds.pageCount,
          nextPage: bounds.page < bounds.pageCount ? bounds.page + 1 : undefined,
        };
      });
    }
    if (block) {
      return finalizeReadResult({ ...block }, maxChars);
    }
    return fitReadResult(maxChars, pageSize, (candidatePageSize) => {
      const bounds = pageBounds(candidates.length, page, candidatePageSize);
      return {
        scope: 'visible',
        blocks: candidates.slice(bounds.start, bounds.end),
        page: bounds.page,
        pageSize: bounds.pageSize,
        pageCount: bounds.pageCount,
        nextPage: bounds.page < bounds.pageCount ? bounds.page + 1 : undefined,
        coverage: readableContent.coverage,
        warnings: readableContent.warnings,
      };
    });
  };
  const readableContent = extract();
  return params.mode === 'read' ||
    params.blockId ||
    params.query ||
    params.page ||
    params.pageSize
    ? read(readableContent)
    : createReadableContentIndex(readableContent);
}

function pageSnapshotScript(rawArgs: unknown) {
  const args =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as { maxElements?: number })
      : {};
  const maxElements =
    typeof args.maxElements === 'number' && Number.isFinite(args.maxElements)
      ? Math.max(1, Math.min(300, Math.floor(args.maxElements)))
      : 120;
  const globalObject = globalThis as typeof globalThis & {
    __xpertaiChatKitHostAutomation?: {
      refs: Record<string, Element>;
      nextRef: number;
    };
  };
  const store: {
    refs: Record<string, Element>;
    nextRef: number;
  } = (globalObject.__xpertaiChatKitHostAutomation = {
    refs: {},
    nextRef: 1,
  });
  const candidateSelector = [
    'a[href]',
    'button',
    'input',
    'textarea',
    'select',
    'summary',
    '[role]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '[aria-label]',
    '[data-testid]',
    '[data-test-id]',
    '[data-qa]',
  ].join(',');

  const getElementView = (element: Element) =>
    element.ownerDocument.defaultView ?? window;
  const isHtmlElement = (element: Element) => {
    const view = getElementView(element);
    return element instanceof view.HTMLElement;
  };
  const isSvgElement = (element: Element) => {
    const view = getElementView(element);
    return element instanceof view.SVGElement;
  };
  const isTag = (element: Element, tag: string) =>
    element.tagName.toLowerCase() === tag;
  const isInputElement = (element: Element): element is HTMLInputElement =>
    isTag(element, 'input');
  const isTextAreaElement = (
    element: Element,
  ): element is HTMLTextAreaElement => isTag(element, 'textarea');
  const isSelectElement = (element: Element): element is HTMLSelectElement =>
    isTag(element, 'select');
  const isFrameElement = (element: Element): element is HTMLIFrameElement =>
    isTag(element, 'iframe');
  const getFrameDocument = (frame: Element) => {
    if (!isFrameElement(frame)) return null;
    try {
      return frame.contentDocument;
    } catch {
      return null;
    }
  };
  const getFrameOffset = (doc: Document) => {
    let x = 0;
    let y = 0;
    let view = doc.defaultView;
    while (view?.frameElement) {
      const frame = view.frameElement;
      const rect = frame.getBoundingClientRect();
      x += rect.left;
      y += rect.top;
      view = frame.ownerDocument.defaultView;
    }
    return { x, y };
  };
  const getGlobalRect = (element: Element) => {
    const rect = element.getBoundingClientRect();
    const offset = getFrameOffset(element.ownerDocument);
    return {
      x: rect.left + offset.x,
      y: rect.top + offset.y,
      width: rect.width,
      height: rect.height,
    };
  };
  const getDeepHitStack = (
    point: { x: number; y: number },
    doc: Document = document,
  ): Element[] => {
    const offset = getFrameOffset(doc);
    const localX = point.x - offset.x;
    const localY = point.y - offset.y;
    const stack =
      typeof doc.elementsFromPoint === 'function'
        ? doc.elementsFromPoint(localX, localY)
        : ([doc.elementFromPoint(localX, localY)].filter(Boolean) as Element[]);
    const result: Element[] = [];
    for (const hit of stack) {
      const childDocument = getFrameDocument(hit);
      if (childDocument) {
        result.push(...getDeepHitStack(point, childDocument));
      }
      result.push(hit);
    }
    return result;
  };

  const getText = (element: Element) => {
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, 180) : undefined;
  };
  const getOwnText = (element: Element) => {
    const text = Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text ? text.slice(0, 180) : undefined;
  };
  const isVisible = (element: Element) => {
    if (!(isHtmlElement(element) || isSvgElement(element))) return false;
    if (isHtmlElement(element) && (element as HTMLElement).hidden) return false;
    const style = getElementView(element).getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const isTextOnlyLabelCandidate = (element: Element) => {
    if (!(isHtmlElement(element) || isSvgElement(element))) return false;
    if (!isVisible(element)) return false;
    if (
      element.matches(
        'input,textarea,select,button,a[href],[role="button"],[role="link"]',
      )
    ) {
      return false;
    }
    const text = getOwnText(element) ?? getText(element);
    return Boolean(text && text.length <= 120);
  };
  const getNearbyText = (element: Element) => {
    const ownerDocument = element.ownerDocument;
    if (!ownerDocument.body) return [];
    const targetRect = getGlobalRect(element);
    if (targetRect.width <= 0 || targetRect.height <= 0) return [];
    const targetCenterY = targetRect.y + targetRect.height / 2;
    const targetCenterX = targetRect.x + targetRect.width / 2;
    const targetRight = targetRect.x + targetRect.width;
    const candidates: Array<{ text: string; score: number }> = [];
    const walker = ownerDocument.createTreeWalker(
      ownerDocument.body,
      NodeFilter.SHOW_ELEMENT,
    );
    let node = walker.nextNode();
    while (node) {
      const candidate = node as Element;
      if (
        candidate !== element &&
        !candidate.contains(element) &&
        isTextOnlyLabelCandidate(candidate)
      ) {
        const rect = getGlobalRect(candidate);
        const text = getOwnText(candidate) ?? getText(candidate);
        if (text) {
          const centerY = rect.y + rect.height / 2;
          const centerX = rect.x + rect.width / 2;
          const rectRight = rect.x + rect.width;
          const rectBottom = rect.y + rect.height;
          const sameRow =
            rectRight <= targetRect.x + 12 &&
            Math.abs(centerY - targetCenterY) <=
              Math.max(28, targetRect.height * 1.25);
          const sameRowRight =
            rect.x >= targetRight - 8 &&
            rect.x - targetRight <= 240 &&
            Math.abs(centerY - targetCenterY) <=
              Math.max(28, targetRect.height * 1.25);
          const above =
            rectBottom <= targetRect.y + 8 &&
            targetRect.y - rectBottom <= 80 &&
            centerX >= targetRect.x - 80 &&
            centerX <= targetRight + 80;
          if (sameRow || sameRowRight || above) {
            candidates.push({
              text,
              score:
                (sameRow
                  ? targetRect.x - rectRight + Math.abs(centerY - targetCenterY)
                  : sameRowRight
                    ? rect.x - targetRight + Math.abs(centerY - targetCenterY)
                    : targetRect.y -
                      rectBottom +
                      Math.abs(centerX - targetCenterX)) +
                (sameRow ? 0 : sameRowRight ? 5 : 100),
            });
          }
        }
      }
      node = walker.nextNode();
    }
    const seen = new Set<string>();
    return candidates
      .sort((left, right) => left.score - right.score)
      .map((candidate) => candidate.text)
      .filter((text) => {
        if (seen.has(text)) return false;
        seen.add(text);
        return true;
      })
      .slice(0, 4);
  };
  const getRole = (element: Element) => {
    const explicit = element.getAttribute('role')?.trim();
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'summary') return 'button';
    if (isInputElement(element)) {
      if (element.type === 'checkbox') return 'checkbox';
      if (element.type === 'radio') return 'radio';
      if (['button', 'submit', 'reset'].includes(element.type)) return 'button';
      return 'textbox';
    }
    return undefined;
  };
  const isChoiceInput = (element: Element): element is HTMLInputElement =>
    isInputElement(element) &&
    (element.type === 'checkbox' || element.type === 'radio');
  const getControlLabels = (element: Element) => {
    if (
      isInputElement(element) ||
      isSelectElement(element) ||
      isTextAreaElement(element)
    ) {
      return Array.from(element.labels ?? []);
    }
    return [];
  };
  const getTextByElementIds = (element: Element, attribute: string) => {
    const ids = element.getAttribute(attribute)?.trim().split(/\s+/) ?? [];
    return ids
      .map((id) => element.ownerDocument.getElementById(id))
      .filter((target): target is HTMLElement => Boolean(target))
      .map((target) => getText(target))
      .filter((text): text is string => Boolean(text));
  };
  const getExplicitControlLabel = (element: Element) => {
    const ariaLabelledBy = getTextByElementIds(element, 'aria-labelledby');
    if (ariaLabelledBy.length > 0) {
      return ariaLabelledBy.join(' ').slice(0, 180);
    }

    const labels = getControlLabels(element)
      .map((label) => getText(label))
      .filter((text): text is string => Boolean(text));
    if (labels.length > 0) {
      return labels.join(' ').slice(0, 180);
    }

    return undefined;
  };
  const getAdjacentTextAfter = (element: Element) => {
    const segments: string[] = [];
    let node = element.nextSibling;

    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (text) segments.push(text);
      } else if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node as Element).tagName.toLowerCase() === 'br'
      ) {
        break;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const siblingElement = node as Element;
        if (
          siblingElement.matches(
            'input,textarea,select,button,a[href],[role="button"],[role="link"]',
          )
        ) {
          break;
        }
        const text = getText(siblingElement);
        if (text) segments.push(text);
        break;
      }

      if (segments.join(' ').length >= 120) break;
      node = node.nextSibling;
    }

    const text = segments.join(' ').replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, 180) : undefined;
  };
  const getSameRowText = (element: Element, side: 'left' | 'right') => {
    const ownerDocument = element.ownerDocument;
    if (!ownerDocument.body) return undefined;
    const targetRect = getGlobalRect(element);
    if (targetRect.width <= 0 || targetRect.height <= 0) return undefined;

    const targetCenterY = targetRect.y + targetRect.height / 2;
    const candidates: Array<{ text: string; score: number }> = [];
    const walker = ownerDocument.createTreeWalker(
      ownerDocument.body,
      NodeFilter.SHOW_ELEMENT,
    );
    let node = walker.nextNode();
    while (node) {
      const candidate = node as Element;
      if (
        candidate !== element &&
        !candidate.contains(element) &&
        isTextOnlyLabelCandidate(candidate)
      ) {
        const rect = getGlobalRect(candidate);
        const text = getOwnText(candidate) ?? getText(candidate);
        if (text) {
          const centerY = rect.y + rect.height / 2;
          const sameRow =
            Math.abs(centerY - targetCenterY) <=
            Math.max(28, targetRect.height * 1.25);
          const distance =
            side === 'left'
              ? targetRect.x - (rect.x + rect.width)
              : rect.x - (targetRect.x + targetRect.width);

          if (sameRow && distance >= -8 && distance <= 240) {
            candidates.push({
              text,
              score: Math.abs(distance) + Math.abs(centerY - targetCenterY),
            });
          }
        }
      }
      node = walker.nextNode();
    }

    return candidates.sort((left, right) => left.score - right.score)[0]?.text;
  };
  const getControlLabel = (element: Element) => {
    if (
      !(
        isInputElement(element) ||
        isSelectElement(element) ||
        isTextAreaElement(element)
      )
    ) {
      return undefined;
    }

    const explicit = getExplicitControlLabel(element);
    if (explicit) return explicit;

    if (isChoiceInput(element)) {
      return (
        getSameRowText(element, 'right') ??
        getAdjacentTextAfter(element) ??
        getNearbyText(element)[0]
      );
    }

    return getSameRowText(element, 'left') ?? getNearbyText(element)[0];
  };
  const isWeakControlName = (element: Element, name: string) => {
    const normalized = name.trim().toLowerCase();
    if (isInputElement(element) && element.type === 'radio') {
      return normalized === 'radio' || normalized === 'radio button';
    }
    if (isInputElement(element) && element.type === 'checkbox') {
      return normalized === 'checkbox' || normalized === 'check box';
    }
    if (isSelectElement(element)) {
      return (
        normalized === 'select' ||
        normalized === 'select menu' ||
        normalized === 'combobox' ||
        normalized === 'combo box'
      );
    }
    return false;
  };
  const getChoiceGroupLabel = (element: Element) => {
    if (!isChoiceInput(element)) return undefined;

    const fieldset = element.closest('fieldset');
    const legend = fieldset?.querySelector('legend');
    const legendText = legend ? getText(legend) : undefined;
    if (legendText) return legendText;

    const ownerDocument = element.ownerDocument;
    if (!ownerDocument.body) return undefined;
    const targetRect = getGlobalRect(element);
    if (targetRect.width <= 0 || targetRect.height <= 0) return undefined;

    const targetCenterX = targetRect.x + targetRect.width / 2;
    const candidates: Array<{ text: string; score: number }> = [];
    const walker = ownerDocument.createTreeWalker(
      ownerDocument.body,
      NodeFilter.SHOW_ELEMENT,
    );
    let node = walker.nextNode();
    while (node) {
      const candidate = node as Element;
      if (
        candidate !== element &&
        !candidate.contains(element) &&
        candidate.matches(
          'legend,strong,b,[role="heading"],h1,h2,h3,h4,h5,h6',
        ) &&
        isTextOnlyLabelCandidate(candidate)
      ) {
        const rect = getGlobalRect(candidate);
        const text = getOwnText(candidate) ?? getText(candidate);
        if (text && rect.y + rect.height <= targetRect.y + 8) {
          const verticalDistance = targetRect.y - (rect.y + rect.height);
          const centerX = rect.x + rect.width / 2;
          const aligned =
            verticalDistance <= 160 &&
            centerX >= targetRect.x - 120 &&
            centerX <= targetRect.x + targetRect.width + 320;

          if (aligned) {
            candidates.push({
              text,
              score:
                verticalDistance + Math.abs(centerX - targetCenterX) * 0.25,
            });
          }
        }
      }
      node = walker.nextNode();
    }

    return candidates.sort((left, right) => left.score - right.score)[0]?.text;
  };
  const getSelectOptions = (element: Element) => {
    if (!isSelectElement(element)) return undefined;

    const options = Array.from(element.options).map((option) => {
      const label = (option.label || option.textContent || option.value)
        .replace(/\s+/g, ' ')
        .trim();
      return {
        label: (label || option.value).slice(0, 180),
        value: option.value,
        selected: option.selected || undefined,
        disabled: option.disabled || undefined,
      };
    });

    return options.length ? options : undefined;
  };
  const getSelectedLabel = (element: Element) => {
    if (!isSelectElement(element)) return undefined;

    const selected = element.selectedOptions[0];
    const label = selected
      ? (selected.label || selected.textContent || selected.value)
          .replace(/\s+/g, ' ')
          .trim()
      : undefined;

    return label ? label.slice(0, 180) : undefined;
  };
  const getName = (element: Element) => {
    const controlLabel = getControlLabel(element);
    const ariaLabel = element.getAttribute('aria-label')?.trim();
    if (ariaLabel && !isWeakControlName(element, ariaLabel)) return ariaLabel;
    const title = element.getAttribute('title')?.trim();
    if (title && !isWeakControlName(element, title)) return title;
    if (controlLabel) return controlLabel;
    const nearbyText = getNearbyText(element)[0];
    if (nearbyText) return nearbyText;
    return getText(element);
  };
  const getSelector = (element: Element) => {
    const escape = (value: string) =>
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(value)
        : value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    if (element.id) return `#${escape(element.id)}`;
    for (const attribute of ['data-testid', 'data-test-id', 'data-qa']) {
      const testId = element.getAttribute(attribute);
      if (testId) return `[${attribute}="${escape(testId)}"]`;
    }
    const name = element.getAttribute('name');
    if (name) return `${element.tagName.toLowerCase()}[name="${escape(name)}"]`;
    return element.tagName.toLowerCase();
  };
  const isDisabled = (element: Element) => {
    if (
      isTag(element, 'button') ||
      isInputElement(element) ||
      isSelectElement(element) ||
      isTextAreaElement(element)
    ) {
      return Boolean(
        (
          element as
            | HTMLButtonElement
            | HTMLInputElement
            | HTMLSelectElement
            | HTMLTextAreaElement
        ).disabled,
      );
    }
    return element.getAttribute('aria-disabled') === 'true';
  };
  const summarize = (element: Element) => ({
    tag: element.tagName.toLowerCase(),
    role: getRole(element),
    name: getName(element),
    selector: getSelector(element),
  });
  const containsOrEquals = (parent: Element, child: Element) =>
    parent === child || parent.contains(child);
  const getCandidatePoints = (element: Element) => {
    const rect = getGlobalRect(element);
    if (rect.width <= 0 || rect.height <= 0) return [];
    const insetX = Math.min(8, rect.width / 2);
    const insetY = Math.min(8, rect.height / 2);
    return [
      { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      { x: rect.x + insetX, y: rect.y + rect.height / 2 },
      { x: rect.x + rect.width - insetX, y: rect.y + rect.height / 2 },
      { x: rect.x + rect.width / 2, y: rect.y + insetY },
      { x: rect.x + rect.width / 2, y: rect.y + rect.height - insetY },
    ];
  };
  const getReceivesEventsPoints = (element: Element) =>
    getCandidatePoints(element).filter((point) => {
      const hitTarget = getDeepHitStack(point)[0];
      return hitTarget ? containsOrEquals(element, hitTarget) : false;
    });
  const getActionability = (element: Element) => {
    const rect = getGlobalRect(element);
    const center =
      rect.width > 0 && rect.height > 0
        ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        : undefined;
    const hitStack = center ? getDeepHitStack(center) : [];
    const hitTarget = hitStack[0];
    const safeClickPoints = getReceivesEventsPoints(element);
    const receivesEvents = safeClickPoints.length > 0;
    return {
      visible: isVisible(element),
      enabled: !isDisabled(element),
      receivesEvents,
      actionable: isVisible(element) && !isDisabled(element) && receivesEvents,
      center,
      safeClickPoints,
      occludedBy:
        !receivesEvents && hitTarget ? summarize(hitTarget) : undefined,
      hitTarget: hitTarget ? summarize(hitTarget) : undefined,
      hitStack: hitStack.slice(0, 5).map(summarize),
    };
  };
  const snapshotElement = (element: Element) => {
    const ref = `e${store.nextRef}`;
    store.nextRef += 1;
    store.refs[ref] = element;
    const rect = getGlobalRect(element);
    const actionability = getActionability(element);
    return {
      ref,
      tag: element.tagName.toLowerCase(),
      role: getRole(element),
      name: getName(element),
      label: getControlLabel(element),
      groupLabel: getChoiceGroupLabel(element),
      text: getText(element),
      nearbyText: getNearbyText(element),
      testId:
        element.getAttribute('data-testid') ??
        element.getAttribute('data-test-id') ??
        element.getAttribute('data-qa') ??
        undefined,
      value:
        isInputElement(element) ||
        isTextAreaElement(element) ||
        isSelectElement(element)
          ? element.value
          : undefined,
      selectedLabel: getSelectedLabel(element),
      options: getSelectOptions(element),
      placeholder:
        isInputElement(element) || isTextAreaElement(element)
          ? element.placeholder || undefined
          : undefined,
      selector: getSelector(element),
      disabled: isDisabled(element) || undefined,
      enabled: !isDisabled(element),
      checked:
        isInputElement(element) &&
        (element.type === 'checkbox' || element.type === 'radio')
          ? element.checked
          : undefined,
      visible: actionability.visible,
      receivesEvents: actionability.receivesEvents,
      actionable: actionability.actionable,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      center: actionability.center,
      occludedBy: actionability.occludedBy,
      safeClickPoints: actionability.safeClickPoints,
      hitTarget: actionability.hitTarget,
      hitStack: actionability.hitStack,
    };
  };
  const elements: ReturnType<typeof snapshotElement>[] = [];
  const visit = (root: Document | ShadowRoot | Element) => {
    const doc =
      root.nodeType === Node.DOCUMENT_NODE
        ? (root as Document)
        : (root as Element | ShadowRoot).ownerDocument;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node && elements.length < maxElements) {
      const element = node as Element;
      if (element.matches(candidateSelector) && isVisible(element)) {
        elements.push(snapshotElement(element));
      }
      if (element.shadowRoot) {
        visit(element.shadowRoot);
      }
      const childDocument = getFrameDocument(element);
      if (childDocument?.body) {
        visit(childDocument.body);
      }
      node = walker.nextNode();
    }
  };
  if (document.body) {
    visit(document.body);
  }
  const readableContent = pageReadableContentScript({});
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  const frames = Array.from(document.querySelectorAll('iframe')).map(
    (frame) => {
      const rect = getGlobalRect(frame);
      try {
        return {
          url: frame.contentWindow?.location.href,
          title: frame.contentDocument?.title,
          sameOrigin: true,
          rect,
        };
      } catch {
        return {
          url: frame.getAttribute('src') ?? undefined,
          sameOrigin: false,
          rect,
        };
      }
    },
  );

  return {
    url: location.href,
    title: document.title,
    capabilities: {
      cdp: true,
      realInput: true,
      screenshot: true,
      accessibility: true,
      networkState: true,
    },
    viewport: {
      width: innerWidth,
      height: innerHeight,
      devicePixelRatio,
    },
    scroll: { x: scrollX, y: scrollY },
    page: {
      readyState: document.readyState,
      visibilityState: document.visibilityState,
      focusedElement:
        document.activeElement && document.activeElement !== document.body
          ? summarize(document.activeElement)
          : undefined,
      selection: document.getSelection()?.toString() || undefined,
    },
    navigation: navigation
      ? {
          type: navigation.type,
          duration: navigation.duration,
          domContentLoaded:
            navigation.domContentLoadedEventEnd - navigation.startTime,
          loadEventEnd: navigation.loadEventEnd - navigation.startTime,
        }
      : undefined,
    frames,
    readableContent,
    elements,
  };
}

function pageNormalizePointerPointScript(rawArgs: unknown) {
  const params =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};
  const x = typeof params.x === 'number' ? params.x : Number.NaN;
  const y = typeof params.y === 'number' ? params.y : Number.NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error('x and y must be finite numbers.');
  }
  const point =
    params.coordinateSpace === 'viewport_normalized'
      ? {
          x: Number((x * innerWidth).toFixed(3)),
          y: Number((y * innerHeight).toFixed(3)),
        }
      : { x, y };
  const targetText =
    typeof params.targetText === 'string' && params.targetText.trim()
      ? params.targetText.trim().toLowerCase()
      : undefined;
  const getText = (element: Element) =>
    [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.textContent,
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
        ? element.value
        : undefined,
    ]
      .filter((text): text is string => Boolean(text))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const isFrameElement = (element: Element): element is HTMLIFrameElement =>
    element.tagName.toLowerCase() === 'iframe';
  const getFrameDocument = (frame: Element) => {
    if (!isFrameElement(frame)) return null;
    try {
      return frame.contentDocument;
    } catch {
      return null;
    }
  };
  const getFrameOffset = (doc: Document) => {
    let offsetX = 0;
    let offsetY = 0;
    let view = doc.defaultView;
    while (view?.frameElement) {
      const frame = view.frameElement;
      const rect = frame.getBoundingClientRect();
      offsetX += rect.left;
      offsetY += rect.top;
      view = frame.ownerDocument.defaultView;
    }
    return { x: offsetX, y: offsetY };
  };
  const getDeepHitStack = (
    hitPoint: { x: number; y: number },
    doc: Document = document,
  ): Element[] => {
    const offset = getFrameOffset(doc);
    const localX = hitPoint.x - offset.x;
    const localY = hitPoint.y - offset.y;
    const stack =
      typeof doc.elementsFromPoint === 'function'
        ? doc.elementsFromPoint(localX, localY)
        : ([doc.elementFromPoint(localX, localY)].filter(Boolean) as Element[]);
    const result: Element[] = [];
    for (const hit of stack) {
      const childDocument = getFrameDocument(hit);
      if (childDocument) {
        result.push(...getDeepHitStack(hitPoint, childDocument));
      }
      result.push(hit);
    }
    return result;
  };
  const hitTarget = getDeepHitStack(point)[0];
  let targetTextMatched: boolean | undefined;
  if (targetText && hitTarget) {
    let current: Element | null = hitTarget;
    let depth = 0;
    targetTextMatched = false;
    while (current && depth < 5) {
      const tag = current.tagName.toLowerCase();
      if (tag === 'body' || tag === 'html') {
        break;
      }
      if (getText(current).includes(targetText)) {
        targetTextMatched = true;
        break;
      }
      current = current.parentElement;
      depth += 1;
    }
  }
  return { point, targetTextMatched };
}

function pageExpectedAfterClickScript(rawArgs: unknown) {
  const params =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};
  const expected = params.expectedAfterClick;
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
    return undefined;
  }
  const candidate = expected as Record<string, unknown>;
  if (
    candidate.type !== 'field_contains' ||
    typeof candidate.field !== 'string' ||
    !candidate.field.trim() ||
    typeof candidate.value !== 'string'
  ) {
    return undefined;
  }
  const field = candidate.field.trim().toLowerCase();
  const value = candidate.value;
  const getControlLabel = (
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ) => {
    const ariaLabel = element.getAttribute('aria-label')?.trim();
    if (ariaLabel) return ariaLabel;
    const labels = Array.from(element.labels ?? [])
      .map((label) => (label.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (labels.length > 0) return labels.join(' ');
    return element.getAttribute('name') ?? element.getAttribute('placeholder');
  };
  const control = Array.from(
    document.querySelectorAll('input,textarea,select'),
  ).find((element) => {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      )
    ) {
      return false;
    }
    return getControlLabel(element)?.toLowerCase().includes(field);
  }) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
  const actual = control?.value;
  return {
    type: 'field_contains',
    field: candidate.field,
    value,
    ok:
      typeof actual === 'string' &&
      actual.toLowerCase().includes(value.toLowerCase()),
    actual,
  };
}

function pageResolveTargetScript(rawArgs: unknown) {
  const params =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};
  const globalObject = globalThis as typeof globalThis & {
    __xpertaiChatKitHostAutomation?: {
      refs: Record<string, Element>;
      lastResolved?: Element;
    };
  };
  const store =
    globalObject.__xpertaiChatKitHostAutomation ??
    (globalObject.__xpertaiChatKitHostAutomation = { refs: {} });
  const getString = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value : undefined;
  const candidateSelector = [
    'a[href]',
    'button',
    'input',
    'textarea',
    'select',
    'summary',
    '[role]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '[aria-label]',
    '[data-testid]',
    '[data-test-id]',
    '[data-qa]',
  ].join(',');
  const getElementView = (element: Element) =>
    element.ownerDocument.defaultView ?? window;
  const isHtmlElement = (element: Element) => {
    const view = getElementView(element);
    return element instanceof view.HTMLElement;
  };
  const isSvgElement = (element: Element) => {
    const view = getElementView(element);
    return element instanceof view.SVGElement;
  };
  const isTag = (element: Element, tag: string) =>
    element.tagName.toLowerCase() === tag;
  const isInputElement = (element: Element): element is HTMLInputElement =>
    isTag(element, 'input');
  const isFrameElement = (element: Element): element is HTMLIFrameElement =>
    isTag(element, 'iframe');
  const getFrameDocument = (frame: Element) => {
    if (!isFrameElement(frame)) return null;
    try {
      return frame.contentDocument;
    } catch {
      return null;
    }
  };
  const getFrameOffset = (doc: Document) => {
    let x = 0;
    let y = 0;
    let view = doc.defaultView;
    while (view?.frameElement) {
      const frame = view.frameElement;
      const rect = frame.getBoundingClientRect();
      x += rect.left;
      y += rect.top;
      view = frame.ownerDocument.defaultView;
    }
    return { x, y };
  };
  const getGlobalRect = (element: Element) => {
    const rect = element.getBoundingClientRect();
    const offset = getFrameOffset(element.ownerDocument);
    return {
      x: rect.left + offset.x,
      y: rect.top + offset.y,
      width: rect.width,
      height: rect.height,
    };
  };
  const getDocuments = () => {
    const documents: Document[] = [];
    const visit = (doc: Document) => {
      documents.push(doc);
      for (const frame of Array.from(doc.querySelectorAll('iframe'))) {
        const childDocument = getFrameDocument(frame);
        if (childDocument) {
          visit(childDocument);
        }
      }
    };
    visit(document);
    return documents;
  };
  const querySelectorInDocuments = (selector: string) => {
    for (const doc of getDocuments()) {
      const element = doc.querySelector(selector);
      if (element) return element;
    }
    return null;
  };
  const queryCandidates = () =>
    getDocuments().flatMap((doc) =>
      Array.from(doc.querySelectorAll(candidateSelector)),
    );
  const getDeepHitStack = (
    point: { x: number; y: number },
    doc: Document = document,
  ): Element[] => {
    const offset = getFrameOffset(doc);
    const localX = point.x - offset.x;
    const localY = point.y - offset.y;
    const stack =
      typeof doc.elementsFromPoint === 'function'
        ? doc.elementsFromPoint(localX, localY)
        : ([doc.elementFromPoint(localX, localY)].filter(Boolean) as Element[]);
    const result: Element[] = [];
    for (const hit of stack) {
      const childDocument = getFrameDocument(hit);
      if (childDocument) {
        result.push(...getDeepHitStack(point, childDocument));
      }
      result.push(hit);
    }
    return result;
  };
  const getText = (element: Element) =>
    (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const getRole = (element: Element) => {
    const explicit = element.getAttribute('role')?.trim();
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (isInputElement(element)) {
      if (element.type === 'checkbox') return 'checkbox';
      if (element.type === 'radio') return 'radio';
      return 'textbox';
    }
    return undefined;
  };
  const getName = (element: Element) =>
    element.getAttribute('aria-label')?.trim() ||
    element.getAttribute('title')?.trim() ||
    getText(element);
  const normalizeSemanticText = (value: string | undefined) =>
    (value ?? '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, '')
      .trim()
      .toLowerCase();
  const isActionable = (element: Element) => {
    if (!(isHtmlElement(element) || isSvgElement(element))) return false;
    const style = getElementView(element).getComputedStyle(element);
    if (style.cursor === 'pointer') return true;
    return Boolean(
      element.matches(
        [
          'a[href]',
          'button',
          'input',
          'textarea',
          'select',
          'summary',
          '[role="button"]',
          '[role="link"]',
          '[role="menuitem"]',
          '[role="tab"]',
          '[role="option"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[contenteditable=""]',
          '[contenteditable="true"]',
        ].join(','),
      ) ||
      (isHtmlElement(element) && element.onclick),
    );
  };
  const getElementDepth = (element: Element) => {
    let depth = 0;
    let current = element.parentElement;
    while (current) {
      depth += 1;
      current = current.parentElement;
    }
    return depth;
  };
  const getSemanticCandidateScore = (
    element: Element,
    requested: { role?: string; name?: string; text?: string },
  ) => {
    const elementRole = getRole(element)?.toLowerCase();
    const elementName = normalizeSemanticText(getName(element));
    const elementText = normalizeSemanticText(getText(element));
    const requestedName = normalizeSemanticText(requested.name);
    const requestedText = normalizeSemanticText(requested.text);
    const rect = getGlobalRect(element);
    const area = Math.max(1, rect.width * rect.height);
    const viewportArea = Math.max(1, innerWidth * innerHeight);
    let score = 0;

    score += isActionable(element) ? -1000 : 250;
    if (requested.role && elementRole === requested.role) score -= 300;
    if (requestedName) {
      if (elementName === requestedName) score -= 300;
      else if (elementName.includes(requestedName)) score -= 150;
      else if (elementText.includes(requestedName)) score -= 80;
    }
    if (requestedText) {
      if (elementText === requestedText) score -= 240;
      else if (elementText.includes(requestedText)) score -= 120;
    }
    if (area > viewportArea * 0.35) score += 900;
    if (rect.width > innerWidth * 0.7 || rect.height > innerHeight * 0.5) {
      score += 350;
    }
    score += Math.log10(area) * 24;
    score -= Math.min(80, getElementDepth(element));
    return score;
  };
  const resolve = () => {
    const ref = getString(params.ref) ?? getString(params.axRef);
    if (ref && store?.refs[ref]) return store.refs[ref];
    const selector = getString(params.selector);
    if (selector) return querySelectorInDocuments(selector);
    const testId = getString(params.testId);
    if (testId) {
      const escaped =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(testId)
          : testId.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
      const element = querySelectorInDocuments(
        `[data-testid="${escaped}"],[data-test-id="${escaped}"],[data-qa="${escaped}"]`,
      );
      if (element) return element;
    }
    const role = getString(params.role)?.toLowerCase();
    const name = getString(params.name);
    const text = getString(params.text);
    if (role || name || text) {
      const requestedName = normalizeSemanticText(name);
      const requestedText = normalizeSemanticText(text);
      const candidates = queryCandidates();
      const matches = candidates
        .filter((element) => {
          const elementRole = getRole(element)?.toLowerCase();
          const elementName = normalizeSemanticText(getName(element));
          const elementText = normalizeSemanticText(getText(element));
          if (role && elementRole !== role) return false;
          if (requestedName && !elementName.includes(requestedName))
            return false;
          if (requestedText && !elementText.includes(requestedText))
            return false;
          return true;
        })
        .map((element) => ({
          element,
          score: getSemanticCandidateScore(element, { role, name, text }),
        }))
        .sort((left, right) => left.score - right.score);
      if (matches[0]) return matches[0].element;
    }
    if (typeof params.x === 'number' && typeof params.y === 'number') {
      return (
        getDeepHitStack({ x: params.x, y: params.y })[0] ??
        document.elementFromPoint(params.x, params.y)
      );
    }
    return null;
  };
  const summarize = (element: Element) => ({
    tag: element.tagName.toLowerCase(),
    role: getRole(element),
    name: getName(element),
  });
  const getHitStack = (point: { x: number; y: number }) =>
    getDeepHitStack(point);
  const containsOrEquals = (parent: Element, child: Element) =>
    parent === child || parent.contains(child);
  const getReceivesEventsPoint = (candidate: Element) => {
    const rect = getGlobalRect(candidate);
    if (rect.width <= 0 || rect.height <= 0) return undefined;
    const insetX = Math.min(8, rect.width / 2);
    const insetY = Math.min(8, rect.height / 2);
    const points = [
      { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      { x: rect.x + insetX, y: rect.y + rect.height / 2 },
      { x: rect.x + rect.width - insetX, y: rect.y + rect.height / 2 },
      { x: rect.x + rect.width / 2, y: rect.y + insetY },
      { x: rect.x + rect.width / 2, y: rect.y + rect.height - insetY },
    ];
    return points.find((point) => {
      const hitTarget = getHitStack(point)[0];
      return hitTarget ? containsOrEquals(candidate, hitTarget) : false;
    });
  };
  const findSemanticVisibleFallback = (requested: Element) => {
    const requestedRole = getRole(requested);
    const requestedName = normalizeSemanticText(getName(requested));
    if (!requestedName) return null;
    const candidates = queryCandidates()
      .filter((candidate) => candidate !== requested)
      .filter(isActionable)
      .filter((candidate) => {
        const candidateRole = getRole(candidate);
        const candidateName = normalizeSemanticText(getName(candidate));
        if (!candidateName) return false;
        if (requestedRole && candidateRole && requestedRole !== candidateRole)
          return false;
        return (
          candidateName.includes(requestedName) ||
          requestedName.includes(candidateName)
        );
      })
      .map((candidate) => ({
        candidate,
        point: getReceivesEventsPoint(candidate),
        rect: getGlobalRect(candidate),
      }))
      .filter(
        (
          entry,
        ): entry is {
          candidate: Element;
          point: { x: number; y: number };
          rect: { x: number; y: number; width: number; height: number };
        } => Boolean(entry.point),
      )
      .sort((left, right) => right.rect.y - left.rect.y);
    return candidates[0] ?? null;
  };
  const element = resolve();
  if (!element) {
    throw new Error('Could not resolve host page target.');
  }
  element.scrollIntoView?.({ block: 'center', inline: 'center' });
  if (isHtmlElement(element)) element.focus?.();
  const rect = getGlobalRect(element);
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const hitStack = getHitStack(center);
  let target = element;
  let point = isActionable(element)
    ? getReceivesEventsPoint(element)
    : undefined;
  let targetingStrategy = 'resolved_target';
  const hitTarget = hitStack[0];
  if (!point) {
    let current = element.parentElement;
    while (current && !point) {
      if (isActionable(current)) {
        const ancestorPoint = getReceivesEventsPoint(current);
        if (ancestorPoint) {
          target = current;
          point = ancestorPoint;
          targetingStrategy = 'ancestor_actionable';
          break;
        }
      }
      current = current.parentElement;
    }
  }
  if (!point) {
    const fallback = findSemanticVisibleFallback(element);
    if (fallback) {
      target = fallback.candidate;
      point = fallback.point;
      targetingStrategy = 'semantic_visible_fallback';
    }
  }
  if (!point) {
    throw new Error(
      `Target "${getName(element) ?? element.tagName.toLowerCase()}" is not receiving pointer events. Use host_page_screenshot or host_page_pointer coordinates.`,
    );
  }
  store.lastResolved = target;
  return {
    point,
    target: summarize(target),
    requested: summarize(element),
    targetingStrategy,
    actionability: {
      visible: rect.width > 0 && rect.height > 0,
      receivesEvents: Boolean(
        hitTarget &&
        (element === hitTarget ||
          element.contains(hitTarget)),
      ),
      hitTarget: hitTarget ? summarize(hitTarget) : undefined,
      hitStack: hitStack.slice(0, 5).map(summarize),
    },
  };
}

function pageResolveElementHandleScript(this: Element) {
  const element = this;
  const globalObject = globalThis as typeof globalThis & {
    __xpertaiChatKitHostAutomation?: {
      refs: Record<string, Element>;
      lastResolved?: Element;
    };
  };
  const store =
    globalObject.__xpertaiChatKitHostAutomation ??
    (globalObject.__xpertaiChatKitHostAutomation = { refs: {} });
  const getElementView = (target: Element) =>
    target.ownerDocument.defaultView ?? window;
  const isHtmlElement = (target: Element) => {
    const view = getElementView(target);
    return target instanceof view.HTMLElement;
  };
  const isSvgElement = (target: Element) => {
    const view = getElementView(target);
    return target instanceof view.SVGElement;
  };
  const isTag = (target: Element, tag: string) =>
    target.tagName.toLowerCase() === tag;
  const isInputElement = (target: Element): target is HTMLInputElement =>
    isTag(target, 'input');
  const isFrameElement = (target: Element): target is HTMLIFrameElement =>
    isTag(target, 'iframe');
  const getFrameDocument = (frame: Element) => {
    if (!isFrameElement(frame)) return null;
    try {
      return frame.contentDocument;
    } catch {
      return null;
    }
  };
  const getFrameOffset = (doc: Document) => {
    let x = 0;
    let y = 0;
    let view = doc.defaultView;
    while (view?.frameElement) {
      const frame = view.frameElement;
      const rect = frame.getBoundingClientRect();
      x += rect.left;
      y += rect.top;
      view = frame.ownerDocument.defaultView;
    }
    return { x, y };
  };
  const getGlobalRect = (target: Element) => {
    const rect = target.getBoundingClientRect();
    const offset = getFrameOffset(target.ownerDocument);
    return {
      x: rect.left + offset.x,
      y: rect.top + offset.y,
      width: rect.width,
      height: rect.height,
    };
  };
  const getText = (target: Element) =>
    (target.textContent ?? '').replace(/\s+/g, ' ').trim();
  const getRole = (target: Element) => {
    const explicit = target.getAttribute('role')?.trim();
    if (explicit) return explicit;
    const tag = target.tagName.toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'summary') return 'button';
    if (isInputElement(target)) {
      if (target.type === 'checkbox') return 'checkbox';
      if (target.type === 'radio') return 'radio';
      if (['button', 'submit', 'reset'].includes(target.type)) return 'button';
      return 'textbox';
    }
    return undefined;
  };
  const getName = (target: Element) =>
    target.getAttribute('aria-label')?.trim() ||
    target.getAttribute('title')?.trim() ||
    getText(target);
  const summarize = (target: Element) => ({
    tag: target.tagName.toLowerCase(),
    role: getRole(target),
    name: getName(target),
  });
  const isActionable = (target: Element) => {
    if (!(isHtmlElement(target) || isSvgElement(target))) return false;
    const style = getElementView(target).getComputedStyle(target);
    if (style.cursor === 'pointer') return true;
    return Boolean(
      target.matches(
        [
          'a[href]',
          'button',
          'input',
          'textarea',
          'select',
          'summary',
          '[role="button"]',
          '[role="link"]',
          '[role="menuitem"]',
          '[role="tab"]',
          '[role="option"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[contenteditable=""]',
          '[contenteditable="true"]',
        ].join(','),
      ) ||
      (isHtmlElement(target) && target.onclick),
    );
  };
  const getDeepHitStack = (
    point: { x: number; y: number },
    doc: Document = document,
  ): Element[] => {
    const offset = getFrameOffset(doc);
    const localX = point.x - offset.x;
    const localY = point.y - offset.y;
    const stack =
      typeof doc.elementsFromPoint === 'function'
        ? doc.elementsFromPoint(localX, localY)
        : ([doc.elementFromPoint(localX, localY)].filter(Boolean) as Element[]);
    const result: Element[] = [];
    for (const hit of stack) {
      const childDocument = getFrameDocument(hit);
      if (childDocument) {
        result.push(...getDeepHitStack(point, childDocument));
      }
      result.push(hit);
    }
    return result;
  };
  const containsOrEquals = (parent: Element, child: Element) =>
    parent === child || parent.contains(child);
  const getReceivesEventsPoint = (target: Element) => {
    const rect = getGlobalRect(target);
    if (rect.width <= 0 || rect.height <= 0) return undefined;
    const insetX = Math.min(8, rect.width / 2);
    const insetY = Math.min(8, rect.height / 2);
    const points = [
      { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      { x: rect.x + insetX, y: rect.y + rect.height / 2 },
      { x: rect.x + rect.width - insetX, y: rect.y + rect.height / 2 },
      { x: rect.x + rect.width / 2, y: rect.y + insetY },
      { x: rect.x + rect.width / 2, y: rect.y + rect.height - insetY },
    ];
    return points.find((point) => {
      const hitTarget = getDeepHitStack(point)[0];
      return hitTarget ? containsOrEquals(target, hitTarget) : false;
    });
  };

  let target = element;
  let point = isActionable(target) ? getReceivesEventsPoint(target) : undefined;
  let targetingStrategy = 'ax_resolved_target';
  let current = element.parentElement;
  while (!point && current) {
    if (isActionable(current)) {
      const ancestorPoint = getReceivesEventsPoint(current);
      if (ancestorPoint) {
        target = current;
        point = ancestorPoint;
        targetingStrategy = 'ax_ancestor_actionable';
        break;
      }
    }
    current = current.parentElement;
  }

  const rect = getGlobalRect(element);
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  if (!point) {
    point = center;
    targetingStrategy = 'ax_center_fallback';
  }
  const hitStack = getDeepHitStack(point);
  const hitTarget = hitStack[0];
  store.lastResolved = target;
  return {
    point,
    target: summarize(target),
    requested: summarize(element),
    targetingStrategy,
    actionability: {
      visible: rect.width > 0 && rect.height > 0,
      receivesEvents: Boolean(
        hitTarget &&
        (target === hitTarget ||
          target.contains(hitTarget)),
      ),
      hitTarget: hitTarget ? summarize(hitTarget) : undefined,
      hitStack: hitStack.slice(0, 5).map(summarize),
    },
  };
}

function pageMeasureLastResolvedTargetScript() {
  const isInputElement = (target: Element): target is HTMLInputElement =>
    target.tagName.toLowerCase() === 'input';
  const isFrameElement = (target: Element): target is HTMLIFrameElement =>
    target.tagName.toLowerCase() === 'iframe';
  const getFrameDocument = (frame: Element) => {
    if (!isFrameElement(frame)) return null;
    try {
      return frame.contentDocument;
    } catch {
      return null;
    }
  };
  const getFrameOffset = (doc: Document) => {
    let x = 0;
    let y = 0;
    let view = doc.defaultView;
    while (view?.frameElement) {
      const frame = view.frameElement;
      const rect = frame.getBoundingClientRect();
      x += rect.left;
      y += rect.top;
      view = frame.ownerDocument.defaultView;
    }
    return { x, y };
  };
  const getGlobalRect = (target: Element) => {
    const rect = target.getBoundingClientRect();
    const offset = getFrameOffset(target.ownerDocument);
    return {
      x: rect.left + offset.x,
      y: rect.top + offset.y,
      width: rect.width,
      height: rect.height,
    };
  };
  const getText = (target: Element) =>
    (target.textContent ?? '').replace(/\s+/g, ' ').trim();
  const getRole = (target: Element) => {
    const explicit = target.getAttribute('role')?.trim();
    if (explicit) return explicit;
    const tag = target.tagName.toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'summary') return 'button';
    if (isInputElement(target)) {
      if (target.type === 'checkbox') return 'checkbox';
      if (target.type === 'radio') return 'radio';
      if (['button', 'submit', 'reset'].includes(target.type)) return 'button';
      return 'textbox';
    }
    return undefined;
  };
  const getName = (target: Element) =>
    target.getAttribute('aria-label')?.trim() ||
    target.getAttribute('title')?.trim() ||
    getText(target);
  const summarize = (target: Element) => ({
    tag: target.tagName.toLowerCase(),
    role: getRole(target),
    name: getName(target),
  });
  const getDeepHitStack = (
    point: { x: number; y: number },
    doc: Document = document,
  ): Element[] => {
    const offset = getFrameOffset(doc);
    const localX = point.x - offset.x;
    const localY = point.y - offset.y;
    const stack =
      typeof doc.elementsFromPoint === 'function'
        ? doc.elementsFromPoint(localX, localY)
        : ([doc.elementFromPoint(localX, localY)].filter(Boolean) as Element[]);
    const result: Element[] = [];
    for (const hit of stack) {
      const childDocument = getFrameDocument(hit);
      if (childDocument) {
        result.push(...getDeepHitStack(point, childDocument));
      }
      result.push(hit);
    }
    return result;
  };
  const containsOrEquals = (parent: Element, child: Element) =>
    parent === child || parent.contains(child);
  const globalObject = globalThis as typeof globalThis & {
    __xpertaiChatKitHostAutomation?: {
      lastResolved?: Element;
    };
  };
  const target = globalObject.__xpertaiChatKitHostAutomation?.lastResolved;
  if (!target) {
    throw new Error('No resolved host page target to measure.');
  }

  const rect = getGlobalRect(target);
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const insetX = Math.min(8, rect.width / 2);
  const insetY = Math.min(8, rect.height / 2);
  const candidates =
    rect.width > 0 && rect.height > 0
      ? [
          center,
          { x: rect.x + insetX, y: center.y },
          { x: rect.x + rect.width - insetX, y: center.y },
          { x: center.x, y: rect.y + insetY },
          { x: center.x, y: rect.y + rect.height - insetY },
        ]
      : [center];
  const point =
    candidates.find((candidate) => {
      const hitTarget = getDeepHitStack(candidate)[0];
      return hitTarget ? containsOrEquals(target, hitTarget) : false;
    }) ?? center;
  const hitStack = getDeepHitStack(point);
  const hitTarget = hitStack[0];
  return {
    point,
    target: summarize(target),
    actionability: {
      visible: rect.width > 0 && rect.height > 0,
      receivesEvents: Boolean(
        hitTarget &&
          (target === hitTarget ||
            target.contains(hitTarget)),
      ),
      hitTarget: hitTarget ? summarize(hitTarget) : undefined,
      hitStack: hitStack.slice(0, 5).map(summarize),
    },
  };
}

function pageFillScript(rawArgs: unknown) {
  const params =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};
  const isTag = (element: Element, tag: string) =>
    element.tagName.toLowerCase() === tag;
  const isInputElement = (element: Element): element is HTMLInputElement =>
    isTag(element, 'input');
  const isTextAreaElement = (
    element: Element,
  ): element is HTMLTextAreaElement => isTag(element, 'textarea');
  const isHtmlElement = (element: Element) => {
    const view = element.ownerDocument.defaultView ?? window;
    return element instanceof view.HTMLElement;
  };
  const summarize = (element: Element) => ({
    tag: element.tagName.toLowerCase(),
    name:
      element.getAttribute('aria-label')?.trim() ||
      element.getAttribute('title')?.trim() ||
      (element.textContent ?? '').replace(/\s+/g, ' ').trim() ||
      undefined,
  });
  const value = typeof params.value === 'string' ? params.value : '';
  const store = (
    globalThis as typeof globalThis & {
      __xpertaiChatKitHostAutomation?: {
        refs: Record<string, Element>;
        lastResolved?: Element;
      };
    }
  ).__xpertaiChatKitHostAutomation;
  const target = store?.lastResolved
    ? undefined
    : (pageResolveTargetScript(params) as {
        requested?: { tag?: string; name?: string };
        target?: { tag?: string; name?: string };
      });
  const element =
    store?.lastResolved ??
    (typeof params.ref === 'string' && store?.refs[params.ref]
      ? store.refs[params.ref]
      : typeof params.selector === 'string'
        ? document.querySelector(params.selector)
        : document.activeElement);
  if (element && (isInputElement(element) || isTextAreaElement(element))) {
    const view = element.ownerDocument.defaultView ?? window;
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      'value',
    );
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new view.Event('input', { bubbles: true }));
    element.dispatchEvent(new view.Event('change', { bubbles: true }));
    return { filled: target?.requested ?? summarize(element), value };
  }
  if (element && isHtmlElement(element) && element.isContentEditable) {
    const view = element.ownerDocument.defaultView ?? window;
    element.textContent = value;
    element.dispatchEvent(new view.Event('input', { bubbles: true }));
    element.dispatchEvent(new view.Event('change', { bubbles: true }));
    return { filled: target?.requested ?? summarize(element), value };
  }
  throw new Error('Target element cannot be filled.');
}

function pageSelectScript(rawArgs: unknown) {
  const params =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};
  const isSelectElement = (element: Element): element is HTMLSelectElement =>
    element.tagName.toLowerCase() === 'select';
  const values = Array.isArray(params.values)
    ? params.values.filter((value) => typeof value === 'string')
    : typeof params.value === 'string'
      ? [params.value]
      : [];
  const store = (
    globalThis as typeof globalThis & {
      __xpertaiChatKitHostAutomation?: {
        lastResolved?: Element;
      };
    }
  ).__xpertaiChatKitHostAutomation;
  if (!store?.lastResolved) {
    pageResolveTargetScript(params);
  }
  const element =
    store?.lastResolved ??
    (typeof params.selector === 'string'
      ? document.querySelector(params.selector)
      : document.activeElement);
  if (!element || !isSelectElement(element)) {
    throw new Error('Target element is not a select.');
  }
  const valueSet = new Set(values);
  Array.from(element.options).forEach((option) => {
    option.selected = valueSet.has(option.value);
  });
  const view = element.ownerDocument.defaultView ?? window;
  element.dispatchEvent(new view.Event('input', { bubbles: true }));
  element.dispatchEvent(new view.Event('change', { bubbles: true }));
  return {
    selected: Array.from(element.selectedOptions).map((option) => option.value),
  };
}

function pageScrollScript(rawArgs: unknown) {
  const params =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};
  const isHtmlElement = (element: Element) => {
    const view = element.ownerDocument.defaultView ?? window;
    return element instanceof view.HTMLElement;
  };
  const deltaX = typeof params.deltaX === 'number' ? params.deltaX : 0;
  const deltaY = typeof params.deltaY === 'number' ? params.deltaY : 0;
  const x = typeof params.x === 'number' ? params.x : undefined;
  const y = typeof params.y === 'number' ? params.y : undefined;
  const hasTarget =
    typeof params.ref === 'string' ||
    typeof params.selector === 'string' ||
    typeof params.role === 'string' ||
    typeof params.name === 'string' ||
    typeof params.text === 'string' ||
    typeof params.testId === 'string';
  if (hasTarget) {
    pageResolveTargetScript(params);
    const store = (
      globalThis as typeof globalThis & {
        __xpertaiChatKitHostAutomation?: {
          lastResolved?: Element;
        };
      }
    ).__xpertaiChatKitHostAutomation;
    const element =
      store?.lastResolved ??
      (typeof params.selector === 'string'
        ? document.querySelector(params.selector)
        : document.activeElement);
    if (!element || !isHtmlElement(element)) {
      throw new Error('Target element cannot be scrolled.');
    }
    if (typeof x === 'number' || typeof y === 'number') {
      element.scrollTo(x ?? element.scrollLeft, y ?? element.scrollTop);
    } else {
      element.scrollBy(deltaX, deltaY);
    }
    return { scroll: { x: element.scrollLeft, y: element.scrollTop } };
  }
  if (typeof x === 'number' || typeof y === 'number') {
    scrollTo(x ?? scrollX, y ?? scrollY);
  } else {
    scrollBy(deltaX, deltaY);
  }
  return { scroll: { x: scrollX, y: scrollY } };
}

function pageFocusScript(rawArgs: unknown) {
  const target = pageResolveTargetScript(rawArgs) as { target?: unknown };
  return { focused: target.target };
}

function pageWaitForScript(rawArgs: unknown) {
  const params =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};
  const timeoutMs = Math.max(
    0,
    Math.min(
      60_000,
      (typeof params.timeoutSeconds === 'number' ? params.timeoutSeconds : 10) *
        1_000,
    ),
  );
  const state =
    typeof params.state === 'string' &&
    ['attached', 'visible', 'hidden', 'detached'].includes(params.state)
      ? params.state
      : 'visible';
  const startedAt = Date.now();
  const isVisible = (element: Element) => {
    const rect = element.getBoundingClientRect();
    const view = element.ownerDocument.defaultView ?? window;
    const style = view.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  };

  return new Promise((resolve, reject) => {
    const tick = () => {
      let element: Element | null = null;
      try {
        const resolved = pageResolveTargetScript(params) as {
          target?: { tag?: string; name?: string };
        };
        void resolved;
        const store = (
          globalThis as typeof globalThis & {
            __xpertaiChatKitHostAutomation?: {
              lastResolved?: Element;
            };
          }
        ).__xpertaiChatKitHostAutomation;
        element =
          store?.lastResolved ??
          (typeof params.selector === 'string'
            ? document.querySelector(params.selector)
            : document.activeElement);
      } catch {
        element = null;
      }
      const matched =
        state === 'attached'
          ? Boolean(element)
          : state === 'detached'
            ? !element
            : state === 'hidden'
              ? !element || !isVisible(element)
              : Boolean(element && isVisible(element));
      if (matched) {
        resolve({ waitedFor: state, elapsedMs: Date.now() - startedAt });
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for target to become ${state}.`));
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

function getKeyDefinition(key: string) {
  const specialKeys: Record<string, number> = {
    Enter: 13,
    Escape: 27,
    Tab: 9,
    Backspace: 8,
    Delete: 46,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
    Home: 36,
    End: 35,
    PageUp: 33,
    PageDown: 34,
    Space: 32,
    ' ': 32,
  };
  const code =
    specialKeys[key] ??
    (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
  return {
    key: key === 'Space' ? ' ' : key,
    code,
    text: key.length === 1 ? key : undefined,
  };
}

function pageViewportMetricsScript() {
  return {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    devicePixelRatio: window.devicePixelRatio,
    scroll: {
      x: window.scrollX,
      y: window.scrollY,
    },
  };
}

function pageHitTestScript(rawArgs: unknown) {
  const args =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as { x?: unknown; y?: unknown })
      : {};
  const x = typeof args.x === 'number' ? args.x : undefined;
  const y = typeof args.y === 'number' ? args.y : undefined;
  const isFrameElement = (element: Element): element is HTMLIFrameElement =>
    element.tagName.toLowerCase() === 'iframe';
  const getFrameDocument = (frame: Element) => {
    if (!isFrameElement(frame)) return null;
    try {
      return frame.contentDocument;
    } catch {
      return null;
    }
  };
  const getFrameOffset = (doc: Document) => {
    let offsetX = 0;
    let offsetY = 0;
    let view = doc.defaultView;
    while (view?.frameElement) {
      const frame = view.frameElement;
      const rect = frame.getBoundingClientRect();
      offsetX += rect.left;
      offsetY += rect.top;
      view = frame.ownerDocument.defaultView;
    }
    return { x: offsetX, y: offsetY };
  };
  const getRole = (element: Element) => {
    const explicit = element.getAttribute('role')?.trim();
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'input') {
      const input = element as HTMLInputElement;
      if (input.type === 'checkbox') return 'checkbox';
      if (input.type === 'radio') return 'radio';
      if (['button', 'submit', 'reset'].includes(input.type)) return 'button';
      return 'textbox';
    }
    return undefined;
  };
  const summarize = (element: Element) => ({
    tag: element.tagName.toLowerCase(),
    role: getRole(element),
    name:
      element.getAttribute('aria-label')?.trim() ||
      element.getAttribute('title')?.trim() ||
      (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 180) ||
      undefined,
  });
  const getDeepHitStack = (
    point: { x: number; y: number },
    doc: Document = document,
  ): Element[] => {
    const offset = getFrameOffset(doc);
    const localX = point.x - offset.x;
    const localY = point.y - offset.y;
    const stack =
      typeof doc.elementsFromPoint === 'function'
        ? doc.elementsFromPoint(localX, localY)
        : ([doc.elementFromPoint(localX, localY)].filter(Boolean) as Element[]);
    const result: Element[] = [];
    for (const hit of stack) {
      const childDocument = getFrameDocument(hit);
      if (childDocument) {
        result.push(...getDeepHitStack(point, childDocument));
      }
      result.push(hit);
    }
    return result;
  };

  if (x === undefined || y === undefined) {
    return {
      coordinateSpace: 'viewport-css-px',
      hitTarget: undefined,
      hitStack: [],
    };
  }

  const hitStack = getDeepHitStack({ x, y });

  return {
    coordinateSpace: 'viewport-css-px',
    hitTarget: hitStack[0] ? summarize(hitStack[0]) : undefined,
    hitStack: hitStack.slice(0, 8).map(summarize),
  };
}

async function executeSnapshot(
  sendCommand: ChromeDebuggerApi['sendCommand'],
  tabId: number,
  params: Record<string, unknown>,
) {
  await sendCdpCommand(sendCommand, tabId, 'Runtime.enable').catch(
    () => undefined,
  );
  const snapshot = await evaluatePageScript(
    sendCommand,
    tabId,
    pageSnapshotScript,
    [params],
    [pageReadableContentScript],
  );
  const [axTree, domSnapshot] = await Promise.all([
    sendCdpCommand(sendCommand, tabId, 'Accessibility.getFullAXTree').catch(
      (error) => ({ error: getErrorMessage(error) }),
    ),
    sendCdpCommand(sendCommand, tabId, 'DOMSnapshot.captureSnapshot', {
      computedStyles: [
        'display',
        'visibility',
        'pointer-events',
        'opacity',
        'cursor',
      ],
    }).catch((error) => ({ error: getErrorMessage(error) })),
  ]);

  return {
    ...(snapshot && typeof snapshot === 'object' ? snapshot : {}),
    accessibility: summarizeAxTree(axTree),
    cdp: {
      domSnapshot: summarizeDomSnapshot(domSnapshot),
    },
  };
}

function readBackendDomNodeIdFromAxTree(value: unknown, axRef: string) {
  const tree = value as CdpAxTree;
  const numericRef = Number(axRef);
  const node = (tree.nodes ?? []).find((candidate) => {
    if (String(candidate.nodeId) === axRef) {
      return true;
    }
    return (
      Number.isFinite(numericRef) && candidate.backendDOMNodeId === numericRef
    );
  });
  return typeof node?.backendDOMNodeId === 'number'
    ? node.backendDOMNodeId
    : undefined;
}

async function resolveAccessibilityRefPoint(
  sendCommand: ChromeDebuggerApi['sendCommand'],
  tabId: number,
  axRef: string,
) {
  const axTree = await sendCdpCommand(
    sendCommand,
    tabId,
    'Accessibility.getFullAXTree',
  );
  const backendNodeId = readBackendDomNodeIdFromAxTree(axTree, axRef);
  if (backendNodeId === undefined) {
    throw new Error(
      `Unknown accessibility ref: ${axRef}. Take a new snapshot.`,
    );
  }

  const resolvedNode = (await sendCdpCommand(
    sendCommand,
    tabId,
    'DOM.resolveNode',
    { backendNodeId },
  )) as CdpResolvedNode;
  const objectId = resolvedNode.object?.objectId;
  if (typeof objectId !== 'string' || !objectId) {
    throw new Error(`Could not resolve accessibility ref: ${axRef}.`);
  }

  try {
    const evaluation = await sendCdpCommand(
      sendCommand,
      tabId,
      'Runtime.callFunctionOn',
      {
        objectId,
        functionDeclaration: pageResolveElementHandleScript.toString(),
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      },
    );
    return getEvaluationValue(evaluation);
  } finally {
    await sendCdpCommand(sendCommand, tabId, 'Runtime.releaseObject', {
      objectId,
    }).catch(() => undefined);
  }
}

async function resolvePoint(
  sendCommand: ChromeDebuggerApi['sendCommand'],
  tabId: number,
  params: Record<string, unknown>,
): Promise<CdpResolvedPoint> {
  const axRef = readParamRef(params, 'axRef');
  const ref = readParamRef(params, 'ref');
  if (axRef && !ref && !axRef.startsWith('e')) {
    return resolveAccessibilityRefPoint(
      sendCommand,
      tabId,
      axRef,
    ) as Promise<CdpResolvedPoint>;
  }

  return evaluatePageScript(sendCommand, tabId, pageResolveTargetScript, [
    params,
  ]) as Promise<CdpResolvedPoint>;
}

function getMouseButton(value: unknown): 'left' | 'middle' | 'right' {
  return value === 'middle' || value === 'right' ? value : 'left';
}

function getClickCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(3, Math.floor(value)))
    : 1;
}

async function showCdpVisualEffect(
  sendCommand: ChromeDebuggerApi['sendCommand'],
  tabId: number,
  args: Record<string, unknown>,
) {
  await evaluatePageScript(sendCommand, tabId, showHostAutomationEffect, [
    args,
  ]).catch(() => undefined);
}

function isCdpResolvedPoint(value: unknown): value is CdpResolvedPoint {
  const point = getObjectField(value, 'point');
  return (
    getFiniteNumber(point?.x) !== undefined &&
    getFiniteNumber(point?.y) !== undefined
  );
}

async function resolvePointAfterEffect(
  sendCommand: ChromeDebuggerApi['sendCommand'],
  tabId: number,
  fallback: CdpResolvedPoint,
): Promise<CdpResolvedPoint> {
  return evaluatePageScript(
    sendCommand,
    tabId,
    pageMeasureLastResolvedTargetScript,
  )
    .then((value) => (isCdpResolvedPoint(value) ? value : fallback))
    .catch(() => fallback);
}

async function dispatchMouseClick(
  sendCommand: ChromeDebuggerApi['sendCommand'],
  tabId: number,
  point: { x: number; y: number },
  options: { button: 'left' | 'middle' | 'right'; clickCount: number },
) {
  await sendCdpCommand(sendCommand, tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: point.x,
    y: point.y,
  });

  for (let index = 1; index <= options.clickCount; index += 1) {
    await sendCdpCommand(sendCommand, tabId, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: point.x,
      y: point.y,
      button: options.button,
      clickCount: index,
    });
    await sendCdpCommand(sendCommand, tabId, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: point.x,
      y: point.y,
      button: options.button,
      clickCount: index,
    });
  }
}

async function getPointHitTest(
  sendCommand: ChromeDebuggerApi['sendCommand'],
  tabId: number,
  point: { x: number; y: number },
): Promise<HitTestInfo> {
  const fallback: HitTestInfo = {
    coordinateSpace: 'viewport-css-px',
    hitTarget: undefined,
    hitStack: [],
  };
  const value = await evaluatePageScript(
    sendCommand,
    tabId,
    pageHitTestScript,
    [point],
  ).catch(() => undefined);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const hitTarget = (value as Record<string, unknown>).hitTarget;
  const hitStack = (value as Record<string, unknown>).hitStack;
  return {
    coordinateSpace: 'viewport-css-px',
    ...(hitTarget === undefined ? {} : { hitTarget }),
    hitStack: Array.isArray(hitStack) ? hitStack : [],
  };
}

export async function runCdpHostAutomation(
  api: ChromeCdpAutomationApi,
  tab: CdpAutomationTab,
  call: HostPageAutomationClientToolCall,
): Promise<ClientToolMessageInput> {
  if (!HOST_PAGE_TOOL_NAME_SET.has(call.name)) {
    return createToolMessage(call, 'error', {
      ok: false,
      error: `Unknown host page automation tool: ${call.name}`,
    });
  }

  if (typeof tab.id !== 'number') {
    throw new Error('Missing tab id for CDP host automation.');
  }

  try {
    const result = await withDebuggerSession(
      api,
      tab.id,
      async (sendCommand) => {
        const params = normalizeParams(call.params);
        switch (call.name) {
          case 'host_page_snapshot':
            return executeSnapshot(sendCommand, tab.id, params);
          case 'host_page_read':
            return evaluatePageScript(
              sendCommand,
              tab.id,
              pageReadableContentScript,
              [{ ...params, mode: 'read' }],
            );
          case 'host_page_click': {
            const resolved = await resolvePoint(sendCommand, tab.id, params);
            const button = getMouseButton(params.button);
            const clickCount = getClickCount(params.clickCount);
            await showCdpVisualEffect(sendCommand, tab.id, {
              type: 'click',
              anchor: 'target',
            });
            const latest = await resolvePointAfterEffect(
              sendCommand,
              tab.id,
              resolved,
            );
            await dispatchMouseClick(sendCommand, tab.id, latest.point, {
              button,
              clickCount,
            });
            return {
              clicked: latest.target ?? resolved.target,
              requested: latest.requested ?? resolved.requested,
              point: latest.point,
              button,
              clickCount,
              strategy: 'cdp_mouse',
              coordinateSpace: 'viewport-css-px',
              actionability: latest.actionability ?? resolved.actionability,
            };
          }
          case 'host_page_hover': {
            const resolved = await resolvePoint(sendCommand, tab.id, params);
            await showCdpVisualEffect(sendCommand, tab.id, {
              type: 'hover',
              anchor: 'target',
            });
            const latest = await resolvePointAfterEffect(
              sendCommand,
              tab.id,
              resolved,
            );
            await sendCdpCommand(
              sendCommand,
              tab.id,
              'Input.dispatchMouseEvent',
              {
                type: 'mouseMoved',
                x: latest.point.x,
                y: latest.point.y,
              },
            );
            return {
              hovered: latest.target ?? resolved.target,
              point: latest.point,
              strategy: 'cdp_mouse',
            };
          }
          case 'host_page_press': {
            await evaluatePageScript(sendCommand, tab.id, pageFocusScript, [
              params,
            ]).catch(() => undefined);
            const key = typeof params.key === 'string' ? params.key : '';
            if (!key) {
              throw new Error('key must be a non-empty string.');
            }
            const keyDef = getKeyDefinition(key);
            await showCdpVisualEffect(sendCommand, tab.id, {
              type: 'press',
              key,
              anchor: 'target',
            });
            await sendCdpCommand(
              sendCommand,
              tab.id,
              'Input.dispatchKeyEvent',
              {
                type: 'keyDown',
                key: keyDef.key,
                windowsVirtualKeyCode: keyDef.code,
                nativeVirtualKeyCode: keyDef.code,
                text: keyDef.text,
              },
            );
            await sendCdpCommand(
              sendCommand,
              tab.id,
              'Input.dispatchKeyEvent',
              {
                type: 'keyUp',
                key: keyDef.key,
                windowsVirtualKeyCode: keyDef.code,
                nativeVirtualKeyCode: keyDef.code,
              },
            );
            return { pressed: key, strategy: 'cdp_keyboard' };
          }
          case 'host_page_pointer': {
            const action =
              typeof params.action === 'string' ? params.action : 'click';
            const button = getMouseButton(params.button);
            const clickCount = getClickCount(params.clickCount);
            const hasExplicitPoint =
              typeof params.x === 'number' && typeof params.y === 'number';
            const targetText =
              typeof params.targetText === 'string' && params.targetText.trim()
                ? params.targetText.trim()
                : undefined;
            if (
              action === 'click' &&
              hasExplicitPoint &&
              !targetText
            ) {
              throw new Error(
                'Pointer coordinate clicks require targetText to avoid unintended navigation.',
              );
            }
            const needsPagePointResolution =
              params.coordinateSpace === 'viewport_normalized' ||
              Boolean(targetText);
            const normalizedPoint =
              hasExplicitPoint && needsPagePointResolution
                ? await evaluatePageScript(
                    sendCommand,
                    tab.id,
                    pageNormalizePointerPointScript,
                    [params],
                  )
                : undefined;
            if (
              normalizedPoint &&
              typeof normalizedPoint === 'object' &&
              'targetTextMatched' in normalizedPoint &&
              (normalizedPoint as { targetTextMatched?: boolean })
                .targetTextMatched === false
            ) {
              throw new Error(
                `Pointer target text mismatch: expected hit target to contain "${targetText}".`,
              );
            }
            const resolved: CdpResolvedPoint = hasExplicitPoint
              ? {
                  point:
                    normalizedPoint &&
                    typeof normalizedPoint === 'object' &&
                    'point' in normalizedPoint
                      ? (
                          normalizedPoint as {
                            point: { x: number; y: number };
                          }
                        ).point
                      : { x: params.x as number, y: params.y as number },
                }
              : await resolvePoint(sendCommand, tab.id, params);
            const eventMap: Record<string, string[]> = {
              move: ['mouseMoved'],
              down: ['mousePressed'],
              up: ['mouseReleased'],
              click: ['mouseMoved', 'mousePressed', 'mouseReleased'],
            };
            const events = eventMap[action] ?? eventMap.click;
            let latest = resolved;
            if (action === 'click') {
              await showCdpVisualEffect(sendCommand, tab.id, {
                type: 'click',
                ...(hasExplicitPoint
                  ? { point: resolved.point, anchor: 'point' }
                  : { anchor: 'target' }),
              });
              latest = hasExplicitPoint
                ? resolved
                : await resolvePointAfterEffect(
                    sendCommand,
                    tab.id,
                    resolved,
                  );
              await dispatchMouseClick(sendCommand, tab.id, latest.point, {
                button,
                clickCount,
              });
            } else {
              await showCdpVisualEffect(sendCommand, tab.id, {
                type: 'pointer',
                action,
                ...(hasExplicitPoint
                  ? { point: resolved.point, anchor: 'point' }
                  : { anchor: 'target' }),
              });
              latest = hasExplicitPoint
                ? resolved
                : await resolvePointAfterEffect(
                    sendCommand,
                    tab.id,
                    resolved,
                  );
              for (const type of events) {
                await sendCdpCommand(
                  sendCommand,
                  tab.id,
                  'Input.dispatchMouseEvent',
                  {
                    type,
                    x: latest.point.x,
                    y: latest.point.y,
                    button: type === 'mouseMoved' ? 'none' : button,
                    clickCount: type === 'mouseMoved' ? 0 : clickCount,
                  },
                );
              }
            }
            const hitTest = await getPointHitTest(
              sendCommand,
              tab.id,
              latest.point,
            );
            const expectedAfterClick =
              action === 'click'
                ? await evaluatePageScript(
                    sendCommand,
                    tab.id,
                    pageExpectedAfterClickScript,
                    [params],
                  ).catch(() => undefined)
                : undefined;
            return {
              pointer: action,
              point: latest.point,
              button,
              clickCount,
              strategy: 'cdp_mouse',
              targetTextMatched:
                normalizedPoint &&
                typeof normalizedPoint === 'object' &&
                'targetTextMatched' in normalizedPoint
                  ? (
                      normalizedPoint as {
                        targetTextMatched?: boolean;
                      }
                    ).targetTextMatched
                  : undefined,
              expectedAfterClick,
              ...hitTest,
            };
          }
          case 'host_page_fill': {
            await resolvePoint(sendCommand, tab.id, params);
            await showCdpVisualEffect(sendCommand, tab.id, {
              type: 'fill',
              anchor: 'target',
              value: typeof params.value === 'string' ? params.value : '',
            });
            return evaluatePageScript(sendCommand, tab.id, pageFillScript, [
              params,
            ]);
          }
          case 'host_page_select': {
            await resolvePoint(sendCommand, tab.id, params);
            const values = Array.isArray(params.values)
              ? params.values.filter((value) => typeof value === 'string')
              : typeof params.value === 'string'
                ? [params.value]
                : [];
            await showCdpVisualEffect(sendCommand, tab.id, {
              type: 'select',
              anchor: 'target',
              values,
            });
            return evaluatePageScript(sendCommand, tab.id, pageSelectScript, [
              params,
            ]);
          }
          case 'host_page_scroll': {
            const hasTarget =
              typeof params.ref === 'string' ||
              typeof params.selector === 'string' ||
              typeof params.role === 'string' ||
              typeof params.name === 'string' ||
              typeof params.text === 'string' ||
              typeof params.testId === 'string';
            if (
              !hasTarget &&
              (typeof params.deltaX === 'number' ||
                typeof params.deltaY === 'number')
            ) {
              await showCdpVisualEffect(sendCommand, tab.id, {
                type: 'scroll',
                point: {
                  x: typeof params.x === 'number' ? params.x : 10,
                  y: typeof params.y === 'number' ? params.y : 10,
                },
                deltaX: typeof params.deltaX === 'number' ? params.deltaX : 0,
                deltaY: typeof params.deltaY === 'number' ? params.deltaY : 0,
              });
              await sendCdpCommand(
                sendCommand,
                tab.id,
                'Input.dispatchMouseEvent',
                {
                  type: 'mouseWheel',
                  x: typeof params.x === 'number' ? params.x : 10,
                  y: typeof params.y === 'number' ? params.y : 10,
                  deltaX: typeof params.deltaX === 'number' ? params.deltaX : 0,
                  deltaY: typeof params.deltaY === 'number' ? params.deltaY : 0,
                },
              );
              return { scrolled: 'page', strategy: 'cdp_mouse_wheel' };
            }
            const resolved = hasTarget
              ? await resolvePoint(sendCommand, tab.id, params)
              : null;
            await showCdpVisualEffect(sendCommand, tab.id, {
              type: 'scroll',
              ...(resolved ? { anchor: 'target' } : {}),
              deltaX: typeof params.deltaX === 'number' ? params.deltaX : 0,
              deltaY: typeof params.deltaY === 'number' ? params.deltaY : 0,
            });
            return evaluatePageScript(sendCommand, tab.id, pageScrollScript, [
              params,
            ]);
          }
          case 'host_page_navigate': {
            const rawUrl = typeof params.url === 'string' ? params.url : '';
            const nextUrl = new URL(rawUrl, tab.url);
            if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
              throw new Error('Navigation only supports HTTP(S) URLs.');
            }
            await sendCdpCommand(sendCommand, tab.id, 'Page.navigate', {
              url: nextUrl.toString(),
            });
            return { navigated: nextUrl.toString(), strategy: 'cdp_page' };
          }
          case 'host_page_focus': {
            await resolvePoint(sendCommand, tab.id, params);
            await showCdpVisualEffect(sendCommand, tab.id, {
              type: 'focus',
              anchor: 'target',
            });
            return evaluatePageScript(sendCommand, tab.id, pageFocusScript, [
              params,
            ]);
          }
          case 'host_page_screenshot': {
            const format = params.format === 'png' ? 'png' : 'jpeg';
            const quality =
              typeof params.quality === 'number'
                ? Math.max(1, Math.min(100, Math.floor(params.quality)))
                : 60;
            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            const [layoutMetrics, pageMetrics, screenshot] = await Promise.all([
              sendCdpCommand(
                sendCommand,
                tab.id,
                'Page.getLayoutMetrics',
              ).catch(() => undefined),
              evaluatePageScript(
                sendCommand,
                tab.id,
                pageViewportMetricsScript,
              ).catch(() => undefined),
              sendCdpCommand(sendCommand, tab.id, 'Page.captureScreenshot', {
                format,
                quality: format === 'jpeg' ? quality : undefined,
                fromSurface: true,
              }) as Promise<{ data?: unknown }>,
            ]);
            const data =
              typeof screenshot.data === 'string' ? screenshot.data : '';
            const imageSize = parseImageSize(data, mimeType);
            const pageViewport =
              pageMetrics && typeof pageMetrics === 'object'
                ? getViewportSize(
                    (pageMetrics as Record<string, unknown>).viewport,
                  )
                : undefined;
            const viewport =
              readViewportFromLayoutMetrics(layoutMetrics) ?? pageViewport;
            const scroll =
              pageMetrics && typeof pageMetrics === 'object'
                ? getScrollOffset(
                    (pageMetrics as Record<string, unknown>).scroll,
                  )
                : undefined;
            const devicePixelRatio =
              pageMetrics && typeof pageMetrics === 'object'
                ? getFiniteNumber(
                    (pageMetrics as Record<string, unknown>).devicePixelRatio,
                  )
                : undefined;
            await showCdpVisualEffect(sendCommand, tab.id, {
              type: 'screenshot',
            });
            return {
              mimeType,
              data,
              ...(viewport ? { viewport } : {}),
              ...(imageSize ? { imageSize } : {}),
              ...(devicePixelRatio === undefined ? {} : { devicePixelRatio }),
              ...(scroll ? { scroll } : {}),
              coordinateSpace: 'viewport-css-px',
            };
          }
          case 'host_page_wait_for': {
            const resolved = await resolvePoint(
              sendCommand,
              tab.id,
              params,
            ).catch(() => null);
            await showCdpVisualEffect(sendCommand, tab.id, {
              type: 'wait_for',
              state:
                params.state === 'attached' ||
                params.state === 'hidden' ||
                params.state === 'detached'
                  ? params.state
                  : 'visible',
              ...(resolved ? { anchor: 'target' } : {}),
            });
            return evaluatePageScript(sendCommand, tab.id, pageWaitForScript, [
              params,
            ]);
          }
        }
      },
    );

    if (call.name === 'host_page_screenshot') {
      const screenshot = createScreenshotToolContent(result);
      return createToolMessage(
        call,
        'success',
        screenshot.content,
        screenshot.artifact,
      );
    }

    return createToolMessage(call, 'success', { ok: true, result });
  } catch (error) {
    return createToolMessage(call, 'error', {
      ok: false,
      error: getErrorMessage(error),
    });
  }
}
