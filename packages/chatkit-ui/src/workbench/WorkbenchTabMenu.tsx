import * as React from 'react';
import { ContextMenu } from 'radix-ui';
import { useTheme as usePrimitiveTheme } from '@xpert-ai/chatkit-primitives';
import { MoreHorizontal, X } from 'lucide-react';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { useTheme } from '../providers/Theme';
import { getSurfaceThemeStyle } from '../lib/theme-surfaces';
import { cn } from '../lib/utils';
import { ToolbarButton } from '../components/ui/toolbar-button';
import {
  menuItemHighlightClassName,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

export type TabMenuAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
  run: () => void;
};
export type WorkbenchMenuTab = {
  key: string;
  close?: () => void | boolean | Promise<void | boolean>;
  actions?: TabMenuAction[];
};
type MenuGroup = TabMenuAction[];
const MenuContext = React.createContext<((key: string) => MenuGroup[]) | null>(
  null,
);
export const WorkbenchTabKeyContext = React.createContext<string | null>(null);

/** Batch close uses each tab's normal guard and stops at a save/discard veto. */
export function WorkbenchTabMenuProvider({
  tabs,
  order,
  children,
  onError,
  scope,
}: {
  tabs: WorkbenchMenuTab[];
  scope?: string;
  order?: string[];
  children: React.ReactNode;
  onError: (message: string) => void;
}) {
  const { t } = useChatkitTranslation();
  const current = React.useRef(tabs);
  current.current = tabs;
  const currentScope = React.useRef(scope);
  currentScope.current = scope;
  const [closing, setClosing] = React.useState(false);
  const closingRef = React.useRef(false);
  const alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const ordered = [...tabs].sort((a, b) => {
    const rank = (key: string) => {
      const index = order?.indexOf(key) ?? -1;
      return index < 0 ? (order?.length ?? 0) : index;
    };
    return rank(a.key) - rank(b.key);
  });
  const close = async (keys: string[]) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    try {
      // Closing right to left keeps adjacent-tab selection on surviving tabs.
      for (const key of [...keys].reverse()) {
        if (!alive.current || currentScope.current !== scope) break;
        const action = current.current.find((tab) => tab.key === key)?.close;
        if (action && (await action()) === false) break;
        // Read the next guard/selection callback after React commits the previous close.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
    } catch (error) {
      onError(
        error instanceof Error ? error.message : t('workbench.loadFailed'),
      );
    } finally {
      closingRef.current = false;
      if (alive.current) setClosing(false);
    }
  };
  const groups = (key: string): MenuGroup[] => {
    const tab = tabs.find((item) => item.key === key);
    if (!tab) return [];
    const index = ordered.findIndex((item) => item.key === key);
    const action = (id: string, targets: WorkbenchMenuTab[]): TabMenuAction => {
      const keys = targets.filter((item) => item.close).map((item) => item.key);
      return {
        id,
        label: t(`workbench.tabMenu.${id}`),
        icon: <X size={16} />,
        disabled: closing || keys.length === 0,
        run: () => {
          void close(keys);
        },
      };
    };
    return [
      tab.actions ?? [],
      [
        action('close', [tab]),
        action(
          'closeOthers',
          ordered.filter((item) => item.key !== key),
        ),
        action('closeRight', ordered.slice(index + 1)),
        action('closeAll', ordered),
      ],
    ].filter((group) => group.length);
  };
  return <MenuContext.Provider value={groups}>{children}</MenuContext.Provider>;
}

const menuClass =
  'z-50 min-w-56 max-w-[calc(100vw-2rem)] rounded-chat-panel border border-border/70 bg-popover p-[calc(0.25rem*var(--chat-density-scale,1))] text-popover-foreground shadow-lg';
const itemClass = cn(
  'flex cursor-default items-center gap-[calc(0.5rem*var(--chat-density-scale,1))] rounded-chat-item px-[calc(0.75rem*var(--chat-density-scale,1))] py-[calc(0.5rem*var(--chat-density-scale,1))] text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:text-destructive',
  menuItemHighlightClassName,
);

export function WorkbenchTabContextMenu({
  children,
  focusRef,
}: {
  children: React.ReactElement;
  focusRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const key = React.useContext(WorkbenchTabKeyContext);
  const getGroups = React.useContext(MenuContext);
  const groups = key ? getGroups?.(key) : undefined;
  const theme = useTheme({ optional: true })?.theme;
  const primitiveTheme = usePrimitiveTheme();
  const pending = React.useRef<(() => void) | null>(null);
  if (!groups?.length) return children;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        asChild
        onKeyDown={(event) => {
          if (
            event.key !== 'ContextMenu' &&
            !(event.shiftKey && event.key === 'F10')
          )
            return;
          event.preventDefault();
          const rect = (
            focusRef.current ?? event.currentTarget
          ).getBoundingClientRect();
          // Radix positions context menus from the contextmenu event; keyboard activation
          // anchors that same path to the focused tab instead of the pointer location.
          event.currentTarget.dispatchEvent(
            new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX: rect.left,
              clientY: rect.bottom,
            }),
          );
        }}
      >
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal container={primitiveTheme?.portalContainer}>
        <ContextMenu.Content
          style={getSurfaceThemeStyle(theme ?? {})}
          className={menuClass}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusRef.current?.focus();
            const run = pending.current;
            pending.current = null;
            run?.();
          }}
        >
          {groups.map((group, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <ContextMenu.Separator className="my-1 h-px bg-border" />
              )}
              {group.map((item) => (
                <ContextMenu.Item
                  key={item.id}
                  className={itemClass}
                  data-variant={item.variant}
                  disabled={item.disabled}
                  onSelect={() => {
                    pending.current = item.run;
                  }}
                >
                  {item.icon}
                  {item.label}
                </ContextMenu.Item>
              ))}
            </React.Fragment>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export function WorkbenchTabDropdown({ tabKey }: { tabKey: string }) {
  const getGroups = React.useContext(MenuContext);
  const groups = getGroups?.(tabKey);
  const { t } = useChatkitTranslation();
  const pending = React.useRef<(() => void) | null>(null);
  if (!groups?.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarButton aria-label={t('chat.moreActions')}>
          <MoreHorizontal />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-56"
        onCloseAutoFocus={() => {
          const run = pending.current;
          pending.current = null;
          if (run) queueMicrotask(run);
        }}
      >
        {groups.map((group, index) => (
          <React.Fragment key={index}>
            {index > 0 && <DropdownMenuSeparator />}
            {group.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className={itemClass}
                variant={item.variant}
                disabled={item.disabled}
                onSelect={() => {
                  pending.current = item.run;
                }}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
