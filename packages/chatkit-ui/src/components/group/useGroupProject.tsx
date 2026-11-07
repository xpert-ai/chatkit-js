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
import {
  ProjectSelector,
  type ProjectSelectorProps,
} from '../composer/ProjectSelector';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { GroupProjectForm } from './GroupProject';
import type { GroupProjectIntent } from './useGroupProjectForm';

/** Group scope replaces per-recipient Project selection; nothing changes until confirmation succeeds. */
export function useGroupProject({
  client,
  group,
  onSaved,
  onCancel,
}: {
  client: Client;
  group: ChatGroupSnapshot | null;
  onSaved: (project: ChatGroupProject, resumeSend: boolean) => void;
  onCancel?: () => void;
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
  const [reuseGroupId, setReuseGroupId] = useState<string | null>(null);
  const [required, setRequired] = useState<{
    groupId: string;
    participantIds: string[];
  } | null>(null);
  const [pending, setPending] = useState<{
    groupId: string;
    intent: GroupProjectIntent;
  } | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const project = value && value.groupId === groupId ? value.project : null;
  const ready = !!groupId && value?.groupId === groupId && !error;
  const requirement = required?.groupId === groupId ? required : null;
  const selection = pending?.groupId === groupId ? pending : null;
  const reusing = !!groupId && reuseGroupId === groupId;
  function close() {
    setPending(null);
    setRequired(null);
    setReuseGroupId(null);
  }
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
    setReuseGroupId(null);
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
    groupProjectUsage: 'independent',
    discoveryAction:
      owner && !project
        ? {
            label: t('group.project.reuse'),
            onSelect: () => {
              if (groupId) {
                setPending(null);
                setReuseGroupId(groupId);
              }
            },
          }
        : undefined,
    onProjectCreate:
      owner && !project
        ? (name, projectType) =>
            open({
              mode: 'create',
              id: safeRandomUUID(),
              name,
              ...(projectType
                ? {
                    projectType: {
                      applicationKey: projectType.applicationKey,
                      projectTypeKey: projectType.projectTypeKey,
                    },
                  }
                : {}),
            })
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
    request: (participantIds: string[]) => {
      if (!groupId) return;
      setPending(null);
      setReuseGroupId(null);
      setRequired({ groupId, participantIds });
      setRetry((value) => value + 1);
    },
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
    dialog: group && scoped && (selection || requirement || reusing) && (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) {
            close();
            onCancel?.();
          }
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
            <DialogTitle>
              {t(
                reusing
                  ? 'group.project.reuse'
                  : selection
                    ? 'group.project.members'
                    : 'group.project.requiredTitle',
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                reusing
                  ? 'group.project.reuseDescription'
                  : !selection
                    ? 'group.project.requiredDescription'
                    : selection.intent.mode === 'manage'
                      ? 'group.project.memberHint'
                      : 'group.project.confirmDescription',
              )}
            </DialogDescription>
          </DialogHeader>
          {reusing ? (
            <ProjectSelector
              {...selector}
              modal
              triggerRef={undefined}
              groupProjectUsage="reuse"
              discoveryAction={undefined}
              onProjectCreate={undefined}
              onProjectChange={(projectId) => {
                if (projectId)
                  open({ mode: 'existing', projectId, reuse: true });
              }}
            />
          ) : selection ? (
            <GroupProjectForm
              key={group.id}
              client={client}
              projectClient={scoped}
              group={group}
              intent={selection.intent}
              requiredParticipantIds={requirement?.participantIds}
              onSaved={(project) => {
                setValue({ groupId: group.id, project });
                close();
                onSaved(project, !!requirement);
              }}
            />
          ) : (
            <>
              <p className="text-sm font-medium">
                {group.members
                  .filter((member) =>
                    requirement?.participantIds.includes(member.id),
                  )
                  .map((member) => member.name)
                  .join('、')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(
                  owner
                    ? project
                      ? 'group.project.requiredParticipants'
                      : 'group.project.requiredOwner'
                    : 'group.project.requiredMember',
                )}
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    {t('composer.projects.retry')}
                  </Button>
                </p>
              )}
              {owner &&
                (project ? (
                  <Button
                    type="button"
                    onClick={() => open({ mode: 'manage' })}
                  >
                    {t('group.project.manage')}
                  </Button>
                ) : (
                  <ProjectSelector {...selector} modal triggerRef={undefined} />
                ))}
            </>
          )}
        </DialogContent>
      </Dialog>
    ),
  };
}
