import type { IconDefinition } from './message.js';
import {
  parseResourceCardBlocks,
  parseFileReference,
  type ResourceCardContent,
  type ResourceCardFileReference,
} from './resource-card-content.js';
export type {
  ResourceCardContent,
  ResourceCardField,
  ResourceCardFile,
  ResourceCardFileReference,
  ResourceCardImage,
} from './resource-card-content.js';

export type ResourceCardScalar = string | number | boolean | null;
export type ResourceCardOpenTarget = {
  viewKey: string;
  selectionId?: string;
  parameters?: Record<string, ResourceCardScalar | ResourceCardScalar[]>;
} & (
  | { target: 'workbench.view' }
  | { target: 'assistant.project'; projectId: string }
  | {
      target: 'workbench.file';
      fileKey: string;
      targetId: string;
      previewFile?: ResourceCardFileReference;
    }
);

/** Presentation of a committed business resource; distinct from versioned file Artifacts. */
export interface ConversationResourceCard {
  resource: {
    namespace: string;
    type: string;
    id: string;
    artifactId?: string;
  };
  title: string;
  description?: string;
  icon?: IconDefinition;
  /** Ordered content blocks; unknown kinds degrade to the base resource card. */
  content?: ResourceCardContent[];
  open: ResourceCardOpenTarget;
}

export interface TMessageContentResourceCard {
  type: 'resource_card';
  id: string;
  data: ConversationResourceCard;
  /** Bound by the server, never supplied by an emitting plugin. */
  messageId?: string;
  executionId?: string;
}

export function resourceCardId(card: ConversationResourceCard): string {
  return JSON.stringify([
    card.resource.namespace,
    card.resource.type,
    card.resource.id,
  ]);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function scalar(value: unknown): value is ResourceCardScalar {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

/** JSON boundary: copy only supported fields, never executable commands or host URLs. */
export function parseResourceCard(
  value: unknown,
): ConversationResourceCard | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('resource' in value) ||
    !('title' in value) ||
    !nonempty(value.title) ||
    !('open' in value)
  )
    return null;
  const resource = value.resource;
  if (
    !resource ||
    typeof resource !== 'object' ||
    !('namespace' in resource) ||
    !nonempty(resource.namespace) ||
    !('type' in resource) ||
    !nonempty(resource.type) ||
    !('id' in resource) ||
    !nonempty(resource.id)
  )
    return null;
  if ('artifactId' in resource && !nonempty(resource.artifactId)) return null;
  const open = value.open;
  if (
    !open ||
    typeof open !== 'object' ||
    !('target' in open) ||
    (open.target !== 'workbench.view' &&
      open.target !== 'assistant.project' &&
      open.target !== 'workbench.file') ||
    !('viewKey' in open) ||
    !nonempty(open.viewKey)
  )
    return null;
  // Reject malformed/extra navigation keys instead of silently accepting a second command.
  if (
    Object.keys(open).some(
      (key) =>
        ![
          'target',
          'viewKey',
          'selectionId',
          'parameters',
          'projectId',
          'fileKey',
          'targetId',
          'previewFile',
        ].includes(key),
    )
  )
    return null;
  if ('selectionId' in open && !nonempty(open.selectionId)) return null;
  const parameters: Record<string, ResourceCardScalar | ResourceCardScalar[]> =
    {};
  if ('parameters' in open) {
    if (
      !open.parameters ||
      typeof open.parameters !== 'object' ||
      Array.isArray(open.parameters)
    )
      return null;
    for (const [key, item] of Object.entries(open.parameters)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) return null;
      if (scalar(item)) parameters[key] = item;
      else if (Array.isArray(item) && item.every(scalar))
        parameters[key] = item;
      else return null;
    }
  }
  const common = {
    viewKey: open.viewKey,
    ...('selectionId' in open && nonempty(open.selectionId)
      ? { selectionId: open.selectionId }
      : {}),
    ...('parameters' in open ? { parameters } : {}),
  };
  let target: ResourceCardOpenTarget;
  if (open.target === 'workbench.file') {
    if (
      'projectId' in open ||
      'selectionId' in open ||
      'parameters' in open ||
      !('fileKey' in open) ||
      !nonempty(open.fileKey) ||
      !('targetId' in open) ||
      !nonempty(open.targetId)
    )
      return null;
    const previewFile =
      'previewFile' in open ? parseFileReference(open.previewFile) : undefined;
    if (previewFile === null) return null;
    target = {
      viewKey: open.viewKey,
      target: 'workbench.file',
      fileKey: open.fileKey,
      targetId: open.targetId,
      ...(previewFile ? { previewFile } : {}),
    };
  } else if ('fileKey' in open || 'targetId' in open || 'previewFile' in open) {
    return null;
  } else if (open.target === 'assistant.project') {
    if (!('projectId' in open) || !nonempty(open.projectId)) return null;
    target = {
      ...common,
      target: 'assistant.project',
      projectId: open.projectId,
    };
  } else {
    if ('projectId' in open) return null;
    target = { ...common, target: 'workbench.view' };
  }
  if ('description' in value && typeof value.description !== 'string')
    return null;
  // Migrate persisted image-only cards at this read boundary; producers use content.
  const content = parseResourceCardBlocks(
    'content' in value
      ? value.content
      : 'images' in value
        ? [{ kind: 'image-gallery', images: value.images }]
        : [],
  );
  let icon: IconDefinition | undefined;
  if ('icon' in value) {
    const candidate = value.icon;
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      !('type' in candidate) ||
      !('value' in candidate) ||
      !nonempty(candidate.value)
    )
      return null;
    // Static icons only. The existing icon renderer owns SVG sanitization.
    if (
      candidate.type !== 'svg' &&
      candidate.type !== 'emoji' &&
      candidate.type !== 'font'
    )
      return null;
    icon = { type: candidate.type, value: candidate.value };
  }
  return {
    resource: {
      namespace: resource.namespace,
      type: resource.type,
      id: resource.id,
      ...('artifactId' in resource && nonempty(resource.artifactId)
        ? { artifactId: resource.artifactId }
        : {}),
    },
    title: value.title,
    ...('description' in value
      ? { description: value.description as string }
      : {}),
    ...(icon ? { icon } : {}),
    ...(content.length ? { content } : {}),
    open: target,
  };
}

export function createResourceCardContent(
  card: ConversationResourceCard,
): TMessageContentResourceCard {
  const data = parseResourceCard(card);
  if (!data) throw new Error('Invalid resource card');
  return { type: 'resource_card', id: resourceCardId(data), data };
}

export function isResourceCardContent(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'resource_card'
  );
}

export function parseResourceCardContent(
  value: unknown,
): TMessageContentResourceCard | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('type' in value) ||
    value.type !== 'resource_card' ||
    !('data' in value)
  )
    return null;
  const card = parseResourceCard(value.data);
  if (!card) return null;
  return {
    ...createResourceCardContent(card),
    ...('messageId' in value && nonempty(value.messageId)
      ? { messageId: value.messageId }
      : {}),
    ...('executionId' in value && nonempty(value.executionId)
      ? { executionId: value.executionId }
      : {}),
  };
}

/** Identity is local to one reply. Repeat emissions replace the snapshot in place. */
export function upsertResourceCardContent<T>(
  parts: T[],
  card: TMessageContentResourceCard,
): (T | TMessageContentResourceCard)[] {
  const index = parts.findIndex(
    (part) => parseResourceCardContent(part)?.id === card.id,
  );
  return index < 0
    ? [...parts, card]
    : parts.map((part, i) => (i === index ? card : part));
}
