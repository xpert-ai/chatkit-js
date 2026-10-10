import type { ComponentProps } from 'react';
import { ProjectSelector } from '../../composer/ProjectSelector';
import { WorkspaceFileSelector } from '../../composer/WorkspaceFileSelector';
import { RuntimeResourceSelector } from '../../composer/RuntimeResourceSelector';

export type ComposerContextProps = {
  project?: ComponentProps<typeof ProjectSelector>;
  files?: ComponentProps<typeof WorkspaceFileSelector>;
  resources?: ComponentProps<typeof RuntimeResourceSelector> & { key?: string };
};

/** One context toolbar for every conversation kind. */
export function ComposerContextRail({
  project,
  files,
  resources,
}: ComposerContextProps) {
  return (
    <div
      data-slot="composer-context-rail"
      className="flex min-w-0 flex-wrap items-center"
    >
      <div className="min-w-0 max-w-full">
        {project && <ProjectSelector {...project} />}
      </div>
      {files && <WorkspaceFileSelector {...files} />}
      {resources && <RuntimeResourceSelector {...resources} />}
    </div>
  );
}
