import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import type {
  ComponentMessageDetailsRendererProps,
  ComponentMessagePartialStepData,
  ComponentMessageRenderer,
} from './component-message-renderers';

type WebSearchSource = {
  title: string;
  url: string;
  content?: string;
  description?: string;
  publishedDate?: string;
  author?: string;
};

type WebSearchSourceCandidate = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  description?: unknown;
  publishedDate?: unknown;
  published_date?: unknown;
  publishedAt?: unknown;
  author?: unknown;
};

export const webSearchComponentRenderer: ComponentMessageRenderer = {
  id: 'computer-web-search-sources',
  presentation: 'grouped-step',
  match: isComputerWebSearchComponent,
  hasDetails: hasWebSearchSources,
  renderDetails: WebSearchToolCallOutput,
};

function normalizeToolToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized || null;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeWebSearchSource(value: unknown): WebSearchSource | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as WebSearchSourceCandidate;
  const title = readOptionalString(candidate.title);
  const url = readOptionalString(candidate.url);
  if (!title || !url) return null;

  const content = readOptionalString(candidate.content);
  const description = readOptionalString(candidate.description);
  const publishedDate = readOptionalString(
    candidate.publishedDate ??
      candidate.published_date ??
      candidate.publishedAt,
  );
  const author = readOptionalString(candidate.author);

  return {
    title,
    url,
    ...(content ? { content } : {}),
    ...(description ? { description } : {}),
    ...(publishedDate ? { publishedDate } : {}),
    ...(author ? { author } : {}),
  };
}

function getWebSearchSources(
  data: ComponentMessagePartialStepData,
): WebSearchSource[] {
  if (!Array.isArray(data.data)) return [];

  return data.data.flatMap((item) => {
    const source = normalizeWebSearchSource(item);
    return source ? [source] : [];
  });
}

function hasWebSearchSources(
  _content: TMessageContentComponent,
  data: ComponentMessagePartialStepData,
) {
  return getWebSearchSources(data).length > 0;
}

function isComputerWebSearchComponent(
  _content: TMessageContentComponent,
  data: ComponentMessagePartialStepData,
) {
  const isComputer = data.category === 'Computer';
  const isWebSearch = normalizeToolToken(data.type) === 'web_search';
  if (!isComputer || !isWebSearch) return false;

  return (
    normalizeToolToken(data.tool) === 'web_search' ||
    getWebSearchSources(data).length > 0
  );
}

function getSourceHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function WebSearchToolCallOutput({
  data,
}: ComponentMessageDetailsRendererProps) {
  const { t } = useChatkitTranslation();
  const sources = getWebSearchSources(data);

  if (sources.length === 0 || data.error !== undefined) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-muted-foreground">
        {t('message.toolGroup.sourcesTitle')}
      </div>
      <div className="space-y-2">
        {sources.map((source, index) => {
          const sourceHost = getSourceHost(source.url);
          const snippet = source.content ?? source.description;
          const metaParts = [
            sourceHost,
            source.publishedDate,
            source.author,
          ].filter((item): item is string => Boolean(item));

          return (
            <div
              key={`${source.url}-${index}`}
              className="min-w-0 rounded-md border border-border/60 bg-background/80 px-3 py-2"
            >
              {metaParts.length > 0 ? (
                <div className="mb-1 truncate text-[11px] text-muted-foreground">
                  {metaParts.join(' / ')}
                </div>
              ) : null}
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="block min-w-0 line-clamp-2 text-sm font-medium leading-5 text-foreground hover:underline"
              >
                {source.title}
              </a>
              {snippet ? (
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
                  {snippet}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
