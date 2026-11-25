import { useWorkbench } from '../context';
import { rankSuggestions } from './search-suggestions';
import { useSearchHistory } from './useSearchHistory';
import * as React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Globe,
  History,
  House,
  MoreVertical,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import { resolveWorkbenchAddress } from './workbench-address';
import type { UrlWorkbenchPreview } from '../preview/types';

export type AddressSuggestion = {
  key: string;
  title: string;
  detail?: string;
  icon?: React.ReactNode;
  history?: boolean;
  kind?: 'action' | 'chat' | 'file' | 'website' | 'query';
  updatedAt?: number;
  opened?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};
export type BrowserNavigation = {
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onHome?: () => void;
};

export function WorkbenchAddressBar({
  variant = 'compact',
  value,
  onChange,
  apiUrl,
  currentUrl,
  suggestions,
  onOpen,
  onReload,
  loading = false,
  navigation,
}: {
  variant?: 'compact' | 'start';
  value: string;
  onChange: (value: string) => void;
  apiUrl: string;
  currentUrl?: string;
  suggestions: AddressSuggestion[];
  onOpen: (preview: UrlWorkbenchPreview) => void;
  onReload: () => void;
  loading?: boolean;
  navigation?: BrowserNavigation;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const workbench = useWorkbench();
  const history = useSearchHistory(workbench.storageScope, apiUrl);
  const input = React.useRef<HTMLInputElement>(null);
  const list = React.useRef<HTMLDivElement>(null);
  const focusHistory = React.useRef(false);
  const [focused, setFocused] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [historyOnly, setHistoryOnly] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const id = React.useId();
  const address = resolveWorkbenchAddress(value, apiUrl);
  const openAddress = (preview: UrlWorkbenchPreview) => {
    history.remember({
      value: preview.url,
      title: preview.title,
      kind: 'website',
    });
    setExpanded(false);
    onOpen(preview);
  };
  const remembered: AddressSuggestion[] = history.entries.map((entry) => ({
    key: `history:${entry.kind}:${entry.value}`,
    title: entry.title,
    detail: entry.kind === 'website' ? entry.value : undefined,
    kind: entry.kind,
    history: entry.kind === 'website',
    updatedAt: entry.at,
    icon: entry.kind === 'query' ? <Search size={16} /> : <History size={16} />,
    onSelect: () => {
      const resolved = resolveWorkbenchAddress(entry.value, apiUrl);
      if (entry.kind === 'website' && resolved.kind === 'url')
        openAddress(resolved.preview);
      else {
        onChange(entry.value);
        setExpanded(true);
      }
    },
  }));
  const ranked = rankSuggestions(
    [...suggestions, ...remembered],
    value,
    historyOnly,
  );
  const webSearch =
    value.trim() && workbench.searchUrlTemplate?.includes('{query}')
      ? resolveWorkbenchAddress(
          workbench.searchUrlTemplate.replace(
            '{query}',
            encodeURIComponent(value.trim()),
          ),
          apiUrl,
        )
      : null;
  const matches: AddressSuggestion[] = [...ranked];
  if (
    !historyOnly &&
    address.kind === 'url' &&
    !ranked.some((item) => item.detail === address.preview.url)
  )
    matches.unshift({
      key: 'command:open-url',
      title: t('workbench.start.openUrl'),
      detail: address.preview.url,
      kind: 'website',
      icon: <ArrowUpRight size={16} />,
      onSelect: () => openAddress(address.preview),
    });
  if (!historyOnly && address.kind === 'search' && webSearch?.kind === 'url')
    matches.push({
      key: 'command:web-search',
      title: t('workbench.browser.searchWeb', { query: value }),
      kind: 'action',
      icon: <Search size={16} />,
      onSelect: () => openAddress(webSearch.preview),
    });
  const showSuggestions = expanded;
  const selected = active >= 0 ? matches[active] : undefined;
  React.useEffect(() => {
    if (showSuggestions)
      list.current
        ?.querySelector<HTMLElement>('[aria-selected="true"]')
        ?.scrollIntoView?.({ block: 'nearest' });
  }, [active, showSuggestions]);
  React.useEffect(() => {
    setActive(-1);
    setError('');
  }, [value]);
  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const iconButton =
    'inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--chat-item-radius,var(--radius))] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-35 disabled:pointer-events-none';
  const submit = () => {
    if (selected && showSuggestions) {
      if (selected.disabled) return;
      if (value.trim())
        history.remember({
          value: value.trim(),
          title: value.trim(),
          kind: 'query',
        });
      setExpanded(false);
      selected.onSelect();
    } else if (address.kind === 'url') {
      const existing = suggestions.find(
        (item) => item.opened && item.detail === address.preview.url,
      );
      if (existing) {
        setExpanded(false);
        existing.onSelect();
        return;
      }
      setExpanded(false);
      if (address.preview.url === currentUrl) {
        onChange(currentUrl);
        onReload();
      } else openAddress(address.preview);
    } else if (address.kind === 'invalid') {
      setError(t('workbench.start.invalidUrl'));
    } else {
      if (value.trim())
        history.remember({
          value: value.trim(),
          title: value.trim(),
          kind: 'query',
        });
      setExpanded(true);
    }
  };
  return (
    <div className="relative z-20 shrink-0" style={getSurfaceThemeStyle(theme)}>
      <div
        className={
          variant === 'start'
            ? 'flex items-center gap-1 bg-background'
            : 'flex h-12 items-center gap-1 border-b bg-background px-2'
        }
      >
        {(variant === 'compact' ||
          navigation?.canBack ||
          navigation?.canForward) && (
          <>
            <button
              type="button"
              className={iconButton}
              aria-label={t('workbench.browser.back')}
              title={t('workbench.browser.back')}
              disabled={!navigation?.canBack}
              onClick={navigation?.onBack}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label={t('workbench.browser.forward')}
              title={t('workbench.browser.forward')}
              disabled={!navigation?.canForward}
              onClick={navigation?.onForward}
            >
              <ArrowRight size={17} />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label={t('workbench.browser.reload')}
              title={t('workbench.browser.reload')}
              disabled={loading}
              onClick={onReload}
            >
              <RefreshCw
                size={17}
                className={loading ? 'animate-spin' : undefined}
              />
            </button>
          </>
        )}
        <form
          role="search"
          aria-label={t('workbench.start.search')}
          className="relative mx-1 min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div
            className={`flex items-center rounded-chat-panel border ${variant === 'start' ? 'min-h-[calc(3.5rem*var(--chat-density-scale,1))] px-4 shadow-sm border-border' : 'h-9'} ${focused ? 'border-ring bg-muted/30' : 'hover:bg-muted/30'}`}
          >
            {variant === 'start' && (
              <Search size={20} className="shrink-0 text-muted-foreground" />
            )}
            <Input
              ref={input}
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls={showSuggestions ? id : undefined}
              aria-activedescendant={
                showSuggestions && selected ? `${id}-${active}` : undefined
              }
              aria-label={t('workbench.start.search')}
              placeholder={t('workbench.browser.placeholder')}
              autoComplete="off"
              spellCheck={false}
              value={value}
              className={`h-8 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 ${focused || variant === 'start' ? 'text-left' : 'text-center'}`}
              onFocus={(event) => {
                setFocused(true);
                setExpanded(true);
                event.target.select();
              }}
              onBlur={() => {
                setFocused(false);
                setExpanded(false);
              }}
              onChange={(event) => {
                setHistoryOnly(false);
                setExpanded(true);
                setActive(-1);
                onChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.keyCode === 229) {
                  if (event.key === 'Enter') event.preventDefault();
                  return;
                }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setExpanded(true);
                  setActive((index) =>
                    matches.length
                      ? index < 0
                        ? event.key === 'ArrowDown'
                          ? 0
                          : matches.length - 1
                        : (index +
                            (event.key === 'ArrowDown' ? 1 : -1) +
                            matches.length) %
                          matches.length
                      : -1,
                  );
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setExpanded(false);
                  setActive(-1);
                  setError('');
                  if (currentUrl) onChange(currentUrl);
                }
              }}
            />
            {value.trim() && (
              <button
                type="submit"
                className={iconButton}
                aria-label={t('workbench.start.openUrl')}
                title={t('workbench.start.openUrl')}
              >
                <ArrowUpRight size={16} />
              </button>
            )}
          </div>
          {showSuggestions && (
            <div
              ref={list}
              id={id}
              role="listbox"
              aria-label={t('workbench.browser.suggestions')}
              className="absolute inset-x-0 top-full mt-1 max-h-80 overflow-y-auto rounded-[var(--chat-panel-radius,var(--radius))] border bg-popover p-1.5 text-popover-foreground shadow-lg"
            >
              {!matches.length && address.kind === 'search' && (
                <p
                  role="status"
                  className="px-3 py-3 text-sm text-muted-foreground"
                >
                  {t(
                    historyOnly
                      ? 'workbench.browser.noHistory'
                      : 'workbench.start.noResults',
                  )}
                </p>
              )}
              {matches.map((item, index) => (
                <div
                  key={item.key}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  aria-disabled={item.disabled || undefined}
                  className={`flex cursor-pointer items-center gap-3 rounded-[var(--chat-item-radius,var(--radius))] px-[calc(0.75rem*var(--chat-density-scale,1))] py-[calc(0.625rem*var(--chat-density-scale,1))] text-sm ${index === active ? 'bg-muted' : 'hover:bg-muted/60'}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (item.disabled) return;
                    if (value.trim())
                      history.remember({
                        value: value.trim(),
                        title: value.trim(),
                        kind: 'query',
                      });
                    setExpanded(false);
                    item.onSelect();
                  }}
                >
                  <span className="shrink-0 text-muted-foreground">
                    {item.icon ?? <Globe size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      <SearchMatch text={item.title} query={value} />
                    </span>
                    {item.detail && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.opened
                      ? t('workbench.browser.switchTab')
                      : item.kind
                        ? t(`workbench.browser.kind.${item.kind}`)
                        : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </form>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={iconButton}
              aria-label={t('workbench.browser.more')}
            >
              <MoreVertical size={17} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            style={getSurfaceThemeStyle(theme)}
            className="min-w-48 rounded-[var(--chat-panel-radius,var(--radius))]"
            onCloseAutoFocus={(event) => {
              if (focusHistory.current) {
                event.preventDefault();
                input.current?.focus();
                focusHistory.current = false;
              }
            }}
          >
            {navigation?.onHome && (
              <DropdownMenuItem onSelect={navigation.onHome}>
                <House />
                {t('workbench.browser.home')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => {
                focusHistory.current = true;
                setHistoryOnly(true);
                setActive(-1);
                onChange('');
                setExpanded(true);
              }}
            >
              <History />
              {t('workbench.browser.history')}
            </DropdownMenuItem>
            {history.entries.length > 0 && (
              <DropdownMenuItem onSelect={history.clear}>
                <History />
                {t('workbench.browser.clearHistory')}
              </DropdownMenuItem>
            )}
            {currentUrl && (
              <>
                <DropdownMenuItem
                  onSelect={async () => {
                    try {
                      await navigator.clipboard.writeText(currentUrl);
                      setCopied(true);
                    } catch {
                      setError(t('workbench.files.copyFailed'));
                    }
                  }}
                >
                  <Copy />
                  {t('workbench.browser.copyUrl')}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    {t('workbench.preview.openExternal')}
                  </a>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error && (
        <p role="alert" className="border-b px-4 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {copied && (
        <p
          role="status"
          className="border-b px-4 py-2 text-xs text-muted-foreground"
        >
          {t('workbench.files.copied')}
        </p>
      )}
    </div>
  );
}

function SearchMatch({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  const index = needle
    ? text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase())
    : -1;
  return index < 0 ? (
    text
  ) : (
    <>
      {text.slice(0, index)}
      <mark className="bg-accent text-accent-foreground font-semibold">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}
