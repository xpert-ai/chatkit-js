import * as React from 'react';
import { AlertCircle, Loader2, MessageSquare } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import { useWorkbenchChat } from './context';
import { useFloatingChatPosition } from './useFloatingChatPosition';
import { useFloatingChatFocus } from './useFloatingChatFocus';
import { useFloatingChatResize } from './useFloatingChatResize';
import { FloatingChatHeader } from './FloatingChatHeader';

/** Lives inside the panel, including the narrow-screen Sheet's focus boundary. */
export function FloatingChat({
  host,
  active,
  onOpenChat,
  onNewSideChat,
}: {
  host: React.Ref<HTMLDivElement>;
  active: boolean;
  onOpenChat: () => void;
  onNewSideChat?: () => void;
}) {
  const chat = useWorkbenchChat();
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const mode = chat?.mode ?? 'compact';
  const minimized = mode === 'minimized';
  const position = useFloatingChatPosition(
    active && !minimized,
    mode === 'expanded' ? chat?.expandedPosition : chat?.position,
    'center',
    undefined,
    mode === 'expanded' ? 'top' : 'bottom',
  );
  const resize = useFloatingChatResize(
    active && !minimized,
    position,
    mode === 'expanded' ? chat?.expandedWidth : chat?.compactWidth,
    mode === 'expanded' ? 800 : 640,
  );
  const focused = useFloatingChatFocus(
    position.surfaceRef,
    active && !minimized,
  );
  const [menuOpen, setMenuOpen] = React.useState(false);
  const headerVisible =
    mode === 'expanded' ||
    focused ||
    menuOpen ||
    position.dragging ||
    resize.resizing;
  const launcherPosition = useFloatingChatPosition<HTMLButtonElement>(
    active && minimized,
    chat?.launcherPosition,
    'right',
    position.boundsRef,
  );
  const buttonRef = launcherPosition.surfaceRef;
  const focusRequested = React.useRef(false);
  const previousMode = React.useRef(mode);
  React.useLayoutEffect(() => {
    const justMinimized = minimized && previousMode.current !== mode;
    previousMode.current = mode;
    if (!active || (!focusRequested.current && !justMinimized)) return;
    focusRequested.current = false;
    if (minimized) buttonRef.current?.focus();
    else
      position.surfaceRef.current
        ?.querySelector<HTMLElement>('[role="textbox"]')
        ?.focus();
  }, [active, minimized, mode, position.surfaceRef, buttonRef]);
  const changeMode = (next: typeof mode) => {
    focusRequested.current = true;
    chat?.setMode(next);
  };
  const setMode = chat?.setMode;
  React.useEffect(() => {
    const layer = position.boundsRef.current;
    if (!active || !layer) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      if (!minimized) {
        focusRequested.current = true;
        setMode?.(mode === 'expanded' ? 'compact' : 'minimized');
      }
    };
    // Chat is portaled here from the frame, so its React event ancestry does
    // not include this surface. Listen on the DOM; external menu portals keep
    // ownership of Escape, and the narrow Sheet handles it in capture first.
    layer.addEventListener('keydown', handleEscape);
    return () => layer.removeEventListener('keydown', handleEscape);
  }, [active, minimized, mode, setMode, position.boundsRef]);
  const metadata = chat?.metadata;
  const title = metadata?.title?.trim() || t('workbench.mainChat');
  const status = metadata?.attentionKey
    ? 'waiting'
    : metadata?.error
      ? 'failed'
      : metadata?.running
        ? 'running'
        : 'idle';
  const statusLabel = t(`workbench.floatingChat.${status}`);
  const StatusIcon =
    status === 'running'
      ? Loader2
      : status === 'waiting' || status === 'failed'
        ? AlertCircle
        : MessageSquare;
  return (
    <div
      ref={position.boundsRef}
      className="chatkit-floating-chat-layer"
      hidden={!active}
      style={getSurfaceThemeStyle(theme)}
      data-floating-chat-mode={mode}
    >
      {(position.dragging || launcherPosition.dragging || resize.resizing) && (
        <div
          className="absolute inset-0 pointer-events-auto"
          aria-hidden="true"
        />
      )}
      <button
        ref={buttonRef}
        {...launcherPosition.handleProps}
        type="button"
        hidden={!minimized}
        className="chatkit-floating-chat-launcher touch-none cursor-move rounded-chat-item border bg-background text-foreground shadow-lg"
        style={launcherPosition.style}
        aria-label={`${t('workbench.floatingChat.restore')}: ${title}`}
        title={`${title} · ${statusLabel}`}
        onClick={() => changeMode('compact')}
      >
        <StatusIcon
          className={
            status === 'running'
              ? 'animate-spin motion-reduce:animate-none'
              : undefined
          }
          aria-hidden="true"
        />
        <span className="sr-only" role="status">
          {statusLabel}
        </span>
      </button>
      <div
        ref={position.surfaceRef}
        hidden={minimized}
        role="region"
        aria-label={t('workbench.floatingChat.label')}
        className="chatkit-floating-chat-surface rounded-chat-panel border bg-background text-foreground shadow-xl"
        style={{ ...position.style, ...resize.style }}
      >
        <FloatingChatHeader
          title={title}
          visible={headerVisible}
          expanded={mode === 'expanded'}
          dragProps={position.handleProps}
          onToggle={() =>
            changeMode(mode === 'expanded' ? 'compact' : 'expanded')
          }
          onMinimize={() => changeMode('minimized')}
          onOpenChat={onOpenChat}
          onNewSideChat={onNewSideChat}
          onMenuOpenChange={setMenuOpen}
          onFocusInput={() =>
            position.surfaceRef.current
              ?.querySelector<HTMLElement>('[role="textbox"]')
              ?.focus()
          }
          status={
            status !== 'idle' ? (
              <span role="status" aria-label={statusLabel} title={statusLabel}>
                <StatusIcon
                  className={
                    status === 'running'
                      ? 'animate-spin motion-reduce:animate-none'
                      : undefined
                  }
                  aria-hidden="true"
                />
              </span>
            ) : null
          }
        />
        <div ref={active ? host : undefined} className="flex min-h-0 flex-1" />
        {(['left', 'right'] as const).map((edge) => (
          <div
            key={edge}
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label={t(
              `workbench.floatingChat.resize${edge === 'left' ? 'Left' : 'Right'}`,
            )}
            className="chatkit-floating-chat-resize"
            data-edge={edge}
            {...resize.handleProps(edge)}
          />
        ))}
      </div>
    </div>
  );
}
