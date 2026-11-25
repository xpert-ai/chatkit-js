import type {
  NativeTool,
  useNativeWorkbench,
} from '../native/useNativeWorkbench';
import type { useWorkbenchSideChat } from './side-chat/useWorkbenchSideChat';
import { sideChatViewKey } from '../side-chat/types';

export function openNativeTool(options: {
  native: ReturnType<typeof useNativeWorkbench>;
  askInSideChat: ReturnType<typeof useWorkbenchSideChat>['askInSideChat'];
  replaceNewTab: (from: string | undefined, to: string) => void;
  setActiveViewKey: (key: string) => void;
  setOpen: (open: boolean) => void;
  onError: (error: unknown) => void;
}) {
  return (tool: NativeTool, fromTab?: string) => {
    if (tool === 'side-chat') {
      void options
        .askInSideChat(undefined, (id) =>
          options.replaceNewTab(fromTab, sideChatViewKey(id)),
        )
        .catch(options.onError);
    } else {
      const key = options.native.openTool(tool);
      options.replaceNewTab(fromTab, key);
      options.setActiveViewKey(key);
      options.setOpen(true);
    }
  };
}
