import * as React from 'react';
import { UploadCloud } from 'lucide-react';

import { cn } from '../../lib/utils';

type UploadDroppedFilesProps = React.HTMLAttributes<HTMLDivElement> & {
  enabled: boolean;
  dropTitle: string;
  dropHint: string;
  activeClassName?: string;
  onFiles: (files: File[]) => void | boolean;
};

type DropOverlayRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius?: string;
};

function hasDataTransferFiles(dataTransfer?: DataTransfer | null) {
  if (!dataTransfer) {
    return false;
  }
  if (Array.from(dataTransfer.types ?? []).includes('Files')) {
    return true;
  }
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    return Array.from(dataTransfer.items).some((item) => item.kind === 'file');
  }
  return (dataTransfer.files?.length ?? 0) > 0;
}

function getDataTransferFiles(dataTransfer: DataTransfer): File[] {
  const files = Array.from(dataTransfer.files ?? []).filter(Boolean);
  if (files.length > 0) {
    return files;
  }

  return Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

function assignForwardedRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) {
    ref.current = value;
  }
}

function readOverlayRect(element: HTMLElement | null): DropOverlayRect | null {
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const style = window.getComputedStyle(element);
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    borderRadius: style.borderRadius || undefined,
  };
}

export const UploadDroppedFiles = React.forwardRef<
  HTMLDivElement,
  UploadDroppedFilesProps
>(function UploadDroppedFiles(
  {
    enabled,
    dropTitle,
    dropHint,
    activeClassName,
    className,
    children,
    onFiles,
    ...props
  },
  ref,
) {
  const [isActive, setIsActive] = React.useState(false);
  const [overlayRect, setOverlayRect] = React.useState<DropOverlayRect | null>(
    null,
  );
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const dragDepthRef = React.useRef(0);

  const setRootRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      assignForwardedRef(ref, node);
    },
    [ref],
  );

  const handleDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!hasDataTransferFiles(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!enabled) {
        event.dataTransfer.dropEffect = 'none';
        return;
      }

      dragDepthRef.current += 1;
      event.dataTransfer.dropEffect = 'copy';
      setOverlayRect(readOverlayRect(event.currentTarget));
      setIsActive(true);
    },
    [enabled],
  );

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!hasDataTransferFiles(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = enabled ? 'copy' : 'none';
    },
    [enabled],
  );

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!hasDataTransferFiles(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = Math.max(dragDepthRef.current - 1, 0);
      if (dragDepthRef.current === 0) {
        setIsActive(false);
        setOverlayRect(null);
      }
    },
    [],
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!hasDataTransferFiles(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = 0;
      setIsActive(false);
      setOverlayRect(null);

      const files = getDataTransferFiles(event.dataTransfer);
      if (enabled && files.length > 0) {
        onFiles(files);
      }
    },
    [enabled, onFiles],
  );

  React.useEffect(() => {
    if (!isActive) {
      return;
    }

    const updateOverlayRect = () => {
      setOverlayRect(readOverlayRect(rootRef.current));
    };

    updateOverlayRect();
    window.addEventListener('resize', updateOverlayRect);
    window.addEventListener('scroll', updateOverlayRect, true);
    return () => {
      window.removeEventListener('resize', updateOverlayRect);
      window.removeEventListener('scroll', updateOverlayRect, true);
    };
  }, [isActive]);

  const overlayStyle: React.CSSProperties | undefined = overlayRect
    ? {
        top: overlayRect.top,
        left: overlayRect.left,
        width: overlayRect.width,
        height: overlayRect.height,
        borderRadius: overlayRect.borderRadius,
      }
    : undefined;

  return (
    <div
      {...props}
      ref={setRootRef}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(className, isActive && activeClassName)}
    >
      {isActive && (
        <div
          aria-hidden="true"
          data-chatkit-drop-overlay=""
          style={overlayStyle}
          className={cn(
            'pointer-events-none fixed z-50 flex items-center justify-center overflow-hidden bg-background/75 p-6 backdrop-blur-[2px]',
            !overlayRect && 'inset-0',
          )}
        >
          <div className="flex max-w-sm items-center gap-3 rounded-lg border border-primary/40 bg-background/95 px-4 py-3 shadow-lg">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UploadCloud size={20} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {dropTitle}
              </div>
              <div className="text-xs text-muted-foreground">{dropHint}</div>
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
});
