import * as React from 'react';
import { BookOpen } from 'lucide-react';
import {
  chatSkillUsageKey,
  type ChatSkillUsage,
} from '@xpert-ai/chatkit-types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export function MessageSkills({
  usages,
  onOpen,
}: {
  usages: readonly ChatSkillUsage[];
  onOpen?: () => void;
}) {
  const { t } = useChatkitTranslation();
  const [open, setOpen] = React.useState(false);
  const pinned = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const titleId = React.useId();
  const cancelClose = () => clearTimeout(timer.current);
  const show = () => {
    cancelClose();
    setOpen(true);
    onOpen?.();
  };
  const close = () => {
    cancelClose();
    pinned.current = false;
    setOpen(false);
  };
  const scheduleClose = () => {
    cancelClose();
    timer.current = setTimeout(() => {
      if (!pinned.current) setOpen(false);
    }, 150);
  };
  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('messageActions.skills.title')}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerEnter={(event) => {
            if (event.pointerType !== 'touch') show();
          }}
          onPointerLeave={scheduleClose}
          onFocus={show}
          onBlur={scheduleClose}
          onClick={(event) => {
            event.preventDefault();
            if (pinned.current) close();
            else {
              pinned.current = true;
              show();
            }
          }}
        >
          <BookOpen size={14} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        aria-labelledby={titleId}
        className="w-max max-w-[min(24rem,calc(100vw-2rem))] rounded-xl p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
      >
        <div id={titleId} className="mb-2 text-sm font-medium">
          {t('messageActions.skills.title')}
        </div>
        <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
          {usages.map((usage) => (
            <li
              key={chatSkillUsageKey(usage)}
              className="flex items-start justify-between gap-4"
            >
              <span className="min-w-0 break-words">{usage.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {t(`messageActions.skills.sources.${usage.source.type}`)}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
