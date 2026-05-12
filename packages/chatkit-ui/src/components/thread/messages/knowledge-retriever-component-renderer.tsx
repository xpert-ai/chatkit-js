import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';

import { resolveLocalizedText } from '../../../i18n/localized-text';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import {
  detectJsonValue,
  getJsonValueSummary,
  JsonTreeView,
  PlainTextBlock,
  RawJsonBlock,
} from '../json-tree-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import type {
  ComponentMessageDetailsRendererProps,
  ComponentMessagePartialStepData,
  ComponentMessageRenderer,
} from './component-message-renderers';

type KnowledgeResult = {
  id?: string;
  title: string;
  url?: string;
  content?: string;
  lineRange?: string;
  score?: string;
  metadata: Array<{
    key: string;
    value: string;
  }>;
};

const KNOWLEDGE_RETRIEVER_TITLE = 'Knowledge Retriever';
const KNOWLEDGE_METADATA_SKIP_KEYS = new Set([
  'assets',
  'children',
  'loc',
  'relevanceScore',
  'score',
]);

export const knowledgeRetrieverComponentRenderer: ComponentMessageRenderer = {
  id: 'knowledge-retriever',
  presentation: 'grouped-step',
  match: isKnowledgeRetrieverComponent,
  getTitle: () => KNOWLEDGE_RETRIEVER_TITLE,
  hasDetails: hasKnowledgeRetrieverDetails,
  renderDetails: KnowledgeRetrieverDetails,
};

function normalizeToolToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return normalized || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringifyValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return readString(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized && serialized !== '{}' ? serialized : undefined;
  } catch {
    return String(value);
  }
}

function truncateMetadataValue(value: string) {
  return value.length > 90 ? `${value.slice(0, 87)}...` : value;
}

function formatScore(value: unknown): string | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value.toFixed(value < 1 ? 3 : 2)
      : undefined;
  }

  return readString(value);
}

function getLineRange(metadata: Record<string, unknown>) {
  const loc = metadata.loc;
  if (!isRecord(loc)) return undefined;

  const lines = loc.lines;
  if (!isRecord(lines)) return undefined;

  const from = stringifyValue(lines.from);
  const to = stringifyValue(lines.to);
  if (from && to) return `${from}-${to}`;

  return from ?? to;
}

function normalizeMetadataEntries(metadata: Record<string, unknown>) {
  return Object.entries(metadata).flatMap(([key, value]) => {
    if (KNOWLEDGE_METADATA_SKIP_KEYS.has(key)) return [];

    const formatted = stringifyValue(value);
    if (!formatted) return [];

    return [
      {
        key,
        value: truncateMetadataValue(formatted),
      },
    ];
  });
}

function normalizeKnowledgeResult(
  value: unknown,
  fallbackTitle: string,
): KnowledgeResult | null {
  if (!isRecord(value)) return null;

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const document = isRecord(value.document) ? value.document : {};
  const content = readString(value.pageContent);
  const title =
    readString(document.name) ??
    readString(metadata.originalFileName) ??
    readString(metadata.source) ??
    readString(value.id) ??
    readString(metadata.chunkId) ??
    fallbackTitle;

  if (
    !content &&
    Object.keys(metadata).length === 0 &&
    Object.keys(document).length === 0
  ) {
    return null;
  }

  return {
    id: readString(value.id) ?? readString(metadata.chunkId),
    title,
    url: readString(document.fileUrl),
    content,
    lineRange: getLineRange(metadata),
    score: formatScore(
      metadata.relevanceScore ?? metadata.score ?? value.score,
    ),
    metadata: normalizeMetadataEntries(metadata),
  };
}

function getKnowledgeResults(data: ComponentMessagePartialStepData) {
  if (!Array.isArray(data.data)) return [];

  return data.data.flatMap((item, index) => {
    const result = normalizeKnowledgeResult(item, `Result ${index + 1}`);
    return result ? [result] : [];
  });
}

function getRawKnowledgeData(data: ComponentMessagePartialStepData) {
  return data.data ?? data.output ?? null;
}

function getRetrieverQuery(
  data: ComponentMessagePartialStepData,
  language: string,
) {
  const input = data.input;
  if (isRecord(input)) {
    return (
      readString(input.query) ??
      readString(input.input) ??
      readString(input.question)
    );
  }

  return (
    readString(resolveLocalizedText(data.message, language)) ??
    readString(input)
  );
}

function hasKnowledgeRetrieverDetails(
  _content: TMessageContentComponent,
  data: ComponentMessagePartialStepData,
) {
  return isKnowledgeRetrieverComponent(_content, data);
}

function isKnowledgeRetrieverComponent(
  _content: TMessageContentComponent,
  data: ComponentMessagePartialStepData,
) {
  return normalizeToolToken(data.type) === 'knowledges';
}

function KnowledgeRawDataBlock({ value }: { value: unknown }) {
  const { t } = useChatkitTranslation();
  const detected = detectJsonValue(value);

  if (detected.kind === 'text') {
    return <PlainTextBlock value={detected.text} />;
  }

  return (
    <Tabs defaultValue="tree" className="min-w-0">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          {t('message.toolGroup.jsonTitle')} ·{' '}
          {getJsonValueSummary(detected.value)}
        </span>
        <TabsList className="rounded-md p-0.5">
          <TabsTrigger className="px-2 py-0.5 text-[11px]" value="tree">
            {t('message.toolGroup.jsonTree')}
          </TabsTrigger>
          <TabsTrigger className="px-2 py-0.5 text-[11px]" value="raw">
            {t('message.toolGroup.jsonRaw')}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="tree" className="mt-0">
        <JsonTreeView value={detected.value} />
      </TabsContent>
      <TabsContent value="raw" className="mt-0">
        <RawJsonBlock raw={detected.raw} />
      </TabsContent>
    </Tabs>
  );
}

function KnowledgeRetrieverDetails({
  data,
}: ComponentMessageDetailsRendererProps) {
  const { i18n, t } = useChatkitTranslation();
  const query = getRetrieverQuery(data, i18n.language);
  const results = getKnowledgeResults(data);
  const rawData = getRawKnowledgeData(data);
  const hasArrayData = Array.isArray(data.data);
  const hasRawFallback =
    rawData !== null &&
    rawData !== undefined &&
    (!hasArrayData ||
      (Array.isArray(data.data) &&
        data.data.length > 0 &&
        results.length === 0));
  const showEmptyState =
    results.length === 0 && !hasRawFallback && data.status !== 'running';

  return (
    <div className="min-w-0 space-y-3 px-3 py-2">
      {query ? (
        <div className="min-w-0 space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">
            {t('message.knowledgeRetriever.queryTitle')}
          </div>
          <div className="min-w-0 whitespace-pre-wrap wrap-break-word rounded-md bg-muted/40 px-3 py-2 font-mono text-[12px] leading-5 text-foreground/80">
            {query}
          </div>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="min-w-0 space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground">
            {t('message.knowledgeRetriever.resultsTitle', {
              count: results.length,
            })}
          </div>
          <div className="space-y-2">
            {results.map((result, index) => (
              <KnowledgeResultCard
                key={result.id ?? `${result.title}-${index}`}
                result={result}
                index={index}
              />
            ))}
          </div>
        </div>
      ) : null}

      {hasRawFallback ? (
        <div className="min-w-0 space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">
            {t('message.knowledgeRetriever.rawDataTitle')}
          </div>
          <KnowledgeRawDataBlock value={rawData} />
        </div>
      ) : null}

      {showEmptyState ? (
        <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
          {t('message.knowledgeRetriever.noResults')}
        </div>
      ) : null}
    </div>
  );
}

function KnowledgeResultCard({
  result,
  index,
}: {
  result: KnowledgeResult;
  index: number;
}) {
  const { t } = useChatkitTranslation();
  const titleId = `knowledge-result-${index + 1}`;
  const metadata = [
    ...(result.score
      ? [
          {
            key: t('message.knowledgeRetriever.scoreLabel'),
            value: result.score,
          },
        ]
      : []),
    ...result.metadata,
  ];
  const titleClassName =
    'min-w-0 line-clamp-2 text-sm font-medium leading-5 text-foreground';

  return (
    <article className="min-w-0 rounded-md border border-border/60 bg-background/80 px-3 py-2">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          {result.url ? (
            <a
              id={titleId}
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className={cn(titleClassName, 'hover:underline')}
            >
              {result.title}
              {result.lineRange ? (
                <span className="ml-1 text-muted-foreground">
                  [{result.lineRange}]
                </span>
              ) : null}
            </a>
          ) : (
            <div id={titleId} className={titleClassName}>
              {result.title}
              {result.lineRange ? (
                <span className="ml-1 text-muted-foreground">
                  [{result.lineRange}]
                </span>
              ) : null}
            </div>
          )}
          {result.content ? (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
              {result.content}
            </p>
          ) : null}
          {metadata.length > 0 ? (
            <div
              className="mt-2 flex flex-wrap gap-1.5"
              aria-labelledby={titleId}
            >
              {metadata.slice(0, 10).map((item) => (
                <span
                  key={`${item.key}:${item.value}`}
                  className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground"
                >
                  <span className="shrink-0 font-medium text-foreground/70">
                    {item.key}:
                  </span>
                  <span className="min-w-0 truncate font-mono">
                    {item.value}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
