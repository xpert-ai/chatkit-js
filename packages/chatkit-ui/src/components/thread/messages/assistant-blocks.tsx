import * as React from 'react';
import type {
  ChatkitMessage,
  MessageContentImageUrl,
  TMessageContentComplex,
  TMessageContentComponent,
  TMessageComponentMcpAppData,
  TMessageComponentWidgetData,
  TMessageContentMemory,
  TMessageContentReasoning,
  TMessageContentText,
} from '@xpert-ai/chatkit-types';
import { Brain, ChevronDown, ChevronRight, Clock3 } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { isAgentEventContent } from '../../../lib/agent-runs';
import { isNonTranscriptMessageContent } from '../../../lib/message-content-presentation';
import { isNearBottom } from '../../../lib/scroll';
import { cn } from '../../../lib/utils';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { MarkdownText } from '../markdown-text';
import { AgentEventRow } from './agent-run-group';
import {
  ContextCompressionMessage,
  isContextCompressionComponent,
} from './context-compression-message';
import { getComponentMessagePresentation } from './component-message-renderers';
import {
  getToolActivityLabel,
  getToolStepData,
  ToolComponentGroup,
  toolStatusConfig,
} from './tool-component-group';
import {
  getRequestUserInputResultCardData,
  RequestUserInputResultCard,
} from './request-user-input-result-card';
import { WidgetMessage } from './widget';
import { isMcpAppComponentData, McpAppMessage } from './mcp-app';
import { HistoricalMcpAppResult } from './historical-mcp-app-result';
import type { AssistantContentRenderOptions } from './assistant-content-types';

function isTextContent(
  content: TMessageContentComplex,
): content is TMessageContentText {
  return content.type === 'text';
}

export function isReasoningContent(
  content: TMessageContentComplex,
): content is TMessageContentReasoning {
  return content.type === 'reasoning';
}

function isImageContent(
  content: TMessageContentComplex,
): content is MessageContentImageUrl {
  return content.type === 'image_url';
}

export function isComponentContent(
  content: TMessageContentComplex,
): content is TMessageContentComponent {
  return content.type === 'component';
}

function isWidgetComponent(
  content: TMessageContentComponent,
): content is TMessageContentComponent<TMessageComponentWidgetData> {
  const data = content.data;
  return (
    data?.type === 'Widget' && 'widgets' in data && Array.isArray(data.widgets)
  );
}

export function isMcpAppComponent(
  content: TMessageContentComponent,
): content is TMessageContentComponent<TMessageComponentMcpAppData> {
  return isMcpAppComponentData(content.data);
}

function isMemoryContent(
  content: TMessageContentComplex,
): content is TMessageContentMemory {
  return content.type === 'memory';
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDisplayValue(value: unknown) {
  return typeof value === 'string' ? value : safeJson(value);
}

export function ReasoningBlock({
  reasoning,
  isReasoning = false,
}: {
  reasoning: TMessageContentReasoning[];
  isReasoning?: boolean;
}) {
  const { t } = useChatkitTranslation();
  const [expanded, setExpanded] = React.useState(isReasoning);
  React.useEffect(() => {
    setExpanded(isReasoning);
  }, [isReasoning]);
  const contentId = React.useId();
  const blocks = reasoning.filter((item) => item.text?.trim());
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-2 px-1 py-1">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left opacity-60 hover:opacity-100 disabled:pointer-events-none data-[state=open]:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
          <Brain aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="truncate">{t('message.reasoning')}</span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-90',
          )}
        />
      </button>
      {expanded ? (
        <div
          id={contentId}
          className="space-y-2 border-l pl-3 text-sm text-muted-foreground"
        >
          {blocks.map((item, index) => (
            <p
              key={item.id ?? `reasoning-${index}`}
              className="whitespace-pre-wrap wrap-break-word leading-relaxed"
            >
              {item.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ImageBlock({ content }: { content: MessageContentImageUrl }) {
  const imageUrl =
    typeof content.image_url === 'string'
      ? content.image_url
      : typeof content.image_url?.url === 'string'
        ? content.image_url.url
        : null;

  if (!imageUrl) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-sm">Image</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {safeJson(content)}
        </CardContent>
      </Card>
    );
  }

  return (
    <figure className="overflow-hidden rounded-lg border bg-background">
      <img
        src={imageUrl}
        alt="Assistant output"
        className="h-auto w-full object-cover"
      />
    </figure>
  );
}

function MemoryBlock({ content }: { content: TMessageContentMemory }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">Memory</CardTitle>
        <Badge variant="secondary">Memory</Badge>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        <pre className="whitespace-pre-wrap wrap-break-word">
          {safeJson(content.data ?? [])}
        </pre>
      </CardContent>
    </Card>
  );
}

function parseStepDate(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatStepDuration(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 10_000) {
    return `${(durationMs / 1_000).toFixed(1)}s`;
  }

  if (durationMs < 60_000) {
    return `${Math.round(durationMs / 1_000)}s`;
  }

  const hours = Math.floor(durationMs / 3_600_000);
  const minutes = Math.floor((durationMs % 3_600_000) / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1_000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function ComponentBlock({ content }: { content: TMessageContentComponent }) {
  const { i18n } = useChatkitTranslation();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = React.useRef(true);
  const previousScrollTopRef = React.useRef(0);
  const [durationNow, setDurationNow] = React.useState(() => Date.now());

  const data = getToolStepData(content);
  const category = data.category ?? 'Component';
  const title = getToolActivityLabel(content, i18n.language);
  const status = data.status ?? null;
  const message = data.message ?? null;
  const output = data.output ?? null;
  const error = data.error ?? null;
  const fallback = message ?? output ?? data.data ?? data;
  const hasOutput = message !== null || output !== null;
  const createdAt = parseStepDate(data.created_date);
  const endedAt = parseStepDate(data.end_date);
  const durationMs =
    createdAt === null
      ? null
      : Math.max(0, (endedAt ?? durationNow) - createdAt);
  const durationLabel =
    durationMs === null ? null : formatStepDuration(durationMs);

  // Auto-expand when running with output available
  React.useEffect(() => {
    if (status === 'running' && output !== null) setIsExpanded(true);
  }, [status, output]);

  React.useEffect(() => {
    if (status !== 'running' || createdAt === null || endedAt !== null) {
      return;
    }

    setDurationNow(Date.now());
    const timer = window.setInterval(() => {
      setDurationNow(Date.now());
    }, 100);

    return () => {
      window.clearInterval(timer);
    };
  }, [createdAt, endedAt, status]);

  React.useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    previousScrollTopRef.current = element.scrollTop;

    const updateAutoScrollState = () => {
      const nextScrollTop = element.scrollTop;
      const isScrollingUp = nextScrollTop < previousScrollTopRef.current - 1;
      previousScrollTopRef.current = nextScrollTop;

      if (isScrollingUp) {
        shouldAutoScrollRef.current = false;
        return;
      }

      shouldAutoScrollRef.current = isNearBottom(element);
    };

    updateAutoScrollState();
    element.addEventListener('scroll', updateAutoScrollState, {
      passive: true,
    });

    return () => {
      element.removeEventListener('scroll', updateAutoScrollState);
    };
  }, [isExpanded]);

  React.useEffect(() => {
    if (status !== 'running') {
      shouldAutoScrollRef.current = true;
      return;
    }

    const element = contentRef.current;
    if (!element || !shouldAutoScrollRef.current) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [isExpanded, output, status]);

  const config = status ? toolStatusConfig[status] : null;
  const StatusIcon = config?.icon;

  return (
    <Card>
      <CardHeader
        className="flex flex-row items-center justify-between gap-2 px-2 py-1 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-1 flex-1 min-w-0">
          {status && StatusIcon && (
            <StatusIcon
              className={cn(
                'h-4 w-4',
                config?.iconClass,
                status === 'running' && 'animate-spin',
              )}
            />
          )}
          <CardTitle className="text-sm truncate">{title}</CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {durationLabel && (
            <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
              <Clock3 className="h-3 w-3" />
              <span>{durationLabel}</span>
            </div>
          )}
          <Badge variant="secondary" className="rounded-lg px-1.5">
            {category}
          </Badge>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                isExpanded && 'rotate-180',
              )}
            />
          </button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent
          ref={contentRef}
          className="text-xs text-muted-foreground max-h-60 overflow-auto"
        >
          {data.input && (
            <pre className="whitespace-pre-wrap wrap-break-word">
              {formatDisplayValue(data.input)}
            </pre>
          )}
          {error ? (
            <pre className="whitespace-pre-wrap wrap-break-word text-destructive">
              {formatDisplayValue(error)}
            </pre>
          ) : (
            hasOutput && (
              <pre className="whitespace-pre-wrap wrap-break-word">
                {formatDisplayValue(fallback)}
              </pre>
            )
          )}
        </CardContent>
      )}
    </Card>
  );
}

function UnknownBlock({ content }: { content: TMessageContentComplex }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">Assistant Content</CardTitle>
        <Badge variant="outline">{content.type ?? 'unknown'}</Badge>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        <pre className="whitespace-pre-wrap break-words">
          {safeJson(content)}
        </pre>
      </CardContent>
    </Card>
  );
}

export function renderContentItem(
  content: TMessageContentComplex | string,
  index: number,
  message: ChatkitMessage,
  lookupMessages: ChatkitMessage[],
  options?: AssistantContentRenderOptions,
): React.ReactNode {
  const messageId = message.id;
  const textClassName = options?.isAgentOutput
    ? 'text-sm [&_.markdown-content_p]:!leading-6'
    : undefined;

  if (typeof content === 'string') {
    return (
      <div key={`text-${index}`} className={textClassName}>
        <MarkdownText>{content}</MarkdownText>
      </div>
    );
  }

  if (isNonTranscriptMessageContent(content)) {
    return null;
  }

  if (isTextContent(content)) {
    return (
      <div key={content.id ?? `text-${index}`} className={textClassName}>
        <MarkdownText>{content.text}</MarkdownText>
      </div>
    );
  }

  if (isReasoningContent(content)) {
    return (
      <div key={`reasoning-${content.id ?? index}`}>
        <ReasoningBlock
          reasoning={[content]}
          isReasoning={options?.isReasoning}
        />
      </div>
    );
  }

  if (isImageContent(content)) {
    return (
      <div key={content.id ?? `image-${index}`}>
        <ImageBlock content={content} />
      </div>
    );
  }

  if (isComponentContent(content)) {
    if (isContextCompressionComponent(content)) {
      return (
        <div
          key={content.id ?? `context-compression-${index}`}
          className="w-full"
        >
          <ContextCompressionMessage content={content} />
        </div>
      );
    }

    const requestUserInputResult = getRequestUserInputResultCardData(
      content,
      lookupMessages,
    );
    if (requestUserInputResult) {
      return (
        <div key={content.id ?? `request-user-input-result-${index}`}>
          <RequestUserInputResultCard result={requestUserInputResult} />
        </div>
      );
    }

    if (isWidgetComponent(content)) {
      return (
        <div key={content.id ?? `widget-${index}`}>
          <WidgetMessage messageId={messageId} data={content.data} />
        </div>
      );
    }

    if (isMcpAppComponent(content)) {
      if (message.historical) {
        return (
          <HistoricalMcpAppResult
            key={content.id ?? `mcp-app-${index}`}
            data={content.data}
          />
        );
      }
      return (
        <div key={content.id ?? `mcp-app-${index}`}>
          <McpAppMessage
            messageId={messageId}
            data={content.data}
            mcpApps={options?.mcpApps}
          />
        </div>
      );
    }

    if (
      getComponentMessagePresentation(content, getToolStepData(content)) ===
      'grouped-step'
    ) {
      return (
        <div key={content.id ?? `component-group-${index}`}>
          <ToolComponentGroup
            items={[content]}
            hasFollowingItem={false}
            isThreadRunning={options?.isThreadRunning}
            isThreadPaused={options?.isThreadPaused}
            organizationId={options?.organizationId}
            apiUrl={options?.apiUrl}
          />
        </div>
      );
    }

    return (
      <div key={content.id ?? `component-${index}`}>
        <ComponentBlock content={content} />
      </div>
    );
  }

  if (isMemoryContent(content)) {
    return (
      <div key={content.id ?? `memory-${index}`}>
        <MemoryBlock content={content} />
      </div>
    );
  }

  if (isAgentEventContent(content)) {
    return (
      <div key={content.id ?? `agent-event-${index}`}>
        <AgentEventRow content={content} />
      </div>
    );
  }

  return (
    <div key={content.id ?? `unknown-${index}`}>
      <UnknownBlock content={content} />
    </div>
  );
}
