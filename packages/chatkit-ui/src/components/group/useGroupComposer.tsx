import { useEffect, useMemo, useState } from 'react';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import type {
  ChatGroupComposerInput,
  ChatGroupParticipant,
  Client,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import { useRuntimeCapabilitiesState } from '../chat/runtime-capabilities';
import { getVisibleComposerCapabilities } from '../chat/useComposerCapabilitySelection';
import { useRuntimeResources } from '../chat/useRuntimeResources';
import type { ChatComposerFormProps } from '../chat/composer/ChatComposerForm';
import { getWorkspaceFilePath } from '../composer/WorkspaceFileMentionPalette';
import { WorkspaceFileChip } from '../chat/files/WorkspaceFileChip';
import { ComposerCapabilityChip } from '../composer/ComposerCapabilityChip';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

/** Data adapter only: Chat renders the very same menu and context rail as a private conversation. */
export function useGroupComposer({
  client,
  groupId,
  member,
  options,
  activityKey,
}: {
  client: Client;
  groupId: string;
  member?: ChatGroupParticipant;
  options?: ChatKitOptions | null;
  activityKey: string;
}) {
  const { t } = useChatkitTranslation();
  const participantId = member?.id;
  const assistantId = member?.subjectId;
  const scoped = useMemo(
    () =>
      participantId ? client.forGroupComposer(groupId, participantId) : null,
    [client, groupId, participantId],
  );
  const [scope, setScope] = useState<{
    key: string;
    projectId: string | null;
    locked: boolean;
    busy: boolean;
  } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selection, setSelection] = useState<{
    key: string;
    projectId: string | null;
  } | null>(null);
  const ready = !!participantId && scope?.key === participantId && !failure;
  const projectId = ready
    ? ((selection?.key === participantId && !scope.locked
        ? selection.projectId
        : scope.projectId) ?? undefined)
    : undefined;
  const fileScope = `${participantId ?? ''}:${projectId ?? ''}`;
  const [references, setReferences] = useState<{
    key: string;
    files: NonNullable<ChatGroupComposerInput['files']>;
  }>({ key: '', files: [] });
  const files = references.key === fileScope ? references.files : [];
  useEffect(() => {
    const abort = new AbortController();
    setFailure(null);
    if (!participantId) {
      setScope(null);
      setSelection(null);
      setReferences({ key: '', files: [] });
      return;
    }
    void client.groups
      .composerContext(groupId, participantId, { signal: abort.signal })
      .then((context) => {
        if (!abort.signal.aborted) setScope({ key: participantId, ...context });
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted)
          setFailure(error instanceof Error ? error.message : String(error));
      });
    return () => abort.abort();
  }, [client, groupId, participantId, reload, activityKey]);
  useEffect(() => {
    setSelection(null);
    setReferences({ key: '', files: [] });
  }, [participantId]);
  const capabilities = useRuntimeCapabilitiesState({
    client: scoped,
    assistantId,
    projectId,
    threadId: undefined,
    disabled: !ready,
  });
  const resources = useRuntimeResources({
    client: scoped,
    enabled: !!participantId,
    isReady: ready,
    assistantId,
    projectId,
  });
  const selectedCapabilities = getVisibleComposerCapabilities(
    capabilities.effectiveSessionRuntimeCapabilities,
    capabilities.runtimeCapabilityOptions,
  );
  const removeCapability = (
    type: Parameters<
      typeof capabilities.handleSessionRuntimeCapabilityToggle
    >[0],
    id: string,
  ) => capabilities.handleSessionRuntimeCapabilityToggle(type, id, false);
  const blocked =
    !!participantId && (!ready || resources.busy || !resources.ready);
  const input: ChatGroupComposerInput | undefined =
    participantId && ready
      ? {
          participantId,
          ...(projectId ? { projectId } : {}),
          ...(files.length ? { files } : {}),
          runtimeResources: resources.selection,
          ...(capabilities.effectiveSessionRuntimeCapabilities
            ? {
                runtimeCapabilities:
                  capabilities.effectiveSessionRuntimeCapabilities,
              }
            : {}),
        }
      : undefined;
  const disabled = !ready;
  const controls: Pick<ChatComposerFormProps, 'menu' | 'context'> = {
    menu: {
      composer: {
        ...options?.composer,
        attachments: { enabled: false },
        tools: [],
      },
      runtimeCapabilities: capabilities.runtimeCapabilitiesReady
        ? capabilities.runtimeCapabilities
        : null,
      selectedRuntimeCapabilities:
        capabilities.effectiveSessionRuntimeCapabilities,
      onRuntimeCapabilityToggle:
        capabilities.handleSessionRuntimeCapabilityToggle,
      unifiedResourcesEnabled: true,
      connectorsEnabled: false,
      disabled,
    },
    context: {
      project: {
        client: scoped,
        xpertId: assistantId,
        activeProjectId: projectId,
        ready,
        allowNone: true,
        locked: !!scope && scope.key === participantId && scope.locked,
        disabled,
        autoNewEnabled: false,
        onProjectChange: (id) => {
          if (participantId) {
            setSelection({ key: participantId, projectId: id });
            setReferences({ key: '', files: [] });
          }
        },
      },
      files: {
        client: scoped,
        assistantId: assistantId ?? null,
        projectId: projectId ?? null,
        disabled,
        selectedFilePaths: new Set(files.map((file) => file.workspacePath)),
        onSelect: (file: XpertWorkspaceFile) => {
          const path = getWorkspaceFilePath(file);
          setReferences({
            key: fileScope,
            files: [
              ...files.filter((entry) => entry.workspacePath !== path),
              {
                filePath: path,
                workspacePath: path,
                originalName: file.filePath,
                mimeType: file.mimeType,
                size: file.size,
                purpose: 'workspace',
              },
            ],
          });
        },
      },
      resources:
        scoped && assistantId
          ? {
              key: fileScope,
              client: scoped,
              assistantId,
              projectId,
              connectorsEnabled: false,
              selection: resources.selection,
              busy: resources.busy,
              canEditResources: resources.canEdit,
              error: resources.error,
              disabled,
              onToggle: resources.toggle,
              onRefresh: resources.refresh,
            }
          : undefined,
    },
  };
  return {
    controls,
    input,
    blocked,
    attachments: (
      <>
        {failure && (
          <p role="alert" className="mb-2 text-xs text-destructive">
            {failure}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setReload((value) => value + 1)}
            >
              {t('common.retry')}
            </button>
          </p>
        )}
        {files.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {files.map((file) => (
              <WorkspaceFileChip
                key={file.workspacePath}
                file={file}
                removeLabel={t('composer.fileMentions.remove')}
                onRemove={() =>
                  setReferences({
                    key: fileScope,
                    files: files.filter(
                      (entry) => entry.workspacePath !== file.workspacePath,
                    ),
                  })
                }
              />
            ))}
          </div>
        )}
      </>
    ),
    hasInline: selectedCapabilities.length > 0,
    inline: selectedCapabilities.map((option) => (
      <ComposerCapabilityChip
        key={`${option.type}:${option.id}`}
        option={option}
        onRemove={(option) => removeCapability(option.type, option.id)}
        disabled={disabled}
      />
    )),
    afterSend: () => {
      setReferences({ key: '', files: [] });
      setReload((value) => value + 1);
    },
  };
}
