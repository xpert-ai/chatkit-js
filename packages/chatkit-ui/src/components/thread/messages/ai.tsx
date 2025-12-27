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
  const data = content.data as TMessageComponentWidgetData | undefined;
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
          <p className="whitespace-pre-wrap break-words leading-relaxed">{item.text}</p>
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
        <pre className="whitespace-pre-wrap break-words">{safeJson(content.data ?? [])}</pre>
      </CardContent>
    </Card>
  );
}

function ComponentBlock({ content }: { content: TMessageContentComponent }) {
  
  console.log(content);

  const data = (content.data ?? {}) as Record<string, unknown>;
  const title =
    typeof data.title === 'string'
      ? data.title
      : typeof data.type === 'string'
        ? data.type
        : 'Component';
  const category = typeof data.category === 'string' ? data.category : 'Component';
  const status = typeof data.status === 'string' ? data.status : null;
  const message = typeof data.message === 'string' ? data.message : null;
  const output = typeof data.output === 'string' ? data.output : null;
  const fallback = message ?? output ?? safeJson(data.data ?? data.input ?? data);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-sm">{title}</CardTitle>
          <p className="text-xs text-muted-foreground">{category}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{category}</Badge>
          {status && <Badge variant="outline">{status}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        <pre className="whitespace-pre-wrap break-words">{fallback}</pre>
      </CardContent>
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

function renderContent(content: ChatkitMessage['content'], messageId: string) {
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

export function AssistantMessage({ message, className, isStreaming = false }: AssistantMessageProps) {
  const hasContent =
    message.content != null &&
    !(
      (typeof message.content === 'string' && message.content.trim() === '') ||
      (Array.isArray(message.content) && message.content.length === 0)
    );
  const hasReasoning =
    Array.isArray(message.reasoning) &&
    message.reasoning.some((item) => item.text?.trim());

  const answerNode = renderContent(message.content, message.id);
  const reasoningNode = hasReasoning ? (
    <ReasoningBlock reasoning={message.reasoning ?? []} />
  ) : null;

  if (!hasContent && !hasReasoning) return null;

  // Streaming class for smooth animation effect
  const streamingClass = isStreaming ? 'streaming-active' : '';

  if (hasContent && hasReasoning) {
    return (
      <div className={cn('space-y-3', streamingClass, className)}>
        <Tabs
          defaultValue={message.status === 'reasoning' ? 'reasoning' : 'answer'}
          className="w-full"
        >
          <TabsList className="h-9">
            <TabsTrigger value="answer">Answer</TabsTrigger>
            <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
          </TabsList>
          <TabsContent value="answer" className="space-y-3">
            {answerNode}
          </TabsContent>
          <TabsContent value="reasoning" className="space-y-3">
            {reasoningNode}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', streamingClass, className)}>
      {hasReasoning ? reasoningNode : answerNode}
    </div>
  );
}
