import type { AddressSuggestion } from './WorkbenchAddressBar';

export function rankSuggestions(
  items: AddressSuggestion[],
  query: string,
  historyOnly = false,
): AddressSuggestion[] {
  const needle = query.trim().toLocaleLowerCase();
  const unique = new Map<string, AddressSuggestion>();
  for (const item of items) {
    if (historyOnly && !item.history) continue;
    const identity =
      item.kind === 'website' || item.history ? `url:${item.detail}` : item.key;
    const previous = unique.get(identity);
    if (
      !previous ||
      (item.opened && !previous.opened) ||
      (Boolean(item.opened) === Boolean(previous.opened) &&
        (item.updatedAt ?? 0) > (previous.updatedAt ?? 0))
    )
      unique.set(identity, item);
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
        Number(!!b.opened) - Number(!!a.opened) ||
        (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    )
    .slice(0, 12);
}
