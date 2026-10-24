import * as React from 'react';
import type { EditorLifecycle } from '../editors/editor-lifecycle';

/** Keep reload persistence and transient feedback owned by the mounted Workbench. */
export function useWorkbenchFeedback(
  editors: EditorLifecycle,
  setReloadVersion: React.Dispatch<React.SetStateAction<number>>,
  unsavedMessage: string,
) {
  const [notification, setNotification] = React.useState<{
    level: 'success' | 'error';
    message: string;
  } | null>(null);
  const reload = () => {
    if (!editors.dirty) return setReloadVersion((version) => version + 1);
    void editors.prepare().then((ready) => {
      if (ready) setReloadVersion((version) => version + 1);
      else setNotification({ level: 'error', message: unsavedMessage });
    });
  };
  const notify = (level: 'success' | 'error', message: string) => {
    setNotification({ level, message });
    window.setTimeout(() => {
      setNotification((current) =>
        current?.message === message ? null : current,
      );
    }, 4000);
  };
  return { notification, setNotification, reload, notify };
}
