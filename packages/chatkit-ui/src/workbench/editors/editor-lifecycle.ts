export type EditorHandle = Readonly<{
  tabKey: string;
  resourceId?: string;
  /** Resource display name supplied by its editor, never a translated view/type label. */
  title?: string;
  dirty: boolean;
  prepare: () => Promise<boolean>;
  reveal?: (blockId: string) => void;
}>;

export type EditorTabState = Readonly<
  Pick<EditorHandle, 'resourceId' | 'title' | 'dirty'>
>;

/** One coordinator per Workbench. Native and remote editors share the same leave gate. */
export class EditorLifecycle {
  private readonly editors = new Map<string, EditorHandle>();
  private readonly listeners = new Set<() => void>();
  private dirtyTabs: readonly string[] = Object.freeze([]);
  private tabs = new Map<string, EditorTabState>();

  // Internal observation only. Host navigation must await prepareLeave(), never a dirty snapshot.
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getDirtyTabs = (): readonly string[] => this.dirtyTabs;
  getTabState = (tabKey: string): EditorTabState | undefined =>
    this.tabs.get(tabKey);

  register(key: string, handle: EditorHandle | null) {
    if (handle) this.editors.set(key, handle);
    else this.editors.delete(key);
    // Presentation is a derived snapshot of the same handles used for saving.
    // Keep unchanged entries stable for useSyncExternalStore and remove metadata on disposal.
    const tabs = new Map<string, EditorTabState>();
    for (const editor of this.editors.values()) {
      const previous = tabs.get(editor.tabKey);
      tabs.set(editor.tabKey, {
        resourceId: editor.resourceId,
        title: editor.title,
        dirty: editor.dirty || previous?.dirty === true,
      });
    }
    let changed = tabs.size !== this.tabs.size;
    for (const [tabKey, value] of tabs) {
      const previous = this.tabs.get(tabKey);
      if (
        previous &&
        previous.resourceId === value.resourceId &&
        previous.title === value.title &&
        previous.dirty === value.dirty
      ) {
        tabs.set(tabKey, previous);
      } else {
        tabs.set(tabKey, Object.freeze(value));
        changed = true;
      }
    }
    this.tabs = tabs;
    const next = [
      ...new Set(
        [...this.editors.values()]
          .filter((editor) => editor.dirty)
          .map((editor) => editor.tabKey),
      ),
    ].sort();
    if (
      !(
        next.length === this.dirtyTabs.length &&
        next.every((key, i) => key === this.dirtyTabs[i])
      )
    ) {
      this.dirtyTabs = Object.freeze(next);
      changed = true;
    }
    if (changed) this.listeners.forEach((listener) => listener());
  }
  get dirty() {
    return this.isDirty();
  }
  isDirty(tabKey?: string) {
    return tabKey ? this.dirtyTabs.includes(tabKey) : this.dirtyTabs.length > 0;
  }
  async prepare(tabKey?: string): Promise<boolean> {
    const pending = [...this.editors].filter(
      ([, editor]) => editor.dirty && (!tabKey || editor.tabKey === tabKey),
    );
    const results = await Promise.all(
      pending.map(async ([key, editor]) => {
        try {
          if (!(await editor.prepare())) return false;
          // Let a native editor's successful save render its latest dirty state.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          const current = this.editors.get(key);
          return Boolean(current && !current.dirty);
        } catch {
          return false;
        }
      }),
    );
    // Saving can race with new edits; a completed save alone is not a leave permission.
    return results.every(Boolean) && !this.isDirty(tabKey);
  }
  reveal(resourceId: string, blockId: string) {
    for (const editor of this.editors.values())
      if (editor.resourceId === resourceId) editor.reveal?.(blockId);
  }
}
