import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react';
import { createSendTransition } from './send-transition';
import { cn } from '../../../lib/utils';

const Context = createContext<
  | (ReturnType<typeof createSendTransition> & {
      composerRef: RefObject<HTMLFormElement | null>;
    })
  | null
>(null);

export const useSendTransition = () => useContext(Context);

export function SendTransitionContent({
  human,
  children,
}: {
  human: boolean;
  children: ReactNode;
}) {
  return human ? <div data-human-bubble-content="">{children}</div> : children;
}

export function SendTransitionProvider({ children }: { children: ReactNode }) {
  const composerRef = useRef<HTMLFormElement>(null);
  const transition = useMemo(
    () => createSendTransition(() => composerRef.current),
    [],
  );
  useEffect(() => () => transition.clear(), [transition]);
  const value = useMemo(() => ({ ...transition, composerRef }), [transition]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function SendTransitionMessage({
  transitionId,
  ref,
  className,
  ...props
}: ComponentProps<'div'> & { transitionId?: string }) {
  const element = useRef<HTMLDivElement>(null);
  const transition = useSendTransition();
  useLayoutEffect(() => {
    const node = element.current;
    if (!transitionId || !node) return;
    const stop = transition?.enter(transitionId, node);
    // StrictMode replays effects without removing the message. Keep that one
    // entrance alive, but cancel promptly when the actual row is removed.
    return () => {
      queueMicrotask(() => {
        if (!node.isConnected) stop?.();
      });
    };
  }, [transition, transitionId]);
  return (
    <div
      {...props}
      className={cn('relative', className)}
      ref={(node) => {
        element.current = node;
        if (typeof ref === 'function') return ref(node);
        if (ref) ref.current = node;
      }}
    />
  );
}
