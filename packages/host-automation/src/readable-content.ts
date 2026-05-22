import type {
  HostPageReadableContent,
  HostPageReadableContentBlock,
  HostPageReadableContentOutlineItem,
  HostPageReadableContentSuggestedRead,
} from './types';

const MAX_BLOCKS = 80;
const MAX_SUGGESTED_READS = 12;
const MAX_PREVIEW_ITEMS = 2;
const MAX_BLOCK_TEXT_CHARS = 4_000;
const MAX_TEXT_CHARS = 600;
const MAX_ITEMS = 80;
const MAX_TABLE_ROWS = 80;
const MAX_TABLE_COLUMNS = 12;

type ReadableBlockDraft = Omit<
  HostPageReadableContentBlock,
  'blockId' | 'preview' | 'itemCount' | 'chars' | 'truncated' | 'readHint'
>;

export type HostPageReadParams = {
  blockId?: string;
  query?: string;
  page?: number;
  pageSize?: number;
  maxChars?: number;
};

type ReadResult = Record<string, unknown> & {
  chars: number;
  truncated: boolean;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxChars = MAX_TEXT_CHARS): string {
  return value.length > maxChars
    ? `${value.slice(0, maxChars)}... [truncated ${value.length - maxChars} chars]`
    : value;
}

function truncateOptionalText(
  value: string | undefined,
  maxChars = MAX_TEXT_CHARS,
): string | undefined {
  return value ? truncateText(value, maxChars) : undefined;
}

function getElementText(element: Element): string | undefined {
  const text = normalizeText(element.textContent);
  return text ? truncateText(text) : undefined;
}

function getOwnText(element: Element): string | undefined {
  const text = normalizeText(
    Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' '),
  );
  return text ? truncateText(text) : undefined;
}

function isVisibleElement(element: Element): boolean {
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
    return false;
  }
  if (element instanceof HTMLElement && element.hidden) {
    return false;
  }

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (
    style &&
    (style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0')
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getRect(element: Element) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function getRootDocument(root: Document | ShadowRoot | Element): Document {
  return root instanceof Document ? root : root.ownerDocument;
}

function findPreviousHeading(element: Element): string | undefined {
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
      if (nested) {
        return getElementText(nested);
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return undefined;
}

function collectTextParts(element: Element): string[] {
  const directParts = Array.from(element.children)
    .map((child) => getOwnText(child) ?? getElementText(child))
    .filter((text): text is string => Boolean(text));
  if (directParts.length > 1) {
    return directParts;
  }
  if (element.children.length === 1) {
    return collectTextParts(element.children[0]);
  }
  return directParts;
}

function getKeyValueField(element: Element) {
  if (
    Array.from(element.children).some(
      (child) => collectTextParts(child).length === 2,
    )
  ) {
    return undefined;
  }

  const parts = collectTextParts(element);
  if (parts.length !== 2) {
    return undefined;
  }

  const [name, value] = parts;
  if (!name || !value || name === value || name.length > 120) {
    return undefined;
  }

  return { name, value };
}

function buildPreview(block: ReadableBlockDraft): string[] {
  if (block.fields) {
    return block.fields
      .slice(0, MAX_PREVIEW_ITEMS)
      .map((field) => `${field.name}: ${field.value}`);
  }
  if (block.items) {
    return block.items.slice(0, MAX_PREVIEW_ITEMS);
  }
  if (block.rows) {
    return block.rows
      .slice(0, MAX_PREVIEW_ITEMS)
      .map((row) => row.join(' | '));
  }
  return block.text ? [block.text] : [];
}

function getItemCount(block: ReadableBlockDraft): number {
  if (block.fields) return block.fields.length;
  if (block.items) return block.items.length;
  if (block.rows) return block.rows.length;
  return block.text ? 1 : 0;
}

function getCharCount(block: ReadableBlockDraft): number {
  return [
    block.heading,
    block.text,
    ...(block.items ?? []),
    ...(block.fields ?? []).flatMap((field) => [field.name, field.value]),
    ...(block.headers ?? []),
    ...(block.rows ?? []).flat(),
  ].reduce((total, text) => total + (text?.length ?? 0), 0);
}

function finalizeBlocks(blocks: ReadableBlockDraft[]) {
  return blocks.slice(0, MAX_BLOCKS).map((block, index) => {
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
}

function createReadableContentOutline(
  blocks: HostPageReadableContentBlock[],
): HostPageReadableContentOutlineItem[] {
  return blocks.map((block, index) => ({
    index,
    blockId: block.blockId,
    type: block.type,
    heading: block.heading,
    level: block.level,
    itemCount: block.itemCount,
    chars: block.chars,
    truncated: block.truncated,
  }));
}

function getSuggestedReadReason(block: HostPageReadableContentBlock): string {
  if (block.truncated) {
    return 'block_truncated';
  }
  if (block.type === 'keyValueList') {
    return 'structured_fields';
  }
  if (block.type === 'table') {
    return 'structured_table';
  }
  if (block.itemCount > MAX_PREVIEW_ITEMS) {
    return 'preview_incomplete';
  }
  return 'long_readable_block';
}

function getSuggestedReadScore(block: HostPageReadableContentBlock): number {
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
    Math.min(block.itemCount, 20) +
    Math.min(Math.floor(block.chars / 400), 20)
  );
}

function createSuggestedReads(
  blocks: HostPageReadableContentBlock[],
): HostPageReadableContentSuggestedRead[] {
  return blocks
    .filter(
      (block) =>
        block.type !== 'heading' &&
        (block.truncated ||
          block.itemCount > MAX_PREVIEW_ITEMS ||
          block.chars > MAX_TEXT_CHARS),
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
            ? Math.min(20, Math.max(1, block.itemCount))
            : undefined,
      },
    }));
}

export function createHostPageReadableContentIndex(
  readableContent: HostPageReadableContent,
): HostPageReadableContent {
  const outline = createReadableContentOutline(readableContent.blocks);
  const suggestedReads = createSuggestedReads(readableContent.blocks);
  return {
    ...readableContent,
    outline,
    suggestedReads,
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
  };
}

function addKeyValueLists(
  root: Document | ShadowRoot | Element,
  blocks: ReadableBlockDraft[],
  consumed: Set<Element>,
) {
  const fields: Array<{ name: string; value: string; element: Element }> = [];
  const walker = getRootDocument(root).createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
  );
  let node = walker.nextNode();

  while (node) {
    const element = node as Element;
    if (isVisibleElement(element)) {
      const field = getKeyValueField(element);
      if (field) {
        fields.push({ ...field, element });
      }
    }
    node = walker.nextNode();
  }

  if (fields.length === 0) {
    return;
  }

  blocks.push({
    type: 'keyValueList',
    heading: findPreviousHeading(fields[0].element),
    fields: fields
      .slice(0, MAX_ITEMS)
      .map(({ name, value }) => ({ name, value })),
    rect: getRect(fields[0].element),
  });
  for (const field of fields) {
    consumed.add(field.element);
  }
}

function addLists(
  root: Document | ShadowRoot | Element,
  blocks: ReadableBlockDraft[],
  consumed: Set<Element>,
) {
  for (const list of Array.from(root.querySelectorAll('ul,ol,[role="list"]'))) {
    if (!isVisibleElement(list)) {
      continue;
    }

    const items = Array.from(list.children)
      .map((child) => getElementText(child))
      .filter((text): text is string => Boolean(text))
      .slice(0, MAX_ITEMS);
    if (items.length === 0) {
      continue;
    }

    blocks.push({
      type: 'list',
      heading: findPreviousHeading(list),
      items,
      rect: getRect(list),
    });
    consumed.add(list);
    for (const item of Array.from(list.children)) {
      consumed.add(item);
    }
  }
}

function addTables(
  root: Document | ShadowRoot | Element,
  blocks: ReadableBlockDraft[],
  consumed: Set<Element>,
) {
  for (const table of Array.from(root.querySelectorAll('table,[role="table"],[role="grid"]'))) {
    if (!isVisibleElement(table)) {
      continue;
    }

    const rows = Array.from(table.querySelectorAll('tr,[role="row"]'))
      .map((row) =>
        Array.from(row.querySelectorAll('th,td,[role="columnheader"],[role="cell"],[role="gridcell"]'))
          .map((cell) => getElementText(cell))
          .filter((text): text is string => Boolean(text))
          .slice(0, MAX_TABLE_COLUMNS),
      )
      .filter((row) => row.length > 0)
      .slice(0, MAX_TABLE_ROWS);
    if (rows.length === 0) {
      continue;
    }

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
    consumed.add(table);
  }
}

function addTextBlocks(
  root: Document | ShadowRoot | Element,
  blocks: ReadableBlockDraft[],
  consumed: Set<Element>,
) {
  const selector = 'h1,h2,h3,h4,h5,h6,[role="heading"],p,article,section';
  for (const element of Array.from(root.querySelectorAll(selector))) {
    if (blocks.length >= MAX_BLOCKS) {
      break;
    }
    if (consumed.has(element) || !isVisibleElement(element)) {
      continue;
    }

    const tag = element.tagName.toLowerCase();
    const text = getOwnText(element) ?? getElementText(element);
    if (!text) {
      continue;
    }

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
      continue;
    }

    if (text.length >= 24) {
      blocks.push({
        type: 'paragraph',
        text,
        rect: getRect(element),
      });
    }
  }
}

function getCollapsedSectionCount(root: Document | ShadowRoot | Element): number {
  return root.querySelectorAll(
    '[aria-expanded="false"],[data-expanded="false"],details:not([open]),[hidden]',
  ).length;
}

function getCrossOriginFrameCount(root: Document | ShadowRoot | Element): number {
  return Array.from(root.querySelectorAll('iframe')).filter((frame) => {
    try {
      return !(frame as HTMLIFrameElement).contentDocument;
    } catch {
      return true;
    }
  }).length;
}

export function extractHostPageReadableContent(
  root: Document | ShadowRoot | Element,
): HostPageReadableContent {
  const start =
    root instanceof Document ? (root.body ?? root.documentElement) : root;
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

  const drafts: ReadableBlockDraft[] = [];
  const consumed = new Set<Element>();
  addKeyValueLists(start, drafts, consumed);
  addLists(start, drafts, consumed);
  addTables(start, drafts, consumed);
  addTextBlocks(start, drafts, consumed);

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
}

function pageBounds(total: number, page: number, pageSize: number) {
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
}

function getSerializedLength(value: unknown): number {
  return JSON.stringify(value).length;
}

function getNumberField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === 'number' && Number.isFinite(field)
    ? field
    : undefined;
}

function getStringField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === 'string' && field.trim() ? field : undefined;
}

function finalizeReadResult(
  result: Record<string, unknown>,
  maxChars: number,
  forceTruncated = false,
): ReadResult {
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
    return payload as ReadResult;
  }

  const compacted = {
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
  return compacted;
}

function fitReadResult(
  maxChars: number,
  requestedPageSize: number,
  build: (pageSize: number) => Record<string, unknown>,
): ReadResult {
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
}

export function readHostPageReadableContent(
  readableContent: HostPageReadableContent,
  params: HostPageReadParams = {},
) {
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
    ? readableContent.blocks.find((candidate) => candidate.blockId === params.blockId)
    : undefined;

  if (block) {
    if (block.fields && block.fields.length > 0) {
      const fields = block.fields;
      return fitReadResult(maxChars, pageSize, (candidatePageSize) => {
        const bounds = pageBounds(fields.length, page, candidatePageSize);
        return {
          ...block,
          fields: fields.slice(bounds.start, bounds.end),
          page: bounds.page,
          pageSize: bounds.pageSize,
          pageCount: bounds.pageCount,
          nextPage: bounds.page < bounds.pageCount ? bounds.page + 1 : undefined,
        };
      });
    }

    if (block.items && block.items.length > 0) {
      const items = block.items;
      return fitReadResult(maxChars, pageSize, (candidatePageSize) => {
        const bounds = pageBounds(items.length, page, candidatePageSize);
        return {
          ...block,
          items: items.slice(bounds.start, bounds.end),
          page: bounds.page,
          pageSize: bounds.pageSize,
          pageCount: bounds.pageCount,
          nextPage: bounds.page < bounds.pageCount ? bounds.page + 1 : undefined,
        };
      });
    }

    if (block.rows && block.rows.length > 0) {
      const rows = block.rows;
      return fitReadResult(maxChars, pageSize, (candidatePageSize) => {
        const bounds = pageBounds(rows.length, page, candidatePageSize);
        return {
          ...block,
          rows: rows.slice(bounds.start, bounds.end),
          page: bounds.page,
          pageSize: bounds.pageSize,
          pageCount: bounds.pageCount,
          nextPage: bounds.page < bounds.pageCount ? bounds.page + 1 : undefined,
        };
      });
    }

    return finalizeReadResult(block, maxChars);
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
}
