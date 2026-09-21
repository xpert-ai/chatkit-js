import type { Thread } from '@xpert-ai/xpert-sdk';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export function ThreadRunControls({
  branches,
  current,
  onSelect,
}: {
  branches: Thread[];
  current?: Thread;
  onSelect: (threadId: string) => void;
}) {
  const { t } = useChatkitTranslation();
  if (!current || branches.length < 2) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
      <Select value={current.thread_id} onValueChange={onSelect}>
        <SelectTrigger size="sm" aria-label={t('threadControl.branch')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch, index) => (
            <SelectItem key={branch.thread_id} value={branch.thread_id}>
              {t('threadControl.branchNumber', { number: index + 1 })} ·{' '}
              {t(`threadControl.status.${branch.status}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
