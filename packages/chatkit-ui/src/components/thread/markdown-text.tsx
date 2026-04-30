'use client';

import './markdown-styles.css';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import {
  Children,
  isValidElement,
  memo,
  type ComponentPropsWithoutRef,
  type FC,
  type ReactNode,
  useId,
  useState,
} from 'react';
import { CheckIcon, ChevronDownIcon, CopyIcon, DownloadIcon, ListChecksIcon } from 'lucide-react';
import { SyntaxHighlighter } from './syntax-highlighter';
import { MermaidBlock } from './mermaid-block';

import { TooltipIconButton } from './tooltip-icon-button';
import { cn } from '../../lib/utils';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

import 'katex/dist/katex.min.css';

interface CodeHeaderProps {
  language?: string;
  code: string;
}

type MarkdownSegment =
  | {
      content: string;
      type: 'markdown';
    }
  | {
      content: string;
      type: 'plan';
    };

type FenceMarker = {
  char: string;
  length: number;
};

const markdownTableMinWidth =
  'max(7rem, calc(8rem * var(--density-spacing, 1)))';
const markdownTableCellPaddingInline =
  'calc(var(--density-padding, 1rem) * 1.25)';
const markdownTableCellPaddingBlock =
  'max(0.5rem, calc(var(--density-padding, 1rem) * 0.75))';
const markdownTableLineHeight =
  'max(1.375rem, calc(1.5rem * var(--density-spacing, 1)))';
const markdownInlineCodePaddingInline =
  'max(0.25rem, calc(var(--density-gap, 0.5rem) * 0.75))';
const markdownInlineCodePaddingBlock =
  'max(0.125rem, calc(var(--density-gap, 0.5rem) * 0.5))';
const proposedPlanOpenPattern = /^\s*<proposed_plan>\s*$/;
const proposedPlanClosePattern = /^\s*<\/proposed_plan>\s*$/;
const markdownFencePattern = /^ {0,3}(`{3,}|~{3,})/;
const planMarkdownFencePattern =
  /^\s*(`{3,}|~{3,})[ \t]*(?:markdown|md)[^\n]*\r?\n([\s\S]*?)\r?\n\1[ \t]*\s*$/i;

type MarkdownElementProps<T extends keyof JSX.IntrinsicElements> =
  ComponentPropsWithoutRef<T> & {
    node?: unknown;
  };

const stripMarkdownNode = <T extends { node?: unknown }>(
  props: T,
): Omit<T, 'node'> => {
  const elementProps = { ...props };
  delete elementProps.node;

  return elementProps;
};

const getTextContent = (children: ReactNode) =>
  Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }

      return '';
    })
    .join('');

const getFenceMarker = (line: string): FenceMarker | null => {
  const match = markdownFencePattern.exec(line);
  if (!match) return null;

  return {
    char: match[1][0],
    length: match[1].length,
  };
};

const updateFenceMarker = (
  currentFence: FenceMarker | null,
  line: string,
): FenceMarker | null => {
  const marker = getFenceMarker(line);
  if (!marker) return currentFence;

  if (!currentFence) {
    return marker;
  }

  if (
    marker.char === currentFence.char &&
    marker.length >= currentFence.length
  ) {
    return null;
  }

  return currentFence;
};

const normalizePlanMarkdown = (markdown: string) => {
  const trimmed = markdown.trim();
  const match = planMarkdownFencePattern.exec(trimmed);

  return match ? match[2].trim() : trimmed;
};

const downloadMarkdown = (markdown: string) => {
  if (!markdown) return;

  const content = markdown.endsWith('\n') ? markdown : `${markdown}\n`;
  const blob = new Blob([content], {
    type: 'text/markdown;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = 'plan.md';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const splitProposedPlanSegments = (markdown: string): MarkdownSegment[] => {
  const segments: MarkdownSegment[] = [];
  const markdownLines: string[] = [];
  let planLines: string[] | null = null;
  let fence: FenceMarker | null = null;

  const flushMarkdown = () => {
    if (markdownLines.length === 0) return;

    segments.push({
      type: 'markdown',
      content: markdownLines.join('\n'),
    });
    markdownLines.length = 0;
  };

  const flushPlan = () => {
    if (!planLines) return;

    segments.push({
      type: 'plan',
      content: planLines.join('\n'),
    });
    planLines = null;
  };

  for (const line of markdown.split(/\r?\n/)) {
    if (!fence && !planLines && proposedPlanOpenPattern.test(line)) {
      flushMarkdown();
      planLines = [];
      continue;
    }

    if (!fence && planLines && proposedPlanClosePattern.test(line)) {
      flushPlan();
      continue;
    }

    if (planLines) {
      planLines.push(line);
    } else {
      markdownLines.push(line);
    }

    fence = updateFenceMarker(fence, line);
  }

  flushPlan();
  flushMarkdown();

  return segments;
};

function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={defaultComponents}
    >
      {children}
    </ReactMarkdown>
  );
}

function PlanCard({ children }: { children: string }) {
  const { t } = useChatkitTranslation();
  const planMarkdown = normalizePlanMarkdown(children);
  const contentId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!planMarkdown || isCopied) return;
    copyToClipboard(planMarkdown);
  };
  const onDownload = () => {
    downloadMarkdown(planMarkdown);
  };

  return (
    <section
      data-slot="markdown-plan-card"
      className={cn(
        'relative my-5 max-w-4xl overflow-hidden rounded-2xl border border-border bg-muted/25 shadow-lg',
      )}
    >
      <div
        data-slot="markdown-plan-card-header"
        className="flex items-center justify-between gap-3 bg-background/80 px-4 py-3"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ListChecksIcon className="size-4" />
          </span>
          <h2 className="truncate text-base font-semibold text-foreground">
            {t('markdown.plan.title')}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TooltipIconButton
            type="button"
            tooltip={t('markdown.plan.download')}
            onClick={onDownload}
            className="text-muted-foreground hover:text-foreground"
          >
            <DownloadIcon className="size-4" />
          </TooltipIconButton>
          <TooltipIconButton
            type="button"
            tooltip={isCopied ? t('messageActions.copied') : t('markdown.copy')}
            onClick={onCopy}
            className="text-muted-foreground hover:text-foreground"
          >
            {!isCopied && <CopyIcon className="size-4" />}
            {isCopied && <CheckIcon className="size-4" />}
          </TooltipIconButton>
          <TooltipIconButton
            type="button"
            tooltip={
              isExpanded
                ? t('markdown.plan.collapse')
                : t('markdown.plan.expand')
            }
            aria-expanded={isExpanded}
            aria-controls={contentId}
            onClick={() => setIsExpanded((previous) => !previous)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronDownIcon
              className={cn(
                'size-4 transition-transform',
                isExpanded && 'rotate-180',
              )}
            />
          </TooltipIconButton>
        </div>
      </div>
      <div
        id={contentId}
        data-slot="markdown-plan-card-content"
        data-state={isExpanded ? 'expanded' : 'collapsed'}
        className={cn(
          'relative w-full px-4 py-3 transition-[max-height] duration-300 ease-in-out',
          isExpanded
            ? 'max-h-[80vh] overflow-auto'
            : 'max-h-[200px] overflow-hidden',
        )}
      >
        <MarkdownContent>{planMarkdown}</MarkdownContent>
      </div>
      {!isExpanded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-32 items-end justify-center bg-gradient-to-b from-background/0 via-background/80 to-background/95 pb-6">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="pointer-events-auto rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90"
          >
            {t('markdown.plan.expand')}
          </button>
        </div>
      )}
    </section>
  );
}

const isMermaidBlockChild = (child: ReactNode) =>
  isValidElement(child) && child.type === MermaidBlock;

const isMermaidCodeElement = (child: ReactNode) =>
  isValidElement<{ className?: string }>(child) &&
  typeof child.props.className === 'string' &&
  child.props.className.includes('language-mermaid');

function useCopyToClipboard({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
}

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { t } = useChatkitTranslation();
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-t-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
      <span className="lowercase [&>span]:text-xs">{language}</span>
      <TooltipIconButton tooltip={t('markdown.copy')} onClick={onCopy}>
        {!isCopied && <CopyIcon />}
        {isCopied && <CheckIcon />}
      </TooltipIconButton>
    </div>
  );
};

const defaultComponents: any = {
  h1: ({ className, ...props }: MarkdownElementProps<'h1'>) => (
    <h1
      className={cn(
        'mb-8 scroll-m-20 text-4xl font-extrabold tracking-tight last:mb-0',
        className,
      )}
      {...stripMarkdownNode(props)}
    />
  ),
  h2: ({ className, ...props }: MarkdownElementProps<'h2'>) => (
    <h2
      className={cn(
        'mt-8 mb-4 scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0 last:mb-0',
        className,
      )}
      {...stripMarkdownNode(props)}
    />
  ),
  h3: ({ className, ...props }: MarkdownElementProps<'h3'>) => (
    <h3
      className={cn(
        'mt-6 mb-4 scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0 last:mb-0',
        className,
      )}
      {...stripMarkdownNode(props)}
    />
  ),
  h4: ({ className, ...props }: MarkdownElementProps<'h4'>) => (
    <h4
      className={cn(
        'mt-6 mb-4 scroll-m-20 text-xl font-semibold tracking-tight first:mt-0 last:mb-0',
        className,
      )}
      {...stripMarkdownNode(props)}
    />
  ),
  h5: ({ className, ...props }: MarkdownElementProps<'h5'>) => (
    <h5
      className={cn(
        'my-4 text-lg font-semibold first:mt-0 last:mb-0',
        className,
      )}
      {...stripMarkdownNode(props)}
    />
  ),
  h6: ({ className, ...props }: MarkdownElementProps<'h6'>) => (
    <h6
      className={cn('my-4 font-semibold first:mt-0 last:mb-0', className)}
      {...stripMarkdownNode(props)}
    />
  ),
  p: ({ className, ...props }: MarkdownElementProps<'p'>) => (
    <p
      className={cn('mt-5 mb-5 leading-7 first:mt-0 last:mb-0', className)}
      {...stripMarkdownNode(props)}
    />
  ),
  a: ({ className, ...props }: MarkdownElementProps<'a'>) => (
    <a
      className={cn(
        'text-primary font-medium underline underline-offset-4',
        className,
      )}
      target="_blank"
      rel="noopener noreferrer"
      {...stripMarkdownNode(props)}
    />
  ),
  blockquote: ({ className, ...props }: MarkdownElementProps<'blockquote'>) => (
    <blockquote
      className={cn(
        'border-l-4 border-border pl-6 italic text-muted-foreground',
        className,
      )}
      {...stripMarkdownNode(props)}
    />
  ),
  ul: ({ className, ...props }: MarkdownElementProps<'ul'>) => (
    <ul
      className={cn('my-5 list-outside list-disc pl-6 [&>li]:mt-2', className)}
      {...stripMarkdownNode(props)}
    />
  ),
  ol: ({ className, ...props }: MarkdownElementProps<'ol'>) => (
    <ol
      className={cn(
        'my-5 list-outside list-decimal pl-8 [&>li]:mt-2',
        className,
      )}
      {...stripMarkdownNode(props)}
    />
  ),
  hr: ({ className, ...props }: MarkdownElementProps<'hr'>) => (
    <hr
      className={cn('my-5 border-b', className)}
      {...stripMarkdownNode(props)}
    />
  ),
  table: ({ className, style, ...props }: MarkdownElementProps<'table'>) => (
    <div
      data-slot="markdown-table-container"
      className="my-5 max-w-full overflow-x-auto rounded-xl border border-border bg-background"
    >
      <table
        className={cn(
          'min-w-full w-max border-separate border-spacing-0 text-sm',
          className,
        )}
        style={{
          lineHeight: markdownTableLineHeight,
          ...style,
        }}
        {...stripMarkdownNode(props)}
      />
    </div>
  ),
  th: ({ className, style, ...props }: MarkdownElementProps<'th'>) => (
    <th
      className={cn(
        'bg-muted/80 border-border border-l text-left align-top font-semibold whitespace-normal break-words first:border-l-0 first:rounded-tl-xl last:rounded-tr-xl [&[align=center]]:text-center [&[align=right]]:text-right',
        className,
      )}
      style={{
        minWidth: markdownTableMinWidth,
        paddingInline: markdownTableCellPaddingInline,
        paddingBlock: markdownTableCellPaddingBlock,
        ...style,
      }}
      {...stripMarkdownNode(props)}
    />
  ),
  td: ({ className, style, ...props }: MarkdownElementProps<'td'>) => (
    <td
      className={cn(
        'border-border border-t border-l text-left align-top whitespace-normal break-words first:border-l-0 [&[align=center]]:text-center [&[align=right]]:text-right [&_code]:break-words [&_code]:whitespace-pre-wrap [&_code]:[overflow-wrap:anywhere]',
        className,
      )}
      style={{
        minWidth: markdownTableMinWidth,
        paddingInline: markdownTableCellPaddingInline,
        paddingBlock: markdownTableCellPaddingBlock,
        ...style,
      }}
      {...stripMarkdownNode(props)}
    />
  ),
  tr: ({ className, ...props }: MarkdownElementProps<'tr'>) => (
    <tr
      className={cn(
        'm-0 p-0 even:bg-muted/30 [&:last-child>td:first-child]:rounded-bl-xl [&:last-child>td:last-child]:rounded-br-xl',
        className,
      )}
      {...stripMarkdownNode(props)}
    />
  ),
  sup: ({ className, ...props }: MarkdownElementProps<'sup'>) => (
    <sup
      className={cn('[&>a]:text-xs [&>a]:no-underline', className)}
      {...stripMarkdownNode(props)}
    />
  ),
  pre: ({ className, children }: MarkdownElementProps<'pre'>) =>
    Children.toArray(children).length === 1 &&
    (isMermaidBlockChild(Children.toArray(children)[0]) ||
      isMermaidCodeElement(Children.toArray(children)[0])) ? (
      <>{children}</>
    ) : (
      <div
        className={cn(
          'max-w-4xl overflow-x-auto rounded-lg text-sm bg-black text-white dark:bg-zinc-800',
          className,
        )}
      >
        {children}
      </div>
    ),
  code: ({
    className,
    children,
    style,
    ...props
  }: MarkdownElementProps<'code'>) => {
    const match = /language-([\w-]+)/.exec(className || '');
    const code = getTextContent(children);
    const isBlockCode = code.includes('\n');

    if (match) {
      const language = match[1];
      const normalizedCode = code.replace(/\n$/, '');

      if (language === 'mermaid') {
        return <MermaidBlock code={normalizedCode} />;
      }

      return (
        <>
          <CodeHeader language={language} code={normalizedCode} />
          <SyntaxHighlighter language={language} className={className}>
            {normalizedCode}
          </SyntaxHighlighter>
        </>
      );
    }

    if (isBlockCode) {
      return (
        <code
          className={cn(
            'block min-w-full whitespace-pre px-4 py-4 font-mono text-inherit',
            className,
          )}
          {...stripMarkdownNode(props)}
        >
          {code.replace(/\n$/, '')}
        </code>
      );
    }

    return (
      <code
        className={cn(
          'bg-muted rounded font-mono text-[0.9em] font-semibold whitespace-pre-wrap [overflow-wrap:anywhere]',
          className,
        )}
        style={{
          paddingInline: markdownInlineCodePaddingInline,
          paddingBlock: markdownInlineCodePaddingBlock,
          ...style,
        }}
        {...stripMarkdownNode(props)}
      >
        {children}
      </code>
    );
  },
};

const MarkdownTextImpl: FC<{ children: string }> = ({ children }) => {
  return (
    <div className="markdown-content">
      {splitProposedPlanSegments(children).map((segment, index) =>
        segment.type === 'plan' ? (
          <PlanCard key={index}>{segment.content}</PlanCard>
        ) : (
          <MarkdownContent key={index}>{segment.content}</MarkdownContent>
        ),
      )}
    </div>
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
