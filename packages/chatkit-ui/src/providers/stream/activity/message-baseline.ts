import type { ThreadActivitySnapshot } from '@xpert-ai/xpert-sdk';
import type { StateType } from '../types';

type Run = ThreadActivitySnapshot['runs'][number] & { messageCount?: number };

/** Missing versions and partially loaded runs must still reconcile from the server. */
export function hasLoadedRunMessages(
  run: Run,
  messages: StateType['messages'],
) {
  if (run.messageCount === undefined) return false;
  const loaded = messages.filter(
    (message) => message.type === 'ai' && message.executionId === run.id,
  );
  if (loaded.length !== run.messageCount) return false;
  if (run.messageCount === 0) return run.messageRevision === '';
  if (!run.messageRevision || loaded.some((message) => !message.updatedAt))
    return false;
  const latest = Math.max(
    ...loaded.map((message) => Date.parse(String(message.updatedAt))),
  );
  return Number.isFinite(latest) && latest === Date.parse(run.messageRevision);
}
