import * as React from 'react';
import {
  ChevronDown,
  File,
  FileSearch,
  Folders,
  ListCollapse,
  ListStart,
  MoreHorizontal,
  RotateCw,
  WrapText,
  Columns2,
  Rows2,
  PanelsTopLeft,
  Eye,
  Package,
  Clipboard,
  Image,
  Braces,
} from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { ReviewIconButton, ReviewStats } from './ReviewPrimitives';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '../../components/ui/dropdown-menu';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '../../components/ui/popover';
import type { ReviewSettings } from './review-presentation';
import type { FileReviewEntry } from './types';
import { ReviewJumpList } from './ReviewNavigation';

export function ReviewControls({
  scope,
  setScope,
  settings,
  setSettings,
  total,
  loading,
  refresh,
  entries,
  allCollapsed,
  toggleAll,
  showTree,
  toggleTree,
  jump,
  copyPatch,
  canCopyPatch,
}: {
  scope: 'selected' | 'conversation';
  setScope: (scope: 'selected' | 'conversation') => void;
  settings: ReviewSettings;
  setSettings: React.Dispatch<React.SetStateAction<ReviewSettings>>;
  total: { added: number; removed: number; known: number };
  loading: boolean;
  refresh: () => void;
  entries: FileReviewEntry[];
  allCollapsed: boolean;
  toggleAll: () => void;
  showTree: boolean;
  toggleTree: () => void;
  jump: (key: string) => void;
  copyPatch: () => void;
  canCopyPatch: boolean;
}) {
  const { t } = useChatkitTranslation();
  const [jumpOpen, setJumpOpen] = React.useState(false);
  const toggle = (name: keyof Omit<ReviewSettings, 'layout'>) =>
    setSettings((value) => ({ ...value, [name]: !value[name] }));
  const nextLayout =
    settings.layout === 'auto'
      ? 'split'
      : settings.layout === 'split'
        ? 'unified'
        : 'auto';
  const LayoutIcon =
    settings.layout === 'auto'
      ? PanelsTopLeft
      : settings.layout === 'split'
        ? Columns2
        : Rows2;
  return (
    <header className="review-toolbar">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="review-scope"
            type="button"
            aria-label={t('workbench.review.scope')}
          >
            <span>{t(`workbench.review.${scope}`)}</span>
            <ChevronDown size={14} />
            {total.known > 0 && (
              <ReviewStats added={total.added} removed={total.removed} />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-48 rounded-xl p-2">
          <DropdownMenuRadioGroup
            value={scope}
            onValueChange={(value) => setScope(value as typeof scope)}
          >
            <DropdownMenuRadioItem value="selected">
              {t('workbench.review.selected')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="conversation">
              {t('workbench.review.conversation')}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="review-tools">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ReviewIconButton label={t('workbench.review.options')}>
              <MoreHorizontal size={18} />
            </ReviewIconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="review-menu min-w-60 rounded-2xl p-2"
          >
            {(
              [
                ['fullFile', File],
                ['preview', Image],
                ['wordDiff', Braces],
                ['hideWhitespace', Eye],
                ['hideImports', Package],
                ['metadata', FileSearch],
              ] as const
            ).map(([name, Icon]) => (
              <DropdownMenuCheckboxItem
                key={name}
                checked={settings[name]}
                onCheckedChange={() => toggle(name)}
              >
                <Icon size={17} />
                {t(`workbench.review.${name}`)}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuItem disabled={!canCopyPatch} onSelect={copyPatch}>
              <Clipboard size={17} />
              {t('workbench.review.copyPatch')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
          <PopoverTrigger asChild>
            <ReviewIconButton
              label={t('workbench.review.jump')}
              disabled={!entries.length}
            >
              <FileSearch size={18} />
            </ReviewIconButton>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="review-jump-popover w-[min(440px,calc(100vw-24px))] rounded-2xl p-2"
          >
            <ReviewJumpList
              entries={entries}
              onSelect={(key) => {
                jump(key);
                setJumpOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        <ReviewIconButton
          label={t('workbench.files.refresh')}
          disabled={loading}
          onClick={refresh}
        >
          <RotateCw size={18} className={loading ? 'animate-spin' : ''} />
        </ReviewIconButton>
        <ReviewIconButton
          label={t('workbench.review.wrap')}
          aria-pressed={settings.wrap}
          onClick={() => toggle('wrap')}
        >
          <WrapText size={18} />
        </ReviewIconButton>
        <ReviewIconButton
          label={t(
            `workbench.review.${allCollapsed ? 'expandAll' : 'collapseAll'}`,
          )}
          disabled={!entries.length}
          onClick={toggleAll}
        >
          {allCollapsed ? <ListStart size={18} /> : <ListCollapse size={18} />}
        </ReviewIconButton>
        <ReviewIconButton
          label={t('workbench.review.switchLayout', {
            layout: t(`workbench.review.${nextLayout}`),
          })}
          onClick={() =>
            setSettings((value) => ({ ...value, layout: nextLayout }))
          }
        >
          <LayoutIcon size={18} />
        </ReviewIconButton>
        <ReviewIconButton
          label={t('workbench.review.files')}
          aria-pressed={showTree}
          onClick={toggleTree}
        >
          <Folders size={18} />
        </ReviewIconButton>
      </div>
    </header>
  );
}
