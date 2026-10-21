import { safeRandomUUID } from '@xpert-ai/chatkit-web-shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChatGroupProject,
  ChatGroupSnapshot,
  Client,
} from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import type { ProjectSelectorProps } from '../composer/ProjectSelector';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { GroupProjectForm } from './GroupProject';
import type { GroupProjectIntent } from './useGroupProjectForm';

const creationTypes = [
  { applicationKey: 'platform', projectTypeKey: 'general' },
];

/** Group scope replaces per-recipient Project selection; nothing changes until confirmation succeeds. */
export function useGroupProject({
  client,
  group,
  onSaved,
}: {
  client: Client;
  group: ChatGroupSnapshot | null;
  onSaved: () => void;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const groupId = group?.id;
  const primary = group?.members.find(
    (member) =>
      member.active &&
      member.kind === 'assistant' &&
      member.subjectId === group.xpertId,
  );
  const owner =
    group?.members.find((member) => member.id === group.viewerParticipantId)
      ?.role === 'owner';
  const primaryId = primary?.id;
  const scoped = useMemo(
    () =>
      groupId && primaryId ? client.forGroupComposer(groupId, primaryId) : null,
    [client, groupId, primaryId],
  );
  const [value, setValue] = useState<{
    groupId: string;
    project: ChatGroupProject | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState<{
    groupId: string;
    intent: GroupProjectIntent;
  } | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const project = value && value.groupId === groupId ? value.project : null;
  const ready = !!groupId && value?.groupId === groupId && !error;
  useEffect(() => {
    const abort = new AbortController();
    setError(null);
    if (groupId)
      void client.groups
        .project(groupId, { signal: abort.signal })
        .then((project) => {
          if (!abort.signal.aborted) setValue({ groupId, project });
        })
        .catch((reason: unknown) => {
          if (!abort.signal.aborted)
            setError(reason instanceof Error ? reason.message : String(reason));
        });
    return () => abort.abort();
  }, [client, groupId, group?.revision, retry]);
  function open(intent: GroupProjectIntent) {
    if (!groupId) return;
    setPending({ groupId, intent });
  }
  const selector: ProjectSelectorProps = {
    triggerRef: opener,
    onCloseAutoFocus: (event) => {
      if (pending?.groupId === groupId) event.preventDefault();
    },
    client: scoped,
    xpertId: group?.xpertId,
    activeProjectId: project?.projectId,
    label: project?.name,
    ready,
    disabled: !ready || !primary,
    locked: !!project || !owner,
    allowNone: false,
    autoNewEnabled: false,
    createProjectTypes: creationTypes,
    onProjectCreate:
      owner && !project
        ? (name) => open({ mode: 'create', id: safeRandomUUID(), name })
        : undefined,
    onProjectChange:
      owner && !project
        ? (projectId) => {
            if (projectId) open({ mode: 'existing', projectId });
          }
        : undefined,
    management: {
      label: t(owner ? 'group.project.manage' : 'group.project.viewMembers'),
      lockedReason: t(project ? 'group.project.locked' : 'group.project.none'),
      onSelect: () => open({ mode: 'manage' }),
    },
  };
  return {
    selector,
    error: error && (
      <p role="alert" className="px-4 py-2 text-sm text-destructive">
        {error}
        <button
          type="button"
          className="ml-2 underline"
          onClick={() => setRetry((value) => value + 1)}
        >
          {t('composer.projects.retry')}
        </button>
      </p>
    ),
    dialog: group && scoped && pending?.groupId === group.id && (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent
          style={getSurfaceThemeStyle(theme)}
          className="gap-[calc(1rem*var(--chat-density-scale,1))] p-[calc(1.5rem*var(--chat-density-scale,1))]"
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('group.project.members')}</DialogTitle>
            <DialogDescription>
              {t(
                pending.intent.mode === 'manage'
                  ? 'group.project.memberHint'
                  : 'group.project.confirmDescription',
              )}
            </DialogDescription>
          </DialogHeader>
          <GroupProjectForm
            key={group.id}
            client={client}
            projectClient={scoped}
            group={group}
            intent={pending.intent}
            onSaved={(project) => {
              setValue({ groupId: group.id, project });
              setPending(null);
              onSaved();
            }}
          />
        </DialogContent>
      </Dialog>
    ),
  };
}
