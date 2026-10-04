import type { FileChangeReviewOptions } from './file-review/file-change-review';
import type {
  ChatKitQuoteReference,
  ChatKitWorkbenchNavigationSession,
} from '@xpert-ai/chatkit-types';
import type {
  WorkbenchOpenFile,
  WorkbenchOpenFileEvidence,
  XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import { normalizeReferences } from '../lib/references';
import { parseViewQuery } from './protocol';

export type WorkbenchPreview = {
  key: string;
  kind: 'file' | 'browser' | 'html' | 'review';
  title: string;
  url: string;
  file?: WorkbenchOpenFile;
  /** In-memory loader for an immutable HTML delivery; never a mutable workspace path. */
  review?: FileChangeReviewOptions;
  html?: {
    load: (signal: AbortSignal) => Promise<{ blob: Blob; name: string }>;
    identity?: { artifactId: string; artifactVersionId: string };
    onAnnotate?: (reference: ChatKitQuoteReference) => Promise<void>;
  };
};
export type NavigationSession = ChatKitWorkbenchNavigationSession;
export type NavigationPayload = {
  target: string;
  conversationId?: string;
  threadId?: string;
  executionId?: string;
  projectId?: string;
  xpertId?: string;
  viewKey?: string;
  query: XpertViewQuery;
};

export function object(value: unknown): value is object {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
export function field(value: unknown, key: string): unknown {
  return object(value) ? Reflect.get(value, key) : undefined;
}
export function parseNavigation(value: unknown): NavigationPayload {
  return {
    target: text(field(value, 'target')) ?? '',
    conversationId: text(field(value, 'conversationId')),
    threadId: text(field(value, 'threadId')),
    executionId: text(field(value, 'executionId')),
    projectId: text(field(value, 'projectId')),
    xpertId: text(field(value, 'xpertId')),
    viewKey: text(field(value, 'viewKey')),
    query: parseViewQuery(value),
  };
}

export type ExecutionNavigationRequest = {
  conversationId: string;
  executionId: string;
  threadId?: string;
  projectId?: string;
};

export type ExecutionNavigationResult =
  | { success: true; status: 'opened' }
  | { success: false; code: string; message?: string };

// Session credentials are consumed by ChatKit and must never be returned to a remote view.
export function parseNavigationSession(
  result: unknown,
): NavigationSession | null {
  if (field(result, 'success') !== true) return null;
  const value = field(result, 'session');
  const assistantId = text(field(value, 'assistantId'));
  const secret = text(field(value, 'secret'));
  const projectId = field(value, 'projectId');
  const threadId = field(value, 'threadId');
  if (
    !assistantId ||
    !secret ||
    !(projectId === null || text(projectId)) ||
    !(threadId === null || text(threadId))
  )
    return null;
  return {
    assistantId,
    secret,
    projectId: text(projectId) ?? null,
    threadId: text(threadId) ?? null,
    conversationId: text(field(value, 'conversationId')),
    organizationId: text(field(value, 'organizationId')),
  };
}

export function previewUrl(value: unknown, apiUrl: string): string | null {
  const input = text(value);
  if (!input) return null;
  try {
    const url = new URL(input, new URL(apiUrl, window.location.href));
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
function finite(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
function evidence(value: unknown): WorkbenchOpenFileEvidence | undefined {
  if (!object(value)) return undefined;
  const source = field(value, 'locator');
  const box = field(source, 'box');
  const x = finite(field(box, 'x')),
    y = finite(field(box, 'y'));
  const width = finite(field(box, 'width')),
    height = finite(field(box, 'height'));
  const page = finite(field(source, 'page'));
  return {
    observationId: text(field(value, 'observationId')),
    attributeCode: text(field(value, 'attributeCode')),
    displayValue: text(field(value, 'displayValue')),
    text: text(field(value, 'text')),
    method: text(field(value, 'method')),
    region: text(field(value, 'region')),
    confidence: finite(field(value, 'confidence')),
    ...(object(source)
      ? {
          locator: {
            sourceType: text(field(source, 'sourceType')),
            coordinateSpace: text(field(source, 'coordinateSpace')),
            ...(page && Number.isInteger(page) && page > 0 ? { page } : {}),
            recognitionRotation: finite(field(source, 'recognitionRotation')),
            orientationConfidence: finite(
              field(source, 'orientationConfidence'),
            ),
            ...(x !== undefined &&
            y !== undefined &&
            width !== undefined &&
            height !== undefined
              ? { box: { x, y, width, height } }
              : {}),
          },
        }
      : {}),
  };
}
export function parsePreview(
  kind: 'file' | 'browser',
  value: unknown,
  apiUrl: string,
): WorkbenchPreview | null {
  const url = previewUrl(
    typeof value === 'string'
      ? value
      : (field(value, 'previewUrl') ??
          field(value, 'url') ??
          field(value, 'fileUrl') ??
          field(value, 'displayUrl') ??
          field(value, 'deploymentUrl')),
    apiUrl,
  );
  if (!url) return null;
  const name =
    text(field(value, 'name')) ??
    text(field(value, 'originalName')) ??
    text(field(value, 'title')) ??
    new URL(url).pathname.split('/').pop() ??
    new URL(url).hostname;
  const file: WorkbenchOpenFile | undefined =
    kind === 'file'
      ? {
          name: name || 'File',
          url,
          previewUrl: url,
          id:
            text(field(value, 'id')) ??
            text(field(value, 'fileAssetId')) ??
            text(field(value, 'fileId')),
          fileId: text(field(value, 'fileId')),
          fileAssetId: text(field(value, 'fileAssetId')),
          storageFileId: text(field(value, 'storageFileId')),
          mimeType:
            text(field(value, 'mimeType')) ?? text(field(value, 'mimetype')),
          size: finite(field(value, 'size')),
          evidence: evidence(field(value, 'evidence')),
        }
      : undefined;
  return {
    key: `chatkit.preview.${kind}:${file?.fileAssetId ?? file?.fileId ?? url}`,
    kind,
    title: name || new URL(url).hostname,
    url,
    file,
  };
}
export function parseAppendReferences(payload: unknown) {
  const value = field(payload, 'references');
  if (!Array.isArray(value) || !value.length || value.length > 20) return null;
  const references = normalizeReferences(value);
  if (
    references.length !== value.length ||
    references.reduce(
      (sum, ref) => sum + ('text' in ref ? (ref.text?.length ?? 0) : 0),
      0,
    ) > 200000
  )
    return null;
  return references;
}
