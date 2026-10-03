import * as React from 'react';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { PanelsTopLeft } from 'lucide-react';
import { IconDefinitionRenderer } from '../components/ui/icon-definition';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { resolveManifestText } from './manifest-text';

export type WorkbenchViewMenuProps = {
  views: XpertExtensionViewManifest[];
  locale: string;
  onSelect: (key: string) => void;
  children: React.ReactElement;
};

export function WorkbenchViewMenu({
  views,
  locale,
  onSelect,
  children,
}: WorkbenchViewMenuProps) {
  const { t } = useChatkitTranslation();
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const keyboardOpen = React.useRef(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const firstViewRef = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useId();

  const cancelClose = () => clearTimeout(closeTimer.current);
  const close = () => {
    cancelClose();
    setOpen(false);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!contentRef.current?.contains(document.activeElement)) setOpen(false);
    }, 150);
  };
  React.useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <PopoverTrigger
        asChild
        ref={triggerRef}
        onPointerEnter={(event) => {
          if (event.pointerType === 'touch') return;
          cancelClose();
          keyboardOpen.current = false;
          setOpen(true);
        }}
        onPointerLeave={scheduleClose}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          cancelClose();
          keyboardOpen.current = true;
          setOpen(true);
          firstViewRef.current?.focus();
        }}
        // The child keeps its direct-click workbench action.
        onClick={(event) => event.preventDefault()}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        aria-labelledby={titleId}
        className="w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border-border/60 p-2 shadow-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (keyboardOpen.current) firstViewRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (keyboardOpen.current) triggerRef.current?.focus();
          keyboardOpen.current = false;
        }}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
        onFocusCapture={cancelClose}
        onBlurCapture={scheduleClose}
      >
        <div
          id={titleId}
          className="px-2.5 pb-2 pt-1 text-sm font-medium text-muted-foreground"
        >
          {t('workbench.views')}
        </div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto overscroll-contain">
          {views.map((view, index) => {
            const label = resolveManifestText(
              view.workbench?.menu?.label ?? view.title,
              view.key,
              locale,
            );
            return (
              <button
                key={view.key}
                ref={index === 0 ? firstViewRef : undefined}
                type="button"
                title={label}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => {
                  close();
                  onSelect(view.key);
                }}
              >
                <IconDefinitionRenderer
                  icon={view.workbench?.menu?.icon ?? view.icon}
                  size={18}
                  fallback={
                    <PanelsTopLeft
                      size={18}
                      className="shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  }
                />
                <span className="min-w-0 truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function WorkbenchViewsIcon({ count }: { count: number }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 17H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v1"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="7"
        y="7"
        width="14"
        height="14"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      {count > 0 && (
        <text
          x="14"
          y="14.5"
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={count > 99 ? 7 : count > 9 ? 8.5 : 11}
          fontWeight="500"
        >
          {count > 99 ? '99+' : count}
        </text>
      )}
    </svg>
  );
}
