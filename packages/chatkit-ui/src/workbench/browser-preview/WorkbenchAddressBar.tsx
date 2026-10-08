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
  const needle = value.trim().toLocaleLowerCase();
  const matches = suggestions
    .filter(
      (item) =>
        (!historyOnly || item.history) &&
        (!needle ||
          `${item.title} ${item.detail ?? ''}`
            .toLocaleLowerCase()
            .includes(needle)),
    )
    .slice(0, 8);
  const showSuggestions = expanded && matches.length > 0;
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
      setExpanded(false);
      selected.onSelect();
    } else if (address.kind === 'url') {
      setExpanded(false);
      if (address.preview.url === currentUrl) {
        onChange(currentUrl);
        onReload();
      } else onOpen(address.preview);
    } else if (address.kind === 'invalid') {
      setError(t('workbench.start.invalidUrl'));
    } else {
      setExpanded(true);
    }
  };
  return (
    <div className="relative z-20 shrink-0" style={getSurfaceThemeStyle(theme)}>
      <div className="flex h-12 items-center gap-1 border-b bg-background px-2">
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
            className={`flex h-9 items-center rounded-[var(--chat-item-radius,var(--radius))] border ${focused ? 'border-border bg-muted/70' : 'border-transparent hover:bg-muted/50'}`}
          >
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
              className={`h-8 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 ${focused ? 'text-left' : 'text-center'}`}
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
              {matches.map((item, index) => (
                <div
                  key={item.key}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={`flex cursor-pointer items-center gap-3 rounded-[var(--chat-item-radius,var(--radius))] px-3 py-2.5 text-sm ${index === active ? 'bg-muted' : 'hover:bg-muted/60'}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setExpanded(false);
                    item.onSelect();
                  }}
                >
                  <span className="shrink-0 text-muted-foreground">
                    {item.icon ?? <Globe size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.title}
                    </span>
                    {item.detail && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
          {expanded && historyOnly && !matches.length && (
            <p
              role="status"
              className="absolute inset-x-0 top-full mt-1 rounded-[var(--chat-panel-radius,var(--radius))] border bg-popover p-3 text-sm text-muted-foreground shadow-lg"
            >
              {t('workbench.browser.noHistory')}
            </p>
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
