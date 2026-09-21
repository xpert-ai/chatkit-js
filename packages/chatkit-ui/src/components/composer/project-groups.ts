import type {
  XpertProject,
  XpertProjectTypeSummary,
} from '@xpert-ai/xpert-sdk';
import { resolveLocalizedText } from '../../i18n/localized-text';

export type ProjectGroup = {
  key: string;
  label: string;
  applicationKey: string | null;
  projectTypeKey: string | null;
  projects: XpertProject[];
};

const typeKey = (
  applicationKey?: string | null,
  projectTypeKey?: string | null,
) => JSON.stringify([applicationKey ?? null, projectTypeKey ?? null]);

export function groupProjects(
  projects: XpertProject[],
  types: XpertProjectTypeSummary[],
  language: string,
  unclassifiedLabel: string,
): ProjectGroup[] {
  const catalog = new Map(
    types.map((type) => [
      typeKey(type.applicationKey, type.projectTypeKey),
      type,
    ]),
  );
  const groups = new Map<string, ProjectGroup>();
  for (const project of projects) {
    const key = typeKey(project.applicationKey, project.projectTypeKey);
    let group = groups.get(key);
    if (!group) {
      // Stable keys keep old display snapshots in the same group after a rename.
      const display = catalog.get(key) ?? project.projectTypeSnapshot;
      const label = project.applicationKey
        ? `${resolveLocalizedText(display?.applicationTitle, language) || project.applicationKey} / ${resolveLocalizedText(display?.title, language) || project.projectTypeKey}`
        : unclassifiedLabel;
      group = {
        key,
        label,
        applicationKey: project.applicationKey ?? null,
        projectTypeKey: project.projectTypeKey ?? null,
        projects: [],
      };
      groups.set(key, group);
    }
    group.projects.push(project);
  }
  return Array.from(groups.values());
}
