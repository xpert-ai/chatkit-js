import * as React from 'react';

// Menu items focus themselves on pointer movement. Own both hover and focus
// timers so those two events cannot leave an orphaned delayed open behind.
function useInfoController() {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const active = React.useRef<string | null>(null);
  const pending = React.useRef<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = React.useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }, []);
  const close = React.useCallback(
    (id?: string) => {
      if (!id || pending.current === id) cancel();
      if (!id || active.current === id) {
        active.current = null;
        setActiveId(null);
      }
    },
    [cancel],
  );
  const show = React.useCallback(
    (id: string, immediate: boolean) => {
      cancel();
      if (active.current === id) return;
      active.current = null;
      setActiveId(null);
      if (immediate) {
        active.current = id;
        setActiveId(id);
      } else {
        pending.current = id;
        timer.current = setTimeout(() => {
          pending.current = null;
          timer.current = null;
          active.current = id;
          setActiveId(id);
        }, 180);
      }
    },
    [cancel],
  );
  const leave = React.useCallback(
    (id: string) => {
      if (pending.current === id) cancel();
      if (active.current !== id) return;
      cancel();
      pending.current = id;
      timer.current = setTimeout(() => close(id), 120);
    },
    [cancel, close],
  );
  const retain = React.useCallback(
    (id: string) => {
      if (active.current === id) cancel();
    },
    [cancel],
  );
  React.useEffect(() => cancel, [cancel]);
  return React.useMemo(
    () => ({ activeId, show, leave, retain, close }),
    [activeId, show, leave, retain, close],
  );
}

const InfoContext = React.createContext<ReturnType<
  typeof useInfoController
> | null>(null);

export function ResourceInfoProvider({
  scope,
  children,
}: {
  scope: string;
  children: React.ReactNode;
}) {
  const controller = useInfoController();
  React.useEffect(() => {
    controller.close();
  }, [scope, controller.close]);
  return (
    <InfoContext.Provider value={controller}>{children}</InfoContext.Provider>
  );
}

export function useResourceInfo() {
  const shared = React.useContext(InfoContext);
  const local = useInfoController();
  const controller = shared ?? local;
  const id = React.useId();
  React.useEffect(() => () => controller.close(id), [controller.close, id]);
  return { id, ...controller };
}
