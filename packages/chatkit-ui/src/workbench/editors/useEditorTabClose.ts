import * as React from 'react';
import type { EditorLifecycle } from './editor-lifecycle';

export function useEditorTabClose({
  editors,
  closeView,
  forget,
  adjacent,
  activeKey,
  select,
  closeWorkbench,
  onError,
}: {
  editors: EditorLifecycle;
  closeView: (key: string) => void;
  forget: (key: string) => void;
  adjacent: (key: string) => string | null;
  activeKey: string | null;
  select: (key: string | null) => void;
  closeWorkbench: () => void;
  onError: () => void;
}) {
  const current = React.useRef({
    closeView,
    forget,
    adjacent,
    activeKey,
    select,
    closeWorkbench,
  });
  current.current = {
    closeView,
    forget,
    adjacent,
    activeKey,
    select,
    closeWorkbench,
  };
  return React.useCallback(
    async (key: string) => {
      const finish = () => {
        const {
          closeView,
          forget,
          adjacent,
          activeKey,
          select,
          closeWorkbench,
        } = current.current;
        forget(key);
        closeView(key);
        if (activeKey === key) {
          const next = adjacent(key);
          select(next);
          if (!next) closeWorkbench();
        }
      };
      if (!editors.isDirty(key)) {
        finish();
        return true;
      }
      const ready = await editors.prepare(key);
      if (ready) finish();
      else onError();
      return ready;
    },
    [
      editors,
      closeView,
      forget,
      adjacent,
      activeKey,
      select,
      closeWorkbench,
      onError,
    ],
  );
}
