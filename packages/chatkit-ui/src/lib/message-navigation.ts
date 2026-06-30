import type {
  ChatKitReference,
  TMessageComponentMcpAppData,
  TMessageComponentWidgetData,
  TMessageContentComplex,
  TMessageContentComponent,
  TMessageContentMemory,
  TMessageContentReasoning,
  TMessageContentText,
} from '@xpert-ai/chatkit-types';

import { resolveLocalizedText } from '../i18n/localized-text';
import { getReferenceLabel, normalizeReferences } from './references';
import { isThreadContextUsageRenderArtifact } from './thread-context-usage';
import {
  getToolActivityLabel,
  getToolStepData,
} from '../components/thread/messages/tool-component-group';

export const MESSAGE_NAVIGATION_MIN_ITEMS = 3;
const MAX_PREVIEW_LENGTH = 180;
const MAX_TAG_LENGTH = 40;

export type MessageNavigationRole =
  | 'user'
  | 'assistant'
  | 'system'
  | 'tool'
  | 'event'
  | 'message';

export type MessageNavigationItem = {
  id: string;
  messageId?: string;
  index: number;
  role: MessageNavigationRole;
  title: string;
  preview: string;
  tags: string[];
};

export type MessageNavigationLabels = {
  user: string;
  assistant: string;
  system: string;
  tool: string;
  event: string;
  message: string;
  image: string;
  memory: string;
  widget: string;
  mcpApp: string;
  attachment: string;
  reference: string;
  capability: string;
  reasoning: string;
};

export type MessageNavigationSourceMessage = {
  id?: unknown;
  type?: unknown;
  content?: unknown;
  reasoning?: unknown;
  attachments?: unknown;
  fileAssets?: unknown;
  references?: unknown;
  submittedInput?: unknown;
  runtimeCapabilityOptions?: unknown;
};

export type BuildMessageNavigationItemsOptions = {
  labels: MessageNavigationLabels;
  language?: string;
  assistantTitle?: string | null;
};

type NavigationDraft = {
  text: string[];
  tags: string[];
};

type PendingUserNavigationItem = {
  item: MessageNavigationItem;
};

type CollectContentOptions = {
  includeComponentText?: boolean;
};

type RuntimeCapabilityOptionLike = {
  label?: unknown;
  type?: unknown;
  id?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function pushText(draft: NavigationDraft, value: unknown) {
  const text = readString(value);
  if (text) draft.text.push(text);
}

function pushTag(draft: NavigationDraft, value: unknown) {
  const tag = readString(value);
  if (!tag) return;
  const normalized = truncate(tag, MAX_TAG_LENGTH);
  if (!draft.tags.includes(normalized)) {
    draft.tags.push(normalized);
  }
}

function mergeTags(...tagGroups: string[][]) {
  const tags: string[] = [];
  for (const group of tagGroups) {
    for (const tag of group) {
      if (!tags.includes(tag)) tags.push(tag);
    }
  }
  return tags;
}

export function getMessageNavigationItemId(
  message: MessageNavigationSourceMessage,
  index: number,
) {
  const messageId = readString(message.id);
  if (messageId) return messageId;
  const type = readString(message.type) ?? 'message';
  return `${type}-${index}`;
}

export function getMessageNavigationRole(type: unknown): MessageNavigationRole {
  const normalized = readString(type)?.toLowerCase();
  if (normalized === 'human' || normalized === 'user') return 'user';
  if (normalized === 'ai' || normalized === 'assistant') return 'assistant';
  if (normalized === 'system') return 'system';
  if (normalized === 'tool') return 'tool';
  if (normalized === 'event') return 'event';
  return 'message';
}

function isTextContent(
  content: TMessageContentComplex,
): content is TMessageContentText {
  return content.type === 'text';
}

function isReasoningContent(
  content: TMessageContentComplex,
): content is TMessageContentReasoning {
  return content.type === 'reasoning';
}

function isComponentContent(
  content: TMessageContentComplex,
): content is TMessageContentComponent {
  return content.type === 'component';
}

function isMemoryContent(
  content: TMessageContentComplex,
): content is TMessageContentMemory {
  return content.type === 'memory';
}

function isWidgetComponent(
  content: TMessageContentComponent,
): content is TMessageContentComponent<TMessageComponentWidgetData> {
  const data = content.data as Record<string, unknown> | undefined;
  return data?.type === 'Widget' && Array.isArray(data.widgets);
}

function isMcpAppComponent(
  content: TMessageContentComponent,
): content is TMessageContentComponent<TMessageComponentMcpAppData> {
  const data = content.data as Record<string, unknown> | undefined;
  return data?.type === 'McpApp' && typeof data.appInstanceId === 'string';
}

function collectWidgetContent(
  draft: NavigationDraft,
  content: TMessageContentComponent<TMessageComponentWidgetData>,
  labels: MessageNavigationLabels,
) {
  const names = content.data.widgets
    .map((widget) => readString(widget.name))
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) {
    pushTag(draft, labels.widget);
    return;
  }
  for (const name of names) {
    pushTag(draft, name);
  }
}

function collectMcpAppContent(
  draft: NavigationDraft,
  content: TMessageContentComponent<TMessageComponentMcpAppData>,
  labels: MessageNavigationLabels,
  language: string,
) {
  const title =
    readString(resolveLocalizedText(content.data.title, language)) ??
    readString(content.data.toolName) ??
    labels.mcpApp;
  pushTag(draft, title);
  pushText(draft, resolveLocalizedText(content.data.description, language));
}

function collectComponentContent(
  draft: NavigationDraft,
  content: TMessageContentComponent,
  labels: MessageNavigationLabels,
  language: string,
  options: CollectContentOptions,
) {
  if (isWidgetComponent(content)) {
    collectWidgetContent(draft, content, labels);
    return;
  }

  if (isMcpAppComponent(content)) {
    collectMcpAppContent(draft, content, labels, language);
    return;
  }

  const data = getToolStepData(content);
  pushTag(
    draft,
    resolveLocalizedText(data.message, language) ??
      getToolActivityLabel(content, language),
  );
  if (options.includeComponentText !== false) {
    pushText(draft, resolveLocalizedText(data.message, language));
    pushText(draft, resolveLocalizedText(data.title, language));
    pushText(draft, resolveLocalizedText(data.tool, language));
    pushText(draft, resolveLocalizedText(data.type, language));
  }
}

function collectContentItem(
  draft: NavigationDraft,
  item: TMessageContentComplex | string | undefined,
  labels: MessageNavigationLabels,
  language: string,
  options: CollectContentOptions,
) {
  if (item === undefined || isThreadContextUsageRenderArtifact(item)) return;
  if (typeof item === 'string') {
    pushText(draft, item);
    return;
  }

  if (isTextContent(item) || isReasoningContent(item)) {
    pushText(draft, item.text);
    if (isReasoningContent(item)) pushTag(draft, labels.reasoning);
    return;
  }

  if (item.type === 'image_url') {
    pushTag(draft, labels.image);
    return;
  }

  if (isComponentContent(item)) {
    collectComponentContent(draft, item, labels, language, options);
    return;
  }

  if (isMemoryContent(item)) {
    pushTag(draft, labels.memory);
  }
}

function collectContent(
  draft: NavigationDraft,
  content: unknown,
  labels: MessageNavigationLabels,
  language: string,
  options: CollectContentOptions = {},
) {
  if (typeof content === 'string') {
    pushText(draft, content);
    return;
  }

  if (!Array.isArray(content)) {
    return;
  }

  for (const item of content) {
    collectContentItem(
      draft,
      item as TMessageContentComplex | string | undefined,
      labels,
      language,
      options,
    );
  }
}

function collectReasoning(
  draft: NavigationDraft,
  reasoning: unknown,
  labels: MessageNavigationLabels,
) {
  if (!Array.isArray(reasoning)) return;

  for (const item of reasoning) {
    if (!isRecord(item)) continue;
    pushText(draft, item.text);
    if (readString(item.text)) pushTag(draft, labels.reasoning);
  }
}

function collectFiles(
  draft: NavigationDraft,
  value: unknown,
  fallbackLabel: string,
) {
  if (!Array.isArray(value)) return;

  for (const file of value) {
    if (!isRecord(file)) continue;
    pushTag(
      draft,
      file.originalName ??
        file.name ??
        file.fileName ??
        file.id ??
        fallbackLabel,
    );
  }
}

function collectReferences(draft: NavigationDraft, value: unknown) {
  for (const reference of normalizeReferences(value) as ChatKitReference[]) {
    pushTag(draft, getReferenceLabel(reference));
  }
}

function collectRuntimeCapabilities(draft: NavigationDraft, value: unknown) {
  if (!Array.isArray(value)) return;

  for (const option of value as RuntimeCapabilityOptionLike[]) {
    if (!isRecord(option)) continue;
    pushTag(draft, option.label ?? option.id ?? option.type);
  }
}

function getTitle(
  role: MessageNavigationRole,
  labels: MessageNavigationLabels,
  assistantTitle?: string | null,
) {
  if (role === 'assistant' && assistantTitle?.trim()) {
    return assistantTitle.trim();
  }
  return labels[role];
}

export function buildMessageNavigationItem(
  message: MessageNavigationSourceMessage,
  index: number,
  options: BuildMessageNavigationItemsOptions,
): MessageNavigationItem | null {
  return buildMessageNavigationItemSummary(message, index, options);
}

function buildMessageNavigationItemSummary(
  message: MessageNavigationSourceMessage,
  index: number,
  options: BuildMessageNavigationItemsOptions,
  collectOptions: CollectContentOptions = {},
): MessageNavigationItem | null {
  const role = getMessageNavigationRole(message.type);
  const draft: NavigationDraft = {
    text: [],
    tags: [],
  };
  const language = options.language ?? 'en-US';
  const labels = options.labels;

  if (role === 'user') {
    pushText(draft, message.submittedInput);
  }

  collectContent(draft, message.content, labels, language, collectOptions);
  collectReasoning(draft, message.reasoning, labels);
  collectFiles(draft, message.fileAssets, labels.attachment);
  collectFiles(draft, message.attachments, labels.attachment);
  collectReferences(draft, message.references);
  collectRuntimeCapabilities(draft, message.runtimeCapabilityOptions);

  const text = draft.text.map(normalizeWhitespace).filter(Boolean).join(' ');
  const preview =
    truncate(text, MAX_PREVIEW_LENGTH) || draft.tags.slice(0, 2).join(' · ');

  if (!preview && draft.tags.length === 0) {
    return null;
  }

  const messageId = readString(message.id) ?? undefined;
  return {
    id: getMessageNavigationItemId(message, index),
    ...(messageId ? { messageId } : {}),
    index,
    role,
    title: getTitle(role, labels, options.assistantTitle),
    preview,
    tags: draft.tags,
  };
}

export function buildMessageNavigationItems(
  messages: MessageNavigationSourceMessage[],
  options: BuildMessageNavigationItemsOptions,
) {
  const items: MessageNavigationItem[] = [];
  let pendingUser: PendingUserNavigationItem | null = null;

  messages.forEach((message, messageIndex) => {
    const item = buildMessageNavigationItemSummary(
      message,
      messageIndex,
      options,
      { includeComponentText: false },
    );
    if (!item) return;

    if (item.role === 'user') {
      pendingUser = { item };
      return;
    }

    if (item.role !== 'assistant' || !pendingUser) {
      return;
    }

    items.push({
      id: pendingUser.item.id,
      ...(pendingUser.item.messageId
        ? { messageId: pendingUser.item.messageId }
        : {}),
      index: items.length,
      role: 'user',
      title: pendingUser.item.preview,
      preview: item.preview,
      tags: mergeTags(item.tags, pendingUser.item.tags),
    });
    pendingUser = null;
  });

  return items;
}
