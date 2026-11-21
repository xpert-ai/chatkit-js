import * as React from 'react';
import { createPortal } from 'react-dom';
import { getSurfaceThemeStyle, type SurfaceTheme } from './theme-tokens';

type SurfaceStyle = React.CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};
export interface PrimitiveLabels {
  close: string;
  dialog: string;
}
interface PrimitiveThemeContext {
  style: SurfaceStyle;
  isDarkMode: boolean;
  portalContainer?: HTMLElement;
  labels: PrimitiveLabels;
}
const defaultLabels: PrimitiveLabels = { close: 'Close', dialog: 'Details' };
const emptyTheme: SurfaceTheme = {};
const Context = React.createContext<PrimitiveThemeContext | undefined>(
  undefined,
);

const inheritedTokens = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'input-background',
  'ring',
  'radius',
  'font-sans',
  'font-mono',
  'default-font-family',
  'default-mono-font-family',
];

/** Controls and their portals share the resolved theme of their owning surface. */
export function PrimitiveThemeProvider({
  children,
  theme = emptyTheme,
  rootRef,
  revision = 0,
  labels,
}: {
  children: React.ReactNode;
  theme?: SurfaceTheme & { colorScheme?: string };
  rootRef?: React.RefObject<HTMLElement | null>;
  revision?: number;
  labels?: Partial<PrimitiveLabels>;
}) {
  const [resolved, setResolved] = React.useState<SurfaceStyle>({});
  const [portalContainer, setPortalContainer] =
    React.useState<HTMLDivElement | null>(null);
  const [portalParent, setPortalParent] = React.useState<HTMLElement | null>(
    null,
  );
  React.useEffect(() => {
    const root = rootRef?.current;
    const document = root?.ownerDocument ?? globalThis.document;
    if (!document) return;
    setPortalParent(document.body);
    if (!root) {
      setResolved({});
      return;
    }
    const computed = document.defaultView?.getComputedStyle(root);
    if (!computed) return;
    const next: SurfaceStyle = {
      fontFamily: computed.fontFamily,
      color: computed.color,
    };
    for (const token of inheritedTokens) {
      const value = computed.getPropertyValue(`--${token}`).trim();
      if (value) next[`--${token}`] = value;
    }
    setResolved(next);
  }, [rootRef, revision, theme]);
  const style: SurfaceStyle = { ...resolved, ...getSurfaceThemeStyle(theme) };
  const isDarkMode = theme.colorScheme === 'dark';
  const value: PrimitiveThemeContext = {
    style,
    isDarkMode,
    portalContainer: portalContainer ?? undefined,
    labels: { ...defaultLabels, ...labels },
  };
  return (
    <Context.Provider value={value}>
      {children}
      {portalParent &&
        createPortal(
          <div
            ref={setPortalContainer}
            data-chatkit-portal-root=""
            className={isDarkMode ? 'dark' : undefined}
            style={style}
          />,
          portalParent,
        )}
    </Context.Provider>
  );
}

export function useTheme(_options?: { optional: true }) {
  return React.useContext(Context);
}
export function usePrimitiveLabels() {
  return React.useContext(Context)?.labels ?? defaultLabels;
}
