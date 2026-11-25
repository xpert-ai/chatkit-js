import * as React from 'react';
import { z } from 'zod';
import {
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Pin,
  RotateCcw,
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
    'inline-flex items-center justify-center rounded-chat-item p-[calc(0.5rem*var(--chat-density-scale,1))] text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={control}
          aria-label={t('workbench.start.moreTools')}
        >
          <MoreHorizontal size={20} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        style={getSurfaceThemeStyle(theme)}
        className="w-80 max-w-[calc(100vw-2rem)] rounded-chat-panel p-2"
      >
        <div className="max-h-80 overflow-y-auto">
          {sorted.map((action) => (
            <div key={action.id} className="flex items-center gap-1">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-[calc(0.75rem*var(--chat-density-scale,1))] rounded-chat-item px-[calc(0.75rem*var(--chat-density-scale,1))] py-[calc(0.5rem*var(--chat-density-scale,1))] text-left text-sm hover:bg-muted disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring"
                disabled={action.disabled}
                title={action.reason}
                onClick={() => {
                  action.run();
                  setOpen(false);
                }}
              >
                <span className="shrink-0">{action.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate">{action.title}</span>
                  {action.reason && (
                    <span className="block text-xs text-muted-foreground">
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
                    <ArrowUp size={14} />
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
                    <ArrowDown size={14} />
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
                  size={16}
                  fill={pins.includes(action.id) ? 'currentColor' : 'none'}
                />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 border-t pt-2">
          <button
            type="button"
            className={`${control} gap-2 text-sm`}
            aria-pressed={customize}
            onClick={() => setCustomize(!customize)}
          >
            <Settings2 size={16} />
            {t('workbench.start.customize')}
          </button>
          <button
            type="button"
            className={`${control} gap-2 text-sm`}
            onClick={() => save(null)}
          >
            <RotateCcw size={16} />
            {t('workbench.start.reset')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
