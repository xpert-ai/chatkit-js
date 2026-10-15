import * as React from 'react';
import type { XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import { Loader2, Search } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { useTheme } from '../../../providers/Theme';
import { getDensitySpacing } from '../../../lib/theme-surfaces';
import type { useWorkspaceFileTree } from './useWorkspaceFileTree';
import { resolveWorkspacePath } from './workspace-file-utils';

export function WorkspaceFileSearch({
  query,
  onQueryChange,
  basePath = '',
  tree,
  onLocate,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  basePath?: string;
  tree: ReturnType<typeof useWorkspaceFileTree>;
  onLocate: (file: XpertWorkspaceFile) => void;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const { spacing } = getDensitySpacing(theme.density ?? 'normal');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const request = React.useRef<AbortController | null>(null);
  const errorId = React.useId();
  React.useEffect(() => () => request.current?.abort(), [basePath]);
  async function locate() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const path = resolveWorkspacePath(query, basePath);
    setError('');
    if (path === null) {
      setBusy(false);
      setError(t('workbench.files.invalidPath'));
      return;
    }
    setBusy(true);
    try {
      const file = await tree.locate(path, controller.signal);
      if (controller.signal.aborted) return;
      if (!file) setError(t('workbench.files.pathNotFound'));
      else {
        onQueryChange('');
        onLocate(file);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error ? error.message : t('workbench.files.failed'),
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const Icon = busy ? Loader2 : Search;
  return (
    <div className="shrink-0" style={{ padding: `${8 * spacing}px` }}>
      <div className="relative">
        <Icon
          size={16 * spacing}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground ${busy ? 'animate-spin' : ''}`}
          style={{ left: 10 * spacing }}
        />
        <Input
          type="search"
          value={query}
          placeholder={t('workbench.files.search')}
          aria-label={t('workbench.files.search')}
          title={t('workbench.files.pathHint', { path: basePath || '/' })}
          aria-busy={busy}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="rounded-chat-item shadow-none"
          style={{
            height: 36 * spacing,
            paddingInlineStart: 34 * spacing,
            paddingInlineEnd: 10 * spacing,
            paddingBlock: 6 * spacing,
          }}
          onChange={(event) => {
            request.current?.abort();
            setBusy(false);
            setError('');
            onQueryChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              void locate();
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              event.currentTarget
                .closest('[data-file-browser]')
                ?.querySelector<HTMLButtonElement>('[role="treeitem"]')
                ?.focus();
            }
          }}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
