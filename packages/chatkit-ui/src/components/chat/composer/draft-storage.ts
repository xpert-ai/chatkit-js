import { z } from 'zod';
import { normalizeReferences } from '../../../lib/references';
import type { ChatKitReference } from '@xpert-ai/chatkit-types';
import {
  normalizeComposerParts,
  type ComposerPart,
} from '../../../lib/composer-parts';

export type DraftContext = {
  apiUrl: string;
  assistantId: string;
  organizationId?: string;
  threadId: string | null;
};

// Only portable composer data is allowed across the storage boundary. File objects,
// signed URLs, arbitrary metadata and credentials are deliberately not serialized.
const text = z.string();
const resource = z.object({ bindingId: text, version: text, skillKey: text });
const common = {
  id: text,
  label: text,
  description: text.optional(),
  color: text.optional(),
};
const capability = z.discriminatedUnion('type', [
  z.object({
    ...common,
    type: z.literal('skill'),
    capability: z.object({
      id: text,
      workspaceId: text,
      label: text,
      resource: resource.optional(),
      description: text.optional(),
      repositoryName: text.optional(),
      provider: text.optional(),
    }),
  }),
  z.object({
    ...common,
    type: z.literal('plugin'),
    capability: z.object({
      nodeKey: text,
      provider: text,
      label: text,
      description: text.optional(),
      toolNames: z.array(text).optional(),
    }),
  }),
  z.object({
    ...common,
    type: z.literal('subAgent'),
    capability: z.object({
      nodeKey: text,
      type: z.enum(['agent', 'xpert']),
      label: text,
      name: text.optional(),
      description: text.optional(),
      agentKey: text.optional(),
      xpertId: text.optional(),
    }),
  }),
]);
const partsSchema = z.array(
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), text }),
    z.object({
      type: z.literal('thread'),
      key: text,
      reference: z.object({
        type: z.literal('thread'),
        conversationId: text.min(1),
        threadId: text.min(1),
        id: text.optional(),
        label: text.optional(),
      }),
    }),
    z.object({ type: z.literal('capability'), key: text, capability }),
  ]),
);
const referencesSchema = z
  .unknown()
  .transform((value): ChatKitReference[] =>
    normalizeReferences(value).filter(
      (reference) => reference.type !== 'image',
    ),
  );
const storedSchema = z.object({
  version: z.literal(1),
  parts: partsSchema,
  references: referencesSchema,
  pending: z.array(
    z.object({ id: text, parts: partsSchema, references: referencesSchema }),
  ),
});
export type StoredDraft = z.infer<typeof storedSchema>;
export const DRAFT_STORAGE_PREFIX = 'chatkit:composer-draft:v1:';

export function draftNamespaceKey(scope?: DraftContext): string | null {
  if (!scope || !scope.apiUrl.trim() || !scope.assistantId.trim()) return null;
  let service: string;
  try {
    const url = new URL(scope.apiUrl);
    if (url.username || url.password || url.search || url.hash) return null;
    service = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
  return JSON.stringify([
    service,
    scope.organizationId ?? null,
    scope.assistantId,
  ]);
}

export function draftStorageKey(scope?: DraftContext): string | null {
  const namespace = draftNamespaceKey(scope);
  return namespace && scope?.threadId?.trim()
    ? DRAFT_STORAGE_PREFIX + JSON.stringify([namespace, scope.threadId])
    : null;
}

export function readDraft(key: string | null): StoredDraft | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeDraft(key: string | null, draft: StoredDraft) {
  if (!key) return;
  try {
    const portable = storedSchema.parse(draft);
    if (
      !portable.parts.length &&
      !portable.references.length &&
      !portable.pending.length
    ) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(portable));
    }
  } catch {
    // Storage denial, quota exhaustion and malformed entries must never block editing.
  }
}

export function mergeDraftParts(groups: ComposerPart[][]): ComposerPart[] {
  const seen = new Set<string>();
  const parts: ComposerPart[] = [];
  for (const group of groups) {
    const unique = group.filter((part) => {
      if (part.type === 'text') return true;
      if (seen.has(part.key)) return false;
      seen.add(part.key);
      return true;
    });
    if (!unique.length) continue;
    if (parts.length) parts.push({ type: 'text', text: '\n' });
    parts.push(...unique);
  }
  return normalizeComposerParts(parts);
}
