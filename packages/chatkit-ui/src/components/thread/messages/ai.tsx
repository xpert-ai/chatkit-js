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
  TMessageComponentStep,
} from '@xpert-ai/chatkit-types';
import { ChevronDown, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

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
import { WidgetMessage } from './widget';

export type AssistantMessageProps = {
  message: ChatkitMessage & { type: 'assistant' };
  className?: string;
  isStreaming?: boolean;
  streamingStatus?: AssistantStreamingStatus | null;
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

// Status styling configuration
const statusConfig = {
  success: {
    iconClass: 'border-green-500 text-green-700',
    icon: CheckCircle2,
  },
  fail: {
    iconClass: 'border-red-500 text-red-700',
    icon: XCircle,
  },
  running: {
    iconClass: 'border-blue-500 text-blue-700',
    icon: Loader2,
  },
};

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

/** Partial step data: during streaming, fields arrive incrementally */
type PartialStepData = Partial<TMessageComponentStep & { category?: string }>;

function ComponentBlock({ content }: { content: TMessageContentComponent }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = React.useRef(true);
  const previousScrollTopRef = React.useRef(0);

  const data = (content.data ?? {}) as PartialStepData;
  const category = data.category ?? 'Component';
  const title =
    data.tool && category === 'Tool'
      ? data.tool
      : data.title ?? data.type ?? 'Component';
  const status = data.status ?? null;
  const message = data.message ?? null;
  const output = data.output ?? null;
  const error = data.error ?? null;
  const fallback = message ?? output ?? safeJson(data.data ?? data);
  const hasOutput = message !== null || output !== null;

  // Auto-expand when running with output available
  React.useEffect(() => {
    if (status === 'running' && output !== null) setIsExpanded(true);
  }, [status, output]);

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

  const config = status ? statusConfig[status] : null;
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
            <pre className="whitespace-pre-wrap wrap-break-word">{JSON.stringify(data.input, null, 2)}</pre>
          )}
          {error ? (
            <pre className="whitespace-pre-wrap wrap-break-word text-destructive">{typeof error === 'string' ? error : safeJson(error)}</pre>
          ) : (
            hasOutput && (
              <pre className="whitespace-pre-wrap wrap-break-word">{fallback}</pre>
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
  messageId: string,
): React.ReactNode {
  if (typeof content === 'string') {
    return <div key={`text-${index}`}>
      <MarkdownText>{content}</MarkdownText>;
    </div>;
  }

  if (isTextContent(content)) {
    return <div key={content.id ?? `text-${index}`}><MarkdownText>{content.text}</MarkdownText></div>;
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

function renderContent(content: ChatkitMessage['content'] | any, messageId: string) {
  if (typeof content === 'string') {
    if (!content.trim()) return null;
    return <MarkdownText>{content}</MarkdownText>;
  }

  if (!Array.isArray(content) || content.length === 0) return null;

  return (
    <div className="space-y-3">
      {content.map((item, index) => renderContentItem(item, index, messageId))}
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
  className,
  isStreaming = false,
  streamingStatus,
}: AssistantMessageProps) {
  const { t } = useChatkitTranslation();
  const hasContent = hasRenderableMessageContent(message.content);
  const hasReasoning = hasRenderableReasoning(message.reasoning);
  const resolvedStreamingStatus =
    streamingStatus ?? getAssistantStreamingStatus(message, isStreaming);

  const answerNode = renderContent(message.content, message.id);
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
