import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type ComponentProps,
  type Ref,
} from 'react';
import { cn } from '../../../lib/utils';

export function ComposerSurface({
  children,
  actions,
  footer,
  style,
  onFocusEditor,
  paddedBottom = !footer,
  compact: compactRequested = false,
  overlay,
}: {
  children: ReactNode;
  actions: ReactNode;
  footer?: ReactNode;
  paddedBottom?: boolean;
  style?: CSSProperties;
  onFocusEditor?: () => void;
  compact?: boolean;
  overlay?: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expandedHeight, setExpandedHeight] = useState<number | null>(null);
  // Measure the expanded geometry before the first paint even when mounted
  // while already reading history (for example after a development hot reload).
  const compact = compactRequested && expandedHeight !== null;
  const [isRestoring, setIsRestoring] = useState(false);
  const wasCompact = useRef(false);
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const restoring = wasCompact.current;
    wasCompact.current = compact;
    setIsRestoring(!compact && restoring);
    if (compact) return;
    let settling = restoring;
    const measure = () => {
      if (settling) return;
      const shell = content.parentElement;
      const shellStyle = shell ? getComputedStyle(shell) : null;
      const padding =
        (parseFloat(shellStyle?.paddingTop ?? '') || 0) +
        (parseFloat(shellStyle?.paddingBottom ?? '') || 0);
      setExpandedHeight(content.getBoundingClientRect().height + padding);
    };
    // Keep the expanded footprint during the fade so changing composer height
    // cannot move the viewport across its bottom threshold and toggle it again.
    const timer = restoring
      ? setTimeout(() => {
          settling = false;
          measure();
          setIsRestoring(false);
        }, 240)
      : undefined;
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(content);
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [compact, paddedBottom]);
  return (
    <div
      data-slot="composer-input-shell"
      data-layout={compact ? 'compact' : 'stacked'}
      style={{ ...style, minHeight: expandedHeight || undefined }}
      className={cn(
        'pointer-events-none relative isolate flex min-w-0 flex-1 flex-col justify-end overflow-visible',
        paddedBottom && 'pb-composer-inset',
      )}
    >
      <div
        ref={contentRef}
        className="pointer-events-auto relative"
        data-slot="composer-content"
      >
        {overlay}
        <div
          data-slot="composer-editor-surface"
          className="relative z-10 flex min-w-0 flex-col bg-input-background shadow-composer-shell"
          onClick={(event) => {
            if (event.target === event.currentTarget) onFocusEditor?.();
          }}
        >
          {children}
          {actions}
        </div>
        {footer && (
          <div
            data-slot="composer-context-collapse"
            data-restoring={isRestoring || undefined}
            inert={compact}
            aria-hidden={compact || undefined}
          >
            <div className="min-h-0">
              <div data-slot="composer-context-surface">{footer}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatComposerFormFrame({
  onSubmit,
  formRef,
  children,
  ...surface
}: ComponentProps<typeof ComposerSurface> & {
  onSubmit: ComponentProps<'form'>['onSubmit'];
  formRef?: Ref<HTMLFormElement>;
}) {
  return (
    <form
      ref={formRef}
      className="pointer-events-none flex items-end"
      onSubmit={onSubmit}
    >
      <ComposerSurface {...surface}>{children}</ComposerSurface>
    </form>
  );
}
