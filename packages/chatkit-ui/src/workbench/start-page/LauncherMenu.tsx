import * as React from 'react';
import { z } from 'zod';
import {
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Pin,
  Settings2,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { useTheme } from '../../providers/Theme';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { LauncherAction } from './launcher-registry';
const pinsSchema = z.array(z.string()).max(50);

export function useLauncherPins(
  scope: string | undefined,
  actions: LauncherAction[],
) {
  const defaults = actions.slice(0, 4).map((action) => action.id);
  const key = scope ? `chatkit:launcher:v1:${scope}` : undefined;
  const [state, setState] = React.useState<{
    key?: string;
    pins: string[] | null;
  }>({ key, pins: null });
  React.useEffect(() => {
    const sync = () => {
      let pins: string[] | null = null;
      try {
        if (key)
          pins = [
            ...new Set(
              pinsSchema.parse(JSON.parse(localStorage.getItem(key) || 'null')),
            ),
          ];
      } catch {
        /* Use capability-derived defaults. */
      }
      setState({ key, pins });
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('chatkit:launcher-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('chatkit:launcher-changed', sync);
    };
  }, [key]);
  const pins = (state.key === key ? state.pins : null) ?? defaults;
  const save = (next: string[] | null) => {
    setState({ key, pins: next });
    try {
      if (key) {
        if (next) localStorage.setItem(key, JSON.stringify(next));
        else localStorage.removeItem(key);
        window.dispatchEvent(new Event('chatkit:launcher-changed'));
      }
    } catch {
      /* In-memory customization still works. */
    }
  };
  return { pins, save };
}

export function LauncherMenu({
  actions,
  pins,
  save,
}: {
  actions: LauncherAction[];
  pins: string[];
  save: (pins: string[] | null) => void;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const [customize, setCustomize] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const sorted = [...actions].sort(
    (a, b) =>
      (pins.includes(a.id) ? pins.indexOf(a.id) : 100) -
      (pins.includes(b.id) ? pins.indexOf(b.id) : 100),
  );
  const control =
    'inline-flex size-[max(1.75rem,calc(1.75rem*var(--chat-density-scale,1)))] shrink-0 items-center justify-center rounded-chat-item text-muted-foreground hover:bg-[var(--menu-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35 [@media(pointer:coarse)]:size-11';
  const row =
    'flex min-h-[max(1.75rem,calc(1.75rem*var(--chat-density-scale,1)))] min-w-0 items-center gap-[calc(0.5rem*var(--chat-density-scale,1))] rounded-chat-item px-[calc(0.625rem*var(--chat-density-scale,1))] py-[calc(0.25rem*var(--chat-density-scale,1))] text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [@media(pointer:coarse)]:min-h-11';
  const icon =
    'size-[max(0.75rem,calc(0.875rem*var(--chat-density-scale,1)))] shrink-0';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={control}
          aria-label={t('workbench.start.moreTools')}
        >
          <MoreHorizontal className={icon} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        style={getSurfaceThemeStyle(theme)}
        className="flex max-h-[min(28rem,var(--radix-popover-content-available-height))] w-[clamp(16rem,calc(18rem*var(--chat-density-scale,1)),22.5rem)] max-w-[calc(100vw-2rem)] flex-col rounded-chat-panel border-border/60 p-[calc(0.25rem*var(--chat-density-scale,1))] text-[length:max(0.75rem,calc(0.875rem*var(--chat-density-scale,1)))] leading-[max(1rem,calc(1.25rem*var(--chat-density-scale,1)))]"
      >
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          {sorted.map((action) => (
            <div
              key={action.id}
              className="flex items-center rounded-chat-item hover:bg-[var(--menu-hover)] focus-within:bg-[var(--menu-hover)]"
            >
              <button
                type="button"
                className={`${row} flex-1 disabled:opacity-50`}
                disabled={action.disabled}
                title={action.reason}
                onClick={() => {
                  action.run();
                  setOpen(false);
                }}
              >
                <span
                  className={`${icon} flex items-center justify-center [&>*]:max-h-full [&>*]:max-w-full`}
                >
                  {action.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{action.title}</span>
                  {action.reason && (
                    <span className="block text-[length:max(0.75rem,calc(0.75rem*var(--chat-density-scale,1)))] leading-snug text-muted-foreground">
                      {action.reason}
                    </span>
                  )}
                </span>
              </button>
              {customize && pins.includes(action.id) && (
                <>
                  <button
                    type="button"
                    className={control}
                    disabled={pins.indexOf(action.id) === 0}
                    aria-label={t('workbench.start.moveUp', {
                      title: action.title,
                    })}
                    onClick={() => {
                      const next = [...pins];
                      const i = next.indexOf(action.id);
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      save(next);
                    }}
                  >
                    <ArrowUp className={icon} />
                  </button>
                  <button
                    type="button"
                    className={control}
                    disabled={pins.indexOf(action.id) === pins.length - 1}
                    aria-label={t('workbench.start.moveDown', {
                      title: action.title,
                    })}
                    onClick={() => {
                      const next = [...pins];
                      const i = next.indexOf(action.id);
                      [next[i + 1], next[i]] = [next[i], next[i + 1]];
                      save(next);
                    }}
                  >
                    <ArrowDown className={icon} />
                  </button>
                </>
              )}
              <button
                type="button"
                className={control}
                aria-label={t(
                  pins.includes(action.id)
                    ? 'workbench.start.unpin'
                    : 'workbench.start.pin',
                  { title: action.title },
                )}
                aria-pressed={pins.includes(action.id)}
                onClick={() =>
                  save(
                    pins.includes(action.id)
                      ? pins.filter((id) => id !== action.id)
                      : [...pins, action.id],
                  )
                }
              >
                <Pin
                  className={`${icon} rotate-45`}
                  fill={pins.includes(action.id) ? 'currentColor' : 'none'}
                />
              </button>
            </div>
          ))}
        </div>
        <div className="shrink-0">
          <div className="mx-[calc(0.5rem*var(--chat-density-scale,1))] my-[calc(0.25rem*var(--chat-density-scale,1))] border-t border-border/60" />
          <button
            type="button"
            className={`${row} w-full hover:bg-[var(--menu-hover)]`}
            aria-pressed={customize}
            onClick={() => setCustomize(!customize)}
          >
            <Settings2 className={icon} />
            {t('workbench.start.customize')}
          </button>
          <button
            type="button"
            className={`${row} w-full text-muted-foreground hover:bg-[var(--menu-hover)]`}
            onClick={() => save(null)}
          >
            {t('workbench.start.reset')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
