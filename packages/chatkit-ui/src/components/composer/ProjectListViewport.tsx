import * as React from 'react';

/** Hold the first loaded height until the popover closes so filters and view changes cannot collapse it. */
export function ProjectListViewport({
  ready,
  busy,
  children,
  footer,
}: {
  ready: boolean;
  busy: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number>();
  React.useLayoutEffect(() => {
    if (ready && height === undefined && ref.current) {
      const measured = ref.current.getBoundingClientRect().height;
      if (measured > 0) setHeight(measured);
    }
  }, [ready, height]);

  return (
    <div
      ref={ref}
      data-slot="composer-project-list-viewport"
      aria-busy={busy}
      style={height === undefined ? undefined : { height, flexBasis: height }}
      className="flex min-h-0 flex-1 max-h-75 flex-col overflow-hidden"
    >
      <div
        data-slot="composer-project-scroll-region"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
      {footer}
    </div>
  );
}
