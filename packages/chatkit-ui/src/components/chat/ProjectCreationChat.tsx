import * as React from 'react';
import type {
  XpertProjectEntry,
  XpertProjectTypeRef,
} from '@xpert-ai/xpert-sdk';
import { Chat } from '../chat';
import type { ChatProps } from './types';
import { useStreamContext } from '../../providers/Stream';
import { useWorkbench } from '../../workbench/context';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export type ProjectCreationEntry = Extract<
  XpertProjectEntry,
  { kind: 'assistant' }
>;

/** Application creation belongs to the embedded Workbench, not host URL routing. */
export function ProjectCreationChat({
  creationEnabled,
  onProjectEntry,
  ...props
}: ChatProps & {
  creationEnabled: boolean;
  onProjectEntry: (entry: ProjectCreationEntry) => void;
}) {
  const stream = useStreamContext();
  const workbench = useWorkbench();
  const { t } = useChatkitTranslation();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const request = React.useRef<AbortController | null>(null);
  const scope = React.useMemo(
    () => ({}),
    [
      stream.client,
      stream.assistantId,
      stream.organizationId,
      stream.projectId,
      stream.threadId,
    ],
  );
  const currentScope = React.useRef(scope);
  currentScope.current = scope;
  React.useEffect(() => {
    setError(null);
    setPending(false);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [scope]);

  const createEntry = async (projectType: XpertProjectTypeRef) => {
    if (!creationEnabled || request.current) return;
    if (!workbench.enabled) {
      setError(t('composer.projects.creationViewUnavailable'));
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    try {
      const entry = await stream.client.projects.typeEntry(projectType, {
        xpertId: stream.assistantId,
        signal: controller.signal,
      });
      if (controller.signal.aborted || currentScope.current !== scope) return;
      // The current credential cannot authorize a different Assistant runtime.
      if (
        entry.kind !== 'assistant' ||
        entry.xpertId !== stream.assistantId ||
        entry.projectId
      ) {
        throw new Error(t('composer.projects.creationViewUnavailable'));
      }
      onProjectEntry(entry);
    } catch (cause) {
      if (!controller.signal.aborted && currentScope.current === scope)
        setError(
          cause instanceof Error
            ? cause.message
            : t('composer.projects.creationFailed'),
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" aria-busy={pending}>
      {error && (
        <p role="alert" className="shrink-0 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Chat
        {...props}
        onProjectTypeCreate={creationEnabled ? createEntry : undefined}
      />
    </div>
  );
}
