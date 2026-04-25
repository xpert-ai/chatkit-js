"use client";

import "./markdown-styles.css";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import {
  Children,
  isValidElement,
  memo,
  type ComponentPropsWithoutRef,
  type FC,
  type ReactNode,
  useState,
} from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { SyntaxHighlighter } from "./syntax-highlighter";
import { MermaidBlock } from "./mermaid-block";

import { TooltipIconButton } from "./tooltip-icon-button";
import { cn } from "../../lib/utils";
import { useChatkitTranslation } from "../../i18n/useChatkitTranslation";

import "katex/dist/katex.min.css";

interface CodeHeaderProps {
  language?: string;
  code: string;
}

const markdownTableMinWidth = "max(7rem, calc(8rem * var(--density-spacing, 1)))";
const markdownTableCellPaddingInline =
  "calc(var(--density-padding, 1rem) * 1.25)";
const markdownTableCellPaddingBlock =
  "max(0.5rem, calc(var(--density-padding, 1rem) * 0.75))";
const markdownTableLineHeight =
  "max(1.375rem, calc(1.5rem * var(--density-spacing, 1)))";
const markdownInlineCodePaddingInline =
  "max(0.25rem, calc(var(--density-gap, 0.5rem) * 0.75))";
const markdownInlineCodePaddingBlock =
  "max(0.125rem, calc(var(--density-gap, 0.5rem) * 0.5))";

type MarkdownElementProps<T extends keyof JSX.IntrinsicElements> =
  ComponentPropsWithoutRef<T> & {
    node?: unknown;
  };

const getTextContent = (children: ReactNode) =>
  Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      return "";
    })
    .join("");

const isMermaidBlockChild = (child: ReactNode) =>
  isValidElement(child) && child.type === MermaidBlock;

const isMermaidCodeElement = (child: ReactNode) =>
  isValidElement<{ className?: string }>(child) &&
  typeof child.props.className === "string" &&
  child.props.className.includes("language-mermaid");

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};

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
      <TooltipIconButton
        tooltip={t("markdown.copy")}
        onClick={onCopy}
      >
        {!isCopied && <CopyIcon />}
        {isCopied && <CheckIcon />}
      </TooltipIconButton>
    </div>
  );
};

const defaultComponents: any = {
  h1: ({ className, node: _node, ...props }: MarkdownElementProps<"h1">) => (
    <h1
      className={cn(
        "mb-8 scroll-m-20 text-4xl font-extrabold tracking-tight last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, node: _node, ...props }: MarkdownElementProps<"h2">) => (
    <h2
      className={cn(
        "mt-8 mb-4 scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, node: _node, ...props }: MarkdownElementProps<"h3">) => (
    <h3
      className={cn(
        "mt-6 mb-4 scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, node: _node, ...props }: MarkdownElementProps<"h4">) => (
    <h4
      className={cn(
        "mt-6 mb-4 scroll-m-20 text-xl font-semibold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h5: ({ className, node: _node, ...props }: MarkdownElementProps<"h5">) => (
    <h5
      className={cn(
        "my-4 text-lg font-semibold first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h6: ({ className, node: _node, ...props }: MarkdownElementProps<"h6">) => (
    <h6
      className={cn("my-4 font-semibold first:mt-0 last:mb-0", className)}
      {...props}
    />
  ),
  p: ({ className, node: _node, ...props }: MarkdownElementProps<"p">) => (
    <p
      className={cn("mt-5 mb-5 leading-7 first:mt-0 last:mb-0", className)}
      {...props}
    />
  ),
  a: ({ className, node: _node, ...props }: MarkdownElementProps<"a">) => (
    <a
      className={cn(
        "text-primary font-medium underline underline-offset-4",
        className,
      )}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: ({
    className,
    node: _node,
    ...props
  }: MarkdownElementProps<"blockquote">) => (
    <blockquote
      className={cn(
        "border-l-4 border-border pl-6 italic text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, node: _node, ...props }: MarkdownElementProps<"ul">) => (
    <ul
      className={cn("my-5 list-outside list-disc pl-6 [&>li]:mt-2", className)}
      {...props}
    />
  ),
  ol: ({ className, node: _node, ...props }: MarkdownElementProps<"ol">) => (
    <ol
      className={cn("my-5 list-outside list-decimal pl-8 [&>li]:mt-2", className)}
      {...props}
    />
  ),
  hr: ({ className, node: _node, ...props }: MarkdownElementProps<"hr">) => (
    <hr
      className={cn("my-5 border-b", className)}
      {...props}
    />
  ),
  table: ({
    className,
    node: _node,
    style,
    ...props
  }: MarkdownElementProps<"table">) => (
    <div
      data-slot="markdown-table-container"
      className="my-5 max-w-full overflow-x-auto rounded-xl border border-border bg-background"
    >
      <table
        className={cn(
          "min-w-full w-max border-separate border-spacing-0 text-sm",
          className,
        )}
        style={{
          lineHeight: markdownTableLineHeight,
          ...style,
        }}
        {...props}
      />
    </div>
  ),
  th: ({
    className,
    node: _node,
    style,
    ...props
  }: MarkdownElementProps<"th">) => (
    <th
      className={cn(
        "bg-muted/80 border-border border-l text-left align-top font-semibold whitespace-normal break-words first:border-l-0 first:rounded-tl-xl last:rounded-tr-xl [&[align=center]]:text-center [&[align=right]]:text-right",
        className,
      )}
      style={{
        minWidth: markdownTableMinWidth,
        paddingInline: markdownTableCellPaddingInline,
        paddingBlock: markdownTableCellPaddingBlock,
        ...style,
      }}
      {...props}
    />
  ),
  td: ({
    className,
    node: _node,
    style,
    ...props
  }: MarkdownElementProps<"td">) => (
    <td
      className={cn(
        "border-border border-t border-l text-left align-top whitespace-normal break-words first:border-l-0 [&[align=center]]:text-center [&[align=right]]:text-right [&_code]:break-words [&_code]:whitespace-pre-wrap [&_code]:[overflow-wrap:anywhere]",
        className,
      )}
      style={{
        minWidth: markdownTableMinWidth,
        paddingInline: markdownTableCellPaddingInline,
        paddingBlock: markdownTableCellPaddingBlock,
        ...style,
      }}
      {...props}
    />
  ),
  tr: ({ className, node: _node, ...props }: MarkdownElementProps<"tr">) => (
    <tr
      className={cn(
        "m-0 p-0 even:bg-muted/30 [&:last-child>td:first-child]:rounded-bl-xl [&:last-child>td:last-child]:rounded-br-xl",
        className,
      )}
      {...props}
    />
  ),
  sup: ({ className, node: _node, ...props }: MarkdownElementProps<"sup">) => (
    <sup
      className={cn("[&>a]:text-xs [&>a]:no-underline", className)}
      {...props}
    />
  ),
  pre: ({ className, children, node: _node }: MarkdownElementProps<"pre">) => (
    Children.toArray(children).length === 1 &&
    (isMermaidBlockChild(Children.toArray(children)[0]) ||
      isMermaidCodeElement(Children.toArray(children)[0])) ? (
      <>{children}</>
    ) : (
      <div
        className={cn(
          "max-w-4xl overflow-x-auto rounded-lg text-sm bg-black text-white dark:bg-zinc-800",
          className,
        )}
      >
        {children}
      </div>
    )
  ),
  code: ({
    className,
    children,
    node: _node,
    style,
    ...props
  }: MarkdownElementProps<"code">) => {
    const match = /language-([\w-]+)/.exec(className || "");
    const code = getTextContent(children);
    const isBlockCode = code.includes("\n");

    if (match) {
      const language = match[1];
      const normalizedCode = code.replace(/\n$/, "");

      if (language === "mermaid") {
        return <MermaidBlock code={normalizedCode} />;
      }

      return (
        <>
          <CodeHeader
            language={language}
            code={normalizedCode}
          />
          <SyntaxHighlighter
            language={language}
            className={className}
          >
            {normalizedCode}
          </SyntaxHighlighter>
        </>
      );
    }

    if (isBlockCode) {
      return (
        <code
          className={cn(
            "block min-w-full whitespace-pre px-4 py-4 font-mono text-inherit",
            className,
          )}
          {...props}
        >
          {code.replace(/\n$/, "")}
        </code>
      );
    }

    return (
      <code
        className={cn(
          "bg-muted rounded font-mono text-[0.9em] font-semibold whitespace-pre-wrap [overflow-wrap:anywhere]",
          className,
        )}
        style={{
          paddingInline: markdownInlineCodePaddingInline,
          paddingBlock: markdownInlineCodePaddingBlock,
          ...style,
        }}
        {...props}
      >
        {children}
      </code>
    );
  },
};

const MarkdownTextImpl: FC<{ children: string }> = ({ children }) => {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={defaultComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
