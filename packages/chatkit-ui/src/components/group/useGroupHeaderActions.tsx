import { useRef, type ReactNode } from 'react';
import { History, Settings, Users } from 'lucide-react';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import type { ChatGroupSnapshot } from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useParentMessenger } from '../../hooks/useParentMessenger';
import {
  collectLiveTaskSummary,
  mergeTaskSummary,
} from '../../lib/task-summary';
import { ChatHeaderActions } from '../chat/header/ChatHeaderActions';
import { useChatPetSettings } from '../chat/pet/useChatPetSettings';
import { isPetEnabled } from '../pet/pet-local-settings';
import { PetBridge } from '../pet/PetBridge';
import { SettingsSheet } from '../settings/SettingsSheet';
import {
  TaskSummaryTrigger,
  type TaskSummaryProps,
} from '../task-summary/TaskSummary';
import { DropdownMenuItem } from '../ui/dropdown-menu';

export function useGroupHeaderActions({
  options,
  group,
  membersButton,
  onMembers,
  membersOpen,
  onLoadMore,
  onNavigateMessage,
  onFocusComposer,
}: {
  options?: ChatKitOptions | null;
  group: ChatGroupSnapshot | null;
  membersButton: ReactNode;
  onMembers: () => void;
  membersOpen: boolean;
  onLoadMore: () => void;
  onNavigateMessage: (id: string) => void;
  onFocusComposer: () => void;
}) {
  const { t } = useChatkitTranslation();
  const pet = useChatPetSettings({ options });
  const parent = useParentMessenger();
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const summary = mergeTaskSummary(
    null,
    collectLiveTaskSummary({
      messages: [],
      running: group?.runs.map((run) => ({
        id: run.runId,
        title:
          group.members.find((member) => member.id === run.participantId)
            ?.name ?? t('group.formerMember'),
        status: run.status,
        description: t(
          run.status === 'busy'
            ? 'message.thinking'
            : `group.run.${run.status}`,
        ),
      })),
      pending: group?.messages.flatMap((message) =>
        message.deliveries
          .filter((delivery) =>
            ['pending', 'blocked'].includes(delivery.status),
          )
          .map((delivery) => ({
            id: `${message.id}:${delivery.participantId}`,
            kind: 'follow_up' as const,
            title: `${group.members.find((member) => member.id === delivery.participantId)?.name ?? t('group.formerMember')} · ${t(`group.delivery.${delivery.status}`)}`,
            messageId: message.id,
            createdAt: message.createdAt,
          })),
      ),
    }),
  );
  const summaryProps: TaskSummaryProps = {
    summary,
    onNavigateMessage,
    onFocusComposer,
    onRetryHistory: onLoadMore,
    onLoadSection: () => undefined,
    onOpenResource: () => undefined,
  };
  return {
    summaryProps,
    actions: (
      <ChatHeaderActions
        moreButtonRef={moreButtonRef}
        onMenuCloseAutoFocus={(event) => {
          if (pet.petSettingsOpen || membersOpen) event.preventDefault();
        }}
        menu={
          <>
            {!pet.petDisabled && (
              <DropdownMenuItem onSelect={() => pet.setPetSettingsOpen(true)}>
                <Settings size={16} />
                {t('settings.open')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onMembers}>
              <Users size={16} />
              {t('group.membersTitle')}
            </DropdownMenuItem>
            {group?.hasMore && (
              <DropdownMenuItem onSelect={onLoadMore}>
                <History size={16} />
                {t('group.loadMore')}
              </DropdownMenuItem>
            )}
          </>
        }
        summary={
          options?.taskSummary?.enabled !== false && (
            <TaskSummaryTrigger {...summaryProps} />
          )
        }
        onMinimize={
          parent.isParentAvailable && isPetEnabled(pet.effectivePet)
            ? () =>
                parent.sendEvent('chat_minimize_change', { minimized: true })
            : undefined
        }
      >
        {membersButton}
      </ChatHeaderActions>
    ),
    footer: (
      <>
        <SettingsSheet
          open={!pet.petDisabled && pet.petSettingsOpen}
          settings={pet.displayedPetSettings}
          petRequired={pet.petRequired}
          onOpenChange={pet.setPetSettingsOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            moreButtonRef.current?.focus();
          }}
          onSave={pet.savePetLocalSettings}
        />
        <PetBridge
          pet={pet.effectivePet}
          state={
            group?.runs.some((run) => run.status === 'busy')
              ? 'running'
              : 'idle'
          }
        />
      </>
    ),
  };
}
