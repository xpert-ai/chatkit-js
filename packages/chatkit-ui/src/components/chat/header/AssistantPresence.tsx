import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { ChatKitPetAnimationName } from '@xpert-ai/chatkit-types';
import { Pencil, X } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'framer-motion';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import {
  TaskSummaryContent,
  type TaskSummaryProps,
} from '../../task-summary/TaskSummary';
import type { ChatkitAvatarData } from '../../ui/chatkit-avatar';
import { AssistantCharacter } from './AssistantCharacter';

export type AssistantPresenceProps = {
  avatar: ChatkitAvatarData | null;
  /** Group conversations supply their member avatars in the existing presence layout. */
  avatarContent?: React.ReactNode;
  statusText?: string;
  /** Inline detail panels move the avatar; a modal dialog leaves its trigger in place. */
  hideWhenOpen?: boolean;
  name: string;
  state: ChatKitPetAnimationName;
  waitingForInput: boolean;
  activity?: string;
  reducedMotion?: boolean;
  /** Unique to this Chat instance, so embedded chats never share an avatar transition. */
  motionId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomize?: () => void;
};

const PRESENCE_EASE = [0.22, 1, 0.36, 1] as const;

function PresenceCharacter({
  presence,
  size = '5rem',
}: {
  presence: AssistantPresenceProps;
  size?: string;
}) {
  const systemReducedMotion = useReducedMotion();
  const still = presence.reducedMotion || systemReducedMotion;
  return (
    <motion.div
      data-slot="assistant-presence-character"
      layoutId={still ? undefined : presence.motionId}
      className="relative z-10 shrink-0"
      style={{ width: size, height: size }}
      transition={{ layout: { duration: 0.34, ease: PRESENCE_EASE } }}
    >
      {presence.avatarContent ?? (
        <AssistantCharacter {...presence} size={size} />
      )}
    </motion.div>
  );
}

function PresenceStatus({
  state,
  waitingForInput,
  activity,
  statusText,
}: Pick<
  AssistantPresenceProps,
  'state' | 'waitingForInput' | 'activity' | 'statusText'
>) {
  const { t } = useChatkitTranslation();
  const key = waitingForInput
    ? 'approval'
    : state === 'failed'
      ? 'failed'
      : state === 'review'
        ? 'thinking'
        : state === 'running'
          ? 'running'
          : state === 'waiting'
            ? 'loading'
            : 'idle';
  return (
    <span
      role="status"
      aria-live="polite"
      className="block max-w-56 truncate text-xs text-muted-foreground"
      title={activity}
    >
      {statusText ?? t(`assistantPresence.${key}`)}
      {!statusText && activity && key === 'running' ? ` · ${activity}` : ''}
    </span>
  );
}

export function AssistantPresence(props: AssistantPresenceProps) {
  const { t } = useChatkitTranslation();
  const systemReducedMotion = useReducedMotion();
  const still = props.reducedMotion || systemReducedMotion;
  const hideTrigger = props.open && props.hideWhenOpen !== false;
  return (
    <div
      data-slot="assistant-presence"
      className="chatkit-presence pointer-events-none relative z-20 col-start-1 row-start-1 flex min-w-0 shrink-0 flex-col items-center self-start"
    >
      <button
        id={props.motionId ? `${props.motionId}-trigger` : undefined}
        type="button"
        aria-label={t('assistantPresence.open', { name: props.name })}
        aria-haspopup="dialog"
        aria-expanded={props.open}
        aria-hidden={hideTrigger || undefined}
        inert={hideTrigger || undefined}
        tabIndex={hideTrigger ? -1 : undefined}
        className="chatkit-presence-trigger pointer-events-auto grid justify-items-center rounded-2xl outline-offset-4"
        onClick={() => props.onOpenChange(true)}
      >
        {/* Reserve the header height while expanded; the conversation must not jump. */}
        <span className="block size-20">
          {!hideTrigger && <PresenceCharacter presence={props} />}
        </span>
        <motion.span
          initial={false}
          animate={{
            '--presence-bubble-opacity': hideTrigger ? 0 : 1,
            y: hideTrigger && !still ? -6 : 0,
          }}
          style={{ opacity: 'var(--presence-bubble-opacity, 1)' }}
          transition={{ duration: still ? 0 : 0.18, ease: PRESENCE_EASE }}
          className="chatkit-presence-bubble max-w-64 rounded-2xl border border-border/60 bg-popover/95 shadow-sm backdrop-blur-sm"
        >
          <span className="block truncate text-sm font-medium">
            {props.name}
          </span>
          <PresenceStatus {...props} />
        </motion.span>
      </button>
    </div>
  );
}

export function AssistantSummaryDialog({
  presence,
  summary,
  computers,
  voice,
  children,
  title,
  closeLabel,
}: {
  presence: AssistantPresenceProps;
  summary: TaskSummaryProps;
  children?: React.ReactNode;
  title?: string;
  closeLabel?: string;
  computers?: React.ReactNode;
  voice?: { panel: React.ReactNode; dial: React.ReactNode };
}) {
  const { t } = useChatkitTranslation();
  const dialog = React.useRef<HTMLDivElement>(null);
  const opener = React.useRef<HTMLElement | null>(null);
  const restoreFocus = React.useRef(true);
  const wasOpen = React.useRef(false);
  React.useLayoutEffect(() => {
    if (presence.open && !wasOpen.current) {
      restoreFocus.current = true;
      const active = document.activeElement;
      opener.current =
        active instanceof HTMLElement && active !== document.body
          ? active
          : null;
      dialog.current?.focus({ preventScroll: true });
    } else if (!presence.open && wasOpen.current && restoreFocus.current) {
      // Restore immediately, not after the exit animation, which could steal focus
      // from a composer the user has already clicked while the panel fades out.
      const target = opener.current?.isConnected
        ? opener.current
        : presence.motionId
          ? document.getElementById(`${presence.motionId}-trigger`)
          : document.querySelector<HTMLButtonElement>(
              '[data-slot="assistant-presence"] button',
            );
      target?.focus({ preventScroll: true });
    }
    wasOpen.current = presence.open;
  }, [presence.open, presence.motionId]);
  React.useEffect(() => {
    if (!presence.open || voice?.panel) return;
    // Parent-host clicks do not bubble through an iframe's document.
    const dismiss = () => {
      restoreFocus.current = false;
      presence.onOpenChange(false);
    };
    window.addEventListener('blur', dismiss);
    return () => window.removeEventListener('blur', dismiss);
  }, [presence.open, presence.onOpenChange, voice?.panel]);
  return (
    <div className="chatkit-presence-stack pointer-events-none absolute z-30 flex max-h-[calc(100%-1.5rem)] flex-col gap-3">
      {voice?.panel}
      <Dialog.Root
        open={presence.open}
        onOpenChange={presence.onOpenChange}
        modal={false}
      >
        <AnimatePresence initial={false}>
          {presence.open && (
            <PresenceDialogSurface
              key="assistant-summary"
              presence={presence}
              ref={dialog}
              aria-describedby={undefined}
              aria-modal="false"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
              }}
              onInteractOutside={(event) => {
                const target = event.target;
                // Let the shared summary button toggle once, instead of close + reopen.
                if (
                  target instanceof Element &&
                  target.closest(
                    '[data-slot="task-summary-trigger"], [data-slot="voice-call-panel"]',
                  )
                ) {
                  event.preventDefault();
                  return;
                }
                restoreFocus.current = false;
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
              }}
            >
              <Dialog.Title className="sr-only">
                {title ?? t('assistantPresence.details')}
              </Dialog.Title>
              <div className="chatkit-presence-header flex shrink-0 items-start">
                <PresenceCharacter presence={presence} size="4rem" />
                <div className="chatkit-presence-details min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{presence.name}</h2>
                  <PresenceStatus {...presence} />
                  {presence.onCustomize && (
                    <button
                      type="button"
                      className="chatkit-presence-customize flex items-center text-xs text-muted-foreground hover:text-foreground"
                      onClick={presence.onCustomize}
                    >
                      <Pencil className="size-3 shrink-0" />
                      {t('assistantPresence.customize')}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="chatkit-presence-close flex shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  aria-label={closeLabel ?? t('assistantPresence.close')}
                  onClick={() => presence.onOpenChange(false)}
                >
                  <X className="size-[1.125rem]" />
                </button>
              </div>
              <div className="min-h-0 overflow-auto rounded-b-3xl">
                {voice?.dial}
                {computers}
                {children}
                <TaskSummaryContent {...summary} />
              </div>
            </PresenceDialogSurface>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </div>
  );
}

const PresenceDialogSurface = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Dialog.Content> & {
    presence: AssistantPresenceProps;
  }
>(function PresenceDialogSurface({ presence, children, ...props }, ref) {
  const isPresent = useIsPresent();
  const systemReducedMotion = useReducedMotion();
  const still = presence.reducedMotion || systemReducedMotion;
  return (
    <Dialog.Content
      {...props}
      forceMount
      asChild
      ref={ref}
      inert={!isPresent || undefined}
    >
      <motion.div
        data-slot="assistant-summary-dialog"
        // The exit visual remains mounted, but must stop receiving input immediately.
        aria-hidden={!isPresent || undefined}
        initial={
          still ? false : { '--presence-opacity': 0, x: 12, y: -4, scale: 0.98 }
        }
        animate={{ '--presence-opacity': 1, x: 0, y: 0, scale: 1 }}
        exit={{
          '--presence-opacity': 0,
          x: still ? 0 : 12,
          y: still ? 0 : -4,
          scale: still ? 1 : 0.98,
        }}
        transition={{ duration: still ? 0 : 0.24, ease: PRESENCE_EASE }}
        style={{
          // Keep opacity on the same animation clock as the shared avatar layout.
          opacity: 'var(--presence-opacity, 1)',
          transformOrigin: 'top right',
          pointerEvents: isPresent ? 'auto' : 'none',
        }}
        className="chatkit-presence-dialog pointer-events-auto relative flex min-h-0 flex-col rounded-3xl border border-border/70 bg-popover text-popover-foreground shadow-xl outline-none"
      >
        {children}
      </motion.div>
    </Dialog.Content>
  );
});
