import type { AddressSuggestion } from './WorkbenchAddressBar';

export function rankSuggestions(
  items: AddressSuggestion[],
  query: string,
  mode: 'all' | 'websites' | 'recent' = 'all',
): AddressSuggestion[] {
  const needle = query.trim().toLocaleLowerCase();
  const unique = new Map<string, AddressSuggestion>();
  for (const item of items) {
    if (mode === 'websites' && !item.history) continue;
    if (
      mode === 'recent' &&
      !item.history &&
      item.kind !== 'website' &&
      item.kind !== 'query'
    )
      continue;
    const identity =
      item.kind === 'website' || item.history ? `url:${item.detail}` : item.key;
    const previous = unique.get(identity);
    const preferred =
      !previous ||
      (item.opened && !previous.opened) ||
      (Boolean(item.opened) === Boolean(previous.opened) &&
        (item.updatedAt ?? 0) > (previous.updatedAt ?? 0))
        ? item
        : previous;
    unique.set(
      identity,
      mode === 'recent' && previous
        ? {
            ...preferred,
            updatedAt: Math.max(item.updatedAt ?? 0, previous.updatedAt ?? 0),
          }
        : preferred,
    );
  }
  const score = (item: AddressSuggestion) => {
    const title = item.title.toLocaleLowerCase();
    const detail = item.detail?.toLocaleLowerCase() ?? '';
    if (!needle) return 0;
    if (title === needle || detail === needle) return 0;
    if (title.startsWith(needle) || detail.startsWith(needle)) return 1;
    if (`${title} ${detail}`.includes(needle)) return 2;
    return 3;
  };
  return [...unique.values()]
    .filter((item) => score(item) < 3)
    .sort(
      (a, b) =>
        score(a) - score(b) ||
        (mode === 'recent' ? 0 : Number(!!b.opened) - Number(!!a.opened)) ||
        (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    )
    .slice(0, 12);
}
