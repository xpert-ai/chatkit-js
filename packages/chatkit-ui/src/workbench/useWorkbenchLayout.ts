import * as React from 'react';
import { clampPanelWidth } from './split-resize';
import {
  readWorkbenchLayout,
  writeWorkbenchLayout,
  type WorkbenchLayout,
} from './layout-storage';

interface LayoutState {
  key: string | null;
  narrow: boolean;
  saved: WorkbenchLayout;
  visible: WorkbenchLayout;
  restoring: boolean;
}

export function useWorkbenchLayout(
  key: string | null,
  containerWidth: number,
  narrow: boolean,
) {
  const initial = React.useMemo(() => readWorkbenchLayout(key), [key]);
  const [state, setState] = React.useState<LayoutState | null>(null);
  const saved = state?.key === key ? state.saved : initial;
  const current: LayoutState =
    state?.key === key && state.narrow === narrow
      ? state
      : {
          key,
          narrow,
          saved,
          visible: narrow ? { ...saved, open: false, expanded: false } : saved,
          restoring: !narrow,
        };
  const latest = React.useRef(current);
  latest.current = current;
  const update = React.useCallback(
    (change: (layout: WorkbenchLayout) => WorkbenchLayout, persist = true) => {
      const previous = latest.current;
      if (previous.key !== key || previous.narrow !== narrow) return;
      const visible = change(previous.visible);
      const saved = persist && !narrow ? visible : previous.saved;
      const next = {
        ...previous,
        saved,
        visible,
        restoring: persist ? false : previous.restoring,
      };
      latest.current = next;
      setState(next);
      if (persist && !narrow) writeWorkbenchLayout(key, saved);
    },
    [key, narrow],
  );
  const setOpen = React.useCallback<
    React.Dispatch<React.SetStateAction<boolean>>
  >(
    (value) => {
      update((layout) => ({
        ...layout,
        open: typeof value === 'function' ? value(layout.open) : value,
      }));
    },
    [update],
  );
  const setExpanded = React.useCallback<
    React.Dispatch<React.SetStateAction<boolean>>
  >(
    (value) => {
      update((layout) => ({
        ...layout,
        expanded: typeof value === 'function' ? value(layout.expanded) : value,
      }));
    },
    [update],
  );
  const setPanelWidth = React.useCallback<
    React.Dispatch<React.SetStateAction<number | null>>
  >(
    (value) => {
      if (containerWidth <= 0 || narrow) return;
      update((layout) => {
        const previous =
          layout.chatWidth === null ? null : containerWidth - layout.chatWidth;
        const next = typeof value === 'function' ? value(previous) : value;
        return {
          ...layout,
          chatWidth:
            next === null
              ? null
              : containerWidth - clampPanelWidth(next, containerWidth),
        };
      });
    },
    [containerWidth, narrow, update],
  );
  const dismiss = React.useCallback(() => {
    update((layout) => ({ ...layout, open: false, expanded: false }), false);
  }, [update]);
  const resolvedPanelWidth = clampPanelWidth(
    current.visible.chatWidth === null
      ? containerWidth * 0.55
      : containerWidth - current.visible.chatWidth,
    containerWidth,
  );
  return {
    requestedOpen: current.visible.open,
    expanded: current.visible.expanded,
    restoring: current.restoring,
    resolvedPanelWidth,
    setOpen,
    setExpanded,
    setPanelWidth,
    dismiss,
  };
}
