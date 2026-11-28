import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../ui/button';

const PREVIEW_LINES = 12;

/** Measure the full text so wrapping and font changes can reveal the toggle. */
export function HumanMessageText({ children }: { children: ReactNode }) {
  const { t } = useChatkitTranslation();
  const id = useId();
  const content = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => {
      const lineHeight = Number.parseFloat(
        getComputedStyle(element).lineHeight,
      );
      setOverflows(element.scrollHeight > lineHeight * PREVIEW_LINES + 1);
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [children]);

  return (
    <div className="min-w-0 text-sm leading-relaxed">
      <div
        id={id}
        data-human-text-preview=""
        className="overflow-hidden"
        style={{ maxHeight: expanded ? undefined : `${PREVIEW_LINES}lh` }}
      >
        <div ref={content} className="flow-root">
          {children}
        </div>
      </div>
      {overflows && (
        <Button
          type="button"
          variant="link"
          aria-expanded={expanded}
          aria-controls={id}
          className="mt-[calc(0.25rem*var(--chat-density-scale,1))] px-0 text-inherit focus-visible:ring-current"
          onClick={() => setExpanded((value) => !value)}
        >
          {t(
            expanded
              ? 'message.humanText.showLess'
              : 'message.humanText.showMore',
          )}
        </Button>
      )}
    </div>
  );
}
