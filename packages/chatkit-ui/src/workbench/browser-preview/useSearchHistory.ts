import * as React from 'react';
import { z } from 'zod';
import { resolveWorkbenchAddress } from './workbench-address';
const schema = z
  .array(
    z.object({
      value: z.string().max(2048),
      title: z.string().max(300),
      kind: z.enum(['query', 'website']),
      at: z.number(),
    }),
  )
  .max(50);
type Entry = z.infer<typeof schema>[number];
const changed = 'chatkit:search-history-changed';
export function useSearchHistory(scope: string | undefined, apiUrl: string) {
  const key = scope ? `chatkit:search:v1:${scope}` : undefined;
  const read = React.useCallback((): Entry[] => {
    try {
      return key
        ? schema
            .parse(JSON.parse(localStorage.getItem(key) || '[]'))
            .filter(
              (item) =>
                item.kind !== 'website' ||
                resolveWorkbenchAddress(item.value, apiUrl).kind === 'url',
            )
        : [];
    } catch {
      return [];
    }
  }, [key, apiUrl]);
  const [state, setState] = React.useState({ key, entries: read() });
  React.useEffect(() => {
    const sync = () => setState({ key, entries: read() });
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(changed, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(changed, sync);
    };
  }, [key, read]);
  const entries = state.key === key ? state.entries : [];
  const save = (next: Entry[]) => {
    setState({ key, entries: next });
    try {
      if (key) {
        localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new Event(changed));
      }
    } catch {
      /* Keep session history without storage. */
    }
  };
  return {
    entries,
    clear: () => save([]),
    remember: (entry: Omit<Entry, 'at'>) => {
      if (!entry.value.trim()) return;
      save(
        [
          { ...entry, at: Date.now() },
          ...(key ? read() : entries).filter(
            (item) => item.kind !== entry.kind || item.value !== entry.value,
          ),
        ].slice(0, 50),
      );
    },
  };
}
