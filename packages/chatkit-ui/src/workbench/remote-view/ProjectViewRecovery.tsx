import * as React from 'react';
import { z } from 'zod';
import type { Client, XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { ProjectSelector } from '../../components/composer/ProjectSelector';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

// Read the shared workbench.projectType contract at the network boundary, including
// manifests supplied by newer hosts when the installed SDK predates this optional hint.
const projectRequirement = z.object({
  projectType: z.object({
    applicationKey: z.string().min(1),
    projectTypeKey: z.string().min(1),
  }),
});
export function viewProjectType(manifest: XpertExtensionViewManifest) {
  const parsed = projectRequirement.safeParse(manifest.workbench);
  return parsed.success ? parsed.data.projectType : undefined;
}

export function ProjectViewRecovery({
  client,
  hostId,
  manifest,
  denied,
  createEnabled = true,
  onSelect,
  onRetry,
}: {
  client: Client | null;
  hostId: string;
  manifest?: XpertExtensionViewManifest;
  denied: boolean;
  createEnabled?: boolean;
  onSelect: (projectId: string) => Promise<unknown>;
  onRetry: () => void;
}) {
  const { t } = useChatkitTranslation();
  const [switching, setSwitching] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const active = React.useRef(true);
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p
        role={denied ? 'alert' : 'status'}
        className={
          denied ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
        }
      >
        {t(
          denied
            ? 'workbench.projectRecovery.unavailable'
            : 'workbench.projectRecovery.required',
        )}
      </p>
      <p className="text-sm text-muted-foreground">
        {t('workbench.projectRecovery.description')}
      </p>
      <ProjectSelector
        client={client}
        xpertId={hostId}
        projectType={manifest ? viewProjectType(manifest) : undefined}
        allowNone={false}
        disabled={switching}
        createEnabled={createEnabled}
        onProjectChange={(projectId) => {
          if (!projectId || switching) return;
          setSwitching(true);
          setFailed(false);
          void onSelect(projectId)
            .then((result) => {
              if (
                !z.object({ success: z.literal(true) }).safeParse(result)
                  .success &&
                active.current
              )
                setFailed(true);
            })
            .catch(() => {
              if (active.current) setFailed(true);
            })
            .finally(() => {
              if (active.current) setSwitching(false);
            });
        }}
      />
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('workbench.projectRecovery.switchFailed')}
        </p>
      )}
      {denied && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-chat-item border border-border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          {t('workbench.retry')}
        </button>
      )}
    </div>
  );
}
