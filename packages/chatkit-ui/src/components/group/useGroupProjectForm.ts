import { useEffect, useRef, useState } from 'react';
import type {
  ChatGroupProject,
  ChatGroupProjectInput,
  ChatGroupSnapshot,
  Client,
} from '@xpert-ai/xpert-sdk';

export type GroupProjectIntent =
  | ChatGroupProjectInput['project']
  | { mode: 'manage' };

export type GroupProjectFormOptions = {
  client: Pick<Client, 'groups'>;
  projectClient: Pick<Client, 'projects'>;
  group: ChatGroupSnapshot;
  intent: GroupProjectIntent;
  onSaved: (project: ChatGroupProject) => void;
};

/** Group mutations use group credentials; Project metadata uses the primary member's Composer scope. */
export function useGroupProjectForm({
  client,
  projectClient,
  group,
  intent,
  onSaved,
}: GroupProjectFormOptions) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const owner =
    group.members.find((member) => member.id === group.viewerParticipantId)
      ?.role === 'owner';
  const members = group.members.filter(
    (member) => member.active && member.kind === 'assistant',
  );
  const primary = members.find((member) => member.subjectId === group.xpertId);
  // Defaults belong to this form opening; live group updates must not reset pending edits.
  const initialParticipantIds = useRef(
    owner ? members.map((member) => member.id) : [],
  );
  const [project, setProject] = useState<ChatGroupProject | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setReady(false);
    setError(null);
    void (async () => {
      const bound = await client.groups.project(group.id, {
        signal: abort.signal,
      });
      const name =
        bound?.name ??
        (intent.mode === 'create'
          ? intent.name
          : intent.mode === 'existing'
            ? (
                await projectClient.projects.get(intent.projectId, {
                  signal: abort.signal,
                })
              ).name
            : '');
      if (abort.signal.aborted) return;
      setProject(bound);
      setProjectName(name);
      setSelected(bound?.participantIds ?? initialParticipantIds.current);
      setReady(true);
    })()
      .catch((reason: unknown) => {
        if (!abort.signal.aborted)
          setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [client, projectClient, group.id, intent, retry]);
  const changed =
    !project || selected.some((id) => !project.participantIds.includes(id));
  async function save() {
    if (saving || loading || !ready || !owner || !selected.length || !changed)
      return;
    const requestProject = project
      ? { mode: 'existing' as const, projectId: project.projectId }
      : intent.mode === 'manage'
        ? null
        : intent;
    if (!requestProject) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await client.groups.setProject(group.id, {
        project: requestProject,
        participantIds: selected,
      });
      if (mounted.current) onSaved(saved);
    } catch (reason) {
      if (mounted.current)
        setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  return {
    owner,
    members,
    primary,
    project,
    projectName,
    loading,
    ready,
    saving,
    error,
    selected,
    changed,
    save,
    retry: () => setRetry((value) => value + 1),
    selectMember: (id: string, checked: boolean) =>
      setSelected((previous) =>
        checked
          ? [...new Set([...previous, id])]
          : previous.filter((value) => value !== id),
      ),
  };
}
