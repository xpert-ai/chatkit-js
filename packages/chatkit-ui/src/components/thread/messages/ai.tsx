import * as React from 'react';

import type {
  ChatkitMessage,
  MessageContentImageUrl,
  TMessageContentComplex,
  TMessageContentComponent,
  TMessageComponentWidgetData,
  TMessageContentMemory,
  TMessageContentReasoning,
  TMessageContentText,
} from '@xpert-ai/chatkit-types';
import {
  ChevronDown,
  Clock3,
  Loader2,
} from 'lucide-react';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import {
  type AssistantStreamingStatus,
  getAssistantStreamingStatus,
  hasRenderableAssistantMessage,
  hasRenderableMessageContent,
  hasRenderableReasoning,
} from '../../../lib/message';
import { isNearBottom } from '../../../lib/scroll';
import { cn } from '../../../lib/utils';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { MarkdownText } from '../markdown-text';
import {
  buildToolComponentRenderUnits,
  getToolActivityLabel,
  getToolStepData,
  ToolComponentGroup,
  toolStatusConfig,
  type ToolComponentRenderUnit,
} from './tool-component-group';
import {
  getRequestUserInputResultCardData,
  RequestUserInputResultCard,
} from './request-user-input-result-card';
import { WidgetMessage } from './widget';

export type AssistantMessageProps = {
  message: ChatkitMessage & { type: 'assistant' };
  messages?: ChatkitMessage[];
  className?: string;
  isStreaming?: boolean;
  streamingStatus?: AssistantStreamingStatus | null;
  isThreadRunning?: boolean;
  organizationId?: string;
  apiUrl?: string;
};

function isTextContent(content: TMessageContentComplex): content is TMessageContentText {
  return content.type === 'text';
}

function isReasoningContent(content: TMessageContentComplex): content is TMessageContentReasoning {
  return content.type === 'reasoning';
}

function isImageContent(content: TMessageContentComplex): content is MessageContentImageUrl {
  return content.type === 'image_url';
}

function isComponentContent(content: TMessageContentComplex): content is TMessageContentComponent {
  return content.type === 'component';
}

function isWidgetComponent(
  content: TMessageContentComponent,
): content is TMessageContentComponent<TMessageComponentWidgetData> {
  const data = content.data as Record<string, unknown> | undefined;
  return data?.type === 'Widget' && Array.isArray(data.widgets);
}

function isMemoryContent(content: TMessageContentComplex): content is TMessageContentMemory {
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

function ReasoningBlock({ reasoning }: { reasoning: TMessageContentReasoning[] }) {
  const blocks = reasoning.filter((item) => item.text?.trim());
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-2">
      {blocks.map((item, index) => (
        <div
          key={item.id ?? `reasoning-${index}`}
          className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground"
        >
          <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">{item.text}</p>
        </div>
      ))}
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
      <img src={imageUrl} alt="Assistant output" className="h-auto w-full object-cover" />
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
        <pre className="whitespace-pre-wrap wrap-break-word">{safeJson(content.data ?? [])}</pre>
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
    element.addEventListener('scroll', updateAutoScrollState, { passive: true });

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
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-2 py-1 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center space-x-1 flex-1 min-w-0">
          {status && StatusIcon && (
            <StatusIcon className={cn("h-4 w-4", config?.iconClass, status === 'running' && "animate-spin")} />
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
          <Badge variant="secondary" className="rounded-lg px-1.5">{category}</Badge>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
            />
          </button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent ref={contentRef} className="text-xs text-muted-foreground max-h-60 overflow-auto">
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
        <pre className="whitespace-pre-wrap break-words">{safeJson(content)}</pre>
      </CardContent>
    </Card>
  );
}

function renderContentItem(
  content: TMessageContentComplex | string,
  index: number,
  message: ChatkitMessage,
  lookupMessages: ChatkitMessage[],
): React.ReactNode {
  const messageId = message.id;

  if (typeof content === 'string') {
    return (
      <div key={`text-${index}`}>
        <MarkdownText>{content}</MarkdownText>
      </div>
    );
  }

  if (isTextContent(content)) {
    return (
      <div key={content.id ?? `text-${index}`}>
        <MarkdownText>{content.text}</MarkdownText>
      </div>
    );
  }

  if (isReasoningContent(content)) {
    return (
      <div key={content.id ?? `reasoning-${index}`}>
        <ReasoningBlock reasoning={[content]} />
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

  return (
    <div key={content.id ?? `unknown-${index}`}>
      <UnknownBlock content={content} />
    </div>
  );
}

function renderContentUnit(
  unit: ToolComponentRenderUnit,
  message: ChatkitMessage,
  lookupMessages: ChatkitMessage[],
  hasFollowingItem: boolean,
  options?: {
    isThreadRunning?: boolean;
    organizationId?: string;
    apiUrl?: string;
  },
): React.ReactNode {
  if (unit.type === 'item') {
    return renderContentItem(unit.item, unit.index, message, lookupMessages);
  }

  return (
    <div
      key={`tool-group-${unit.startIndex}-${unit.items[0]?.id ?? 'tool'}-${unit.items.length}`}
    >
      <ToolComponentGroup
        items={unit.items}
        hasFollowingItem={hasFollowingItem}
        isThreadRunning={options?.isThreadRunning}
        organizationId={options?.organizationId}
        apiUrl={options?.apiUrl}
      />
    </div>
  );
}

function renderContent(
  message: ChatkitMessage,
  lookupMessages: ChatkitMessage[],
  options?: {
    isThreadRunning?: boolean;
    organizationId?: string;
    apiUrl?: string;
  },
) {
  const content = message.content;
  if (typeof content === 'string') {
    if (!content.trim()) return null;
    return <MarkdownText>{content}</MarkdownText>;
  }

  if (!Array.isArray(content) || content.length === 0) return null;

  const renderUnits = buildToolComponentRenderUnits(content, {
    shouldGroupComponent: (item) =>
      getRequestUserInputResultCardData(item, lookupMessages) === null,
  });

  return (
    <div className="space-y-3">
      {renderUnits.map((unit, index) =>
        renderContentUnit(
          unit,
          message,
          lookupMessages,
          index < renderUnits.length - 1,
          options,
        ),
      )}
    </div>
  );
}

export function AssistantStreamingIndicator({
  status,
  className,
}: {
  status: AssistantStreamingStatus;
  className?: string;
}) {
  const { t } = useChatkitTranslation();
  const labelMap: Record<AssistantStreamingStatus, string> = {
    loading: t('message.loading'),
    thinking: t('message.thinking'),
    answering: t('message.answering'),
  };

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      {status === 'loading' && (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      )}
      {status === 'thinking' && (
        <div className="flex items-end gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
        </div>
      )}
      {status === 'answering' && (
        <div className="flex items-end gap-1" aria-hidden="true">
          <span className="h-2 w-0.5 rounded-full bg-current animate-pulse [animation-delay:-0.25s]" />
          <span className="h-3 w-0.5 rounded-full bg-current animate-pulse [animation-delay:-0.1s]" />
          <span className="h-2.5 w-0.5 rounded-full bg-current animate-pulse" />
        </div>
      )}
      <span>{labelMap[status]}</span>
    </div>
  );
}

export function AssistantMessage({
  message,
  messages,
  className,
  isStreaming = false,
  streamingStatus,
  isThreadRunning,
  organizationId,
  apiUrl,
}: AssistantMessageProps) {
  const { t } = useChatkitTranslation();
  const hasContent = hasRenderableMessageContent(message.content);
  const hasReasoning = hasRenderableReasoning(message.reasoning);
  const resolvedStreamingStatus =
    streamingStatus ?? getAssistantStreamingStatus(message, isStreaming);
  const lookupMessages = messages?.length ? messages : [message];

  const answerNode = renderContent(message, lookupMessages, {
    isThreadRunning,
    organizationId,
    apiUrl,
  });
  const reasoningNode = hasReasoning ? (
    <ReasoningBlock reasoning={message.reasoning ?? []} />
  ) : null;

  if (!hasRenderableAssistantMessage(message) && !resolvedStreamingStatus) return null;

  // Streaming class for smooth animation effect
  const streamingClass = isStreaming ? 'streaming-active' : '';

  if (!hasRenderableAssistantMessage(message) && resolvedStreamingStatus) {
    return (
      <div className={cn('space-y-3', streamingClass, className)}>
        <AssistantStreamingIndicator status={resolvedStreamingStatus} />
      </div>
    );
  }

  if (hasContent && hasReasoning) {
    return (
      <div className={cn('space-y-3', streamingClass, className)}>
        <Tabs
          defaultValue={message.status === 'reasoning' ? 'reasoning' : 'answer'}
          className="w-full"
        >
          <TabsList className="">
            <TabsTrigger value="answer">{t('message.answer')}</TabsTrigger>
            <TabsTrigger value="reasoning">{t('message.reasoning')}</TabsTrigger>
          </TabsList>
          <TabsContent value="answer" className="space-y-3">
            {answerNode}
          </TabsContent>
          <TabsContent value="reasoning" className="space-y-3">
            {reasoningNode}
          </TabsContent>
        </Tabs>
        {resolvedStreamingStatus ? (
          <AssistantStreamingIndicator status={resolvedStreamingStatus} />
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', streamingClass, className)}>
      {hasReasoning ? reasoningNode : answerNode}
      {resolvedStreamingStatus ? (
        <AssistantStreamingIndicator status={resolvedStreamingStatus} />
      ) : null}
    </div>
  );
}
