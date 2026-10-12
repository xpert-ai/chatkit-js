import { Loader2 } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../ui/button';
import {
  useGroupProjectForm,
  type GroupProjectFormOptions,
} from './useGroupProjectForm';

/** Selection/creation belongs to the shared Project menu; this step only confirms participation. */
export function GroupProjectForm(props: GroupProjectFormOptions) {
  const { t } = useChatkitTranslation();
  const { intent } = props;
  const {
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
    retry,
    selectMember,
  } = useGroupProjectForm(props);
  if (loading)
    return (
      <p role="status">
        <Loader2 className="size-4 animate-spin" />
        {t('composer.projects.loading')}
      </p>
    );
  if (!ready)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
        <Button type="button" variant="ghost" onClick={retry}>
          {t('composer.projects.retry')}
        </Button>
      </p>
    );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="grid gap-[calc(1rem*var(--chat-density-scale,1))]"
    >
      <p className="font-medium">{projectName || t('group.project.none')}</p>
      <fieldset
        disabled={!owner || saving}
        className="grid gap-[calc(.5rem*var(--chat-density-scale,1))]"
      >
        <legend className="mb-2 text-sm font-medium">
          {t('group.project.members')}
        </legend>
        {members.map((member) => (
          <label
            key={member.id}
            className="flex items-center gap-2 rounded-chat-item border border-border p-[calc(.75rem*var(--chat-density-scale,1))] text-sm"
          >
            <input
              type="checkbox"
              className="accent-primary"
              checked={selected.includes(member.id)}
              disabled={
                member.id === primary?.id ||
                project?.participantIds.includes(member.id)
              }
              onChange={(event) =>
                selectMember(member.id, event.target.checked)
              }
            />
            {member.name}
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {owner && (project || intent.mode !== 'manage') && (
        <Button type="submit" disabled={saving || !selected.length || !changed}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t(project ? 'group.project.bind' : 'group.project.enable')}
        </Button>
      )}
    </form>
  );
}
