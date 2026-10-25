import * as React from 'react';
import { EditorLifecycle } from './editor-lifecycle';

export const EditorLifecycleContext =
  React.createContext<EditorLifecycle | null>(null);
export function useEditorLifecycle() {
  const [editors] = React.useState(() => new EditorLifecycle());
  React.useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (editors.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [editors]);
  return editors;
}
