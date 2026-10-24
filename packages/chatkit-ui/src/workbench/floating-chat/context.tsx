import * as React from 'react';

export type FloatingChatMode = 'minimized' | 'compact' | 'expanded';
export type WorkbenchChatMetadata = {
  title?: string;
  running: boolean;
  error?: boolean;
  attentionKey?: string;
};

type ChatPresentation = {
  scope: string;
  floating: boolean;
  mode: FloatingChatMode;
  setMode: (mode: FloatingChatMode) => void;
  metadata: WorkbenchChatMetadata | null;
  publish: (scope: string, metadata: WorkbenchChatMetadata) => void;
  /** Compact coordinates are measured from the left and bottom edges. */
  position: React.RefObject<{ x: number; y: number } | null>;
  expandedPosition: React.RefObject<{ x: number; y: number } | null>;
  compactWidth: React.RefObject<number | null>;
  expandedWidth: React.RefObject<number | null>;
  launcherPosition: React.RefObject<{ x: number; y: number } | null>;
};

const Context = React.createContext<ChatPresentation | null>(null);
export const useWorkbenchChat = () => React.useContext(Context);

/** Presentation belongs to the shell; conversation state stays in the original Chat. */
export function WorkbenchChatProvider({
  scope,
  floating,
  children,
}: {
  scope: string;
  floating: boolean;
  children: React.ReactNode;
}) {
  const [mode, setMode] = React.useState<FloatingChatMode>('compact');
  const position = React.useRef<{ x: number; y: number } | null>(null);
  const expandedPosition = React.useRef<{ x: number; y: number } | null>(null);
  const compactWidth = React.useRef<number | null>(null);
  const expandedWidth = React.useRef<number | null>(null);
  const launcherPosition = React.useRef<{ x: number; y: number } | null>(null);
  const [published, setPublished] = React.useState<{
    scope: string;
    metadata: WorkbenchChatMetadata;
  } | null>(null);
  const metadata = published?.scope === scope ? published.metadata : null;
  const publish = React.useCallback(
    (scope: string, metadata: WorkbenchChatMetadata) => {
      setPublished((previous) =>
        previous?.scope === scope &&
        previous.metadata.title === metadata.title &&
        previous.metadata.running === metadata.running &&
        previous.metadata.error === metadata.error &&
        previous.metadata.attentionKey === metadata.attentionKey
          ? previous
          : { scope, metadata },
      );
    },
    [],
  );
  const seen = React.useRef<{ scope: string; requests: Set<string> }>({
    scope,
    requests: new Set(),
  });
  React.useLayoutEffect(() => {
    if (seen.current.scope !== scope)
      seen.current = { scope, requests: new Set() };
    const key = metadata?.attentionKey;
    if (key && !seen.current.requests.has(key)) {
      seen.current.requests.add(key);
      setMode('expanded');
    }
  }, [scope, floating, metadata?.attentionKey]);
  const value = React.useMemo(
    () => ({
      scope,
      floating,
      mode,
      setMode,
      metadata,
      publish,
      position,
      expandedPosition,
      compactWidth,
      expandedWidth,
      launcherPosition,
    }),
    [scope, floating, mode, metadata, publish],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePublishWorkbenchChat(metadata?: WorkbenchChatMetadata) {
  const context = useWorkbenchChat();
  const publish = context?.publish;
  const scope = context?.scope;
  const { title, running, error, attentionKey } = metadata ?? {};
  React.useLayoutEffect(() => {
    if (scope !== undefined && running !== undefined)
      publish?.(scope, { title, running, error, attentionKey });
  }, [scope, publish, title, running, error, attentionKey]);
}

/** Hidden transcripts must not update scroll-follow/read state while output continues. */
export function isTranscriptHidden(viewport: HTMLElement) {
  const presentation = viewport.closest('[data-chat-presentation]');
  return (
    !!presentation &&
    presentation.getAttribute('data-chat-presentation') !== 'expanded'
  );
}
