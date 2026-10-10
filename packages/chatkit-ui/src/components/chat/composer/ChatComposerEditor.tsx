import {
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from '../../../lib/utils';

type Props = Omit<ComponentProps<'div'>, 'children'> & {
  inputRef: Ref<HTMLDivElement>;
  version?: number;
  disabled?: boolean;
  placeholder: string;
  inline?: ReactNode;
  hasInline?: boolean;
  value?: string;
  focus: () => void;
  children?: ReactNode;
};

export function ChatComposerEditor({
  inputRef,
  version,
  disabled,
  placeholder,
  inline,
  hasInline,
  value,
  focus,
  children,
  ...events
}: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const input = bodyRef.current?.querySelector('[role="textbox"]');
    if (!input) return;
    const placeholder = input.querySelector('[data-composer-trailing-break]');
    // Browsers may consume this empty-line placeholder during editing, so it
    // must stay outside React's child reconciliation and submitted message text.
    if (value?.endsWith('\n')) {
      if (!placeholder) {
        const br = document.createElement('br');
        br.setAttribute('data-composer-trailing-break', '');
        input.append(br);
      }
    } else {
      placeholder?.remove();
    }
  }, [value, version]);
  return (
    <div
      ref={bodyRef}
      data-slot="composer-body"
      className="min-h-10 max-h-32 w-full cursor-text overflow-y-auto break-words px-2 py-2 text-base leading-6 text-foreground"
      onClick={(event) => {
        if (
          !disabled &&
          event.target instanceof Element &&
          !event.target.closest('button, a, input, [contenteditable]')
        ) {
          focus();
        }
      }}
    >
      {inline}
      <div
        {...events}
        key={version}
        ref={inputRef}
        role="textbox"
        aria-multiline="true"
        aria-disabled={disabled}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className={cn(
          'whitespace-pre-wrap break-words bg-transparent outline-none',
          hasInline ? 'inline' : 'block min-h-10',
          'empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {children}
      </div>
    </div>
  );
}
