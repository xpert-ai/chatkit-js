/** Explicit user intent for the next conversation; absence retains legacy host behavior. */
export type ProjectSelection =
  | { mode: 'auto-new' }
  | { mode: 'none' }
  | { mode: 'existing'; projectId: string };
