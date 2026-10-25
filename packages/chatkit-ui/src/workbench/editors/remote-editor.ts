import type { EditorLifecycle } from './editor-lifecycle';

/** The frame bridge must validate window, instance and revision before calling this adapter. */
export class RemoteEditor {
  private pending = new Map<string, (ready: boolean) => void>();
  private disposed = false;
  constructor(
    private readonly editors: EditorLifecycle,
    private readonly instanceId: string,
    private readonly tabKey: string,
    readonly resourceId: string,
    private readonly send: (payload: object) => void,
  ) {
    this.status(resourceId, false);
  }
  status(resourceId: string, dirty: boolean, title?: string) {
    if (this.disposed || resourceId !== this.resourceId) return false;
    this.editors.register(this.instanceId, {
      tabKey: this.tabKey,
      resourceId,
      title: title?.trim() || undefined,
      dirty,
      prepare: () => this.prepare(),
      reveal: (blockId) =>
        this.send({ kind: 'revealAnchor', resourceId, blockId }),
    });
    return true;
  }
  acknowledge(requestId: string, ready: boolean) {
    this.pending.get(requestId)?.(ready && !this.editors.isDirty(this.tabKey));
  }
  private prepare(): Promise<boolean> {
    return new Promise((resolve) => {
      const requestId = crypto.randomUUID();
      const finish = (ready: boolean) => {
        clearTimeout(timer);
        this.pending.delete(requestId);
        resolve(ready);
      };
      const timer = setTimeout(() => finish(false), 10_000);
      this.pending.set(requestId, finish);
      try {
        this.send({
          kind: 'prepareClose',
          requestId,
          resourceId: this.resourceId,
        });
      } catch {
        finish(false);
      }
    });
  }
  dispose() {
    this.disposed = true;
    for (const finish of this.pending.values()) finish(false);
    this.editors.register(this.instanceId, null);
  }
}
