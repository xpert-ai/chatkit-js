import { CHAT_MIN_WIDTH } from './split-resize';

export interface WorkbenchLayout {
  open: boolean;
  expanded: boolean;
  chatWidth: number | null;
}

const DEFAULT_LAYOUT: WorkbenchLayout = {
  open: false,
  expanded: false,
  chatWidth: null,
};

export function workbenchLayoutKey(
  apiUrl: string,
  organizationId: string | undefined,
  assistantId: string,
) {
  if (!assistantId.trim()) return null;
  let service = apiUrl.replace(/\/+$/, '');
  try {
    service = new URL(apiUrl, window.location.href).href.replace(/\/+$/, '');
  } catch {
    // Relative URLs remain usable during server rendering.
  }
  return `chatkit:workbench:layout:v1:${JSON.stringify([service, organizationId ?? '', assistantId])}`;
}

export function readWorkbenchLayout(key: string | null): WorkbenchLayout {
  try {
    const value: unknown = JSON.parse(
      (key && window.localStorage.getItem(key)) || 'null',
    );
    if (
      value &&
      typeof value === 'object' &&
      'open' in value &&
      typeof value.open === 'boolean' &&
      'expanded' in value &&
      typeof value.expanded === 'boolean' &&
      'chatWidth' in value &&
      (value.chatWidth === null ||
        (typeof value.chatWidth === 'number' &&
          Number.isFinite(value.chatWidth) &&
          value.chatWidth >= CHAT_MIN_WIDTH))
    ) {
      return {
        open: value.open,
        expanded: value.open && value.expanded,
        chatWidth: value.chatWidth,
      };
    }
  } catch {
    // Malformed or unavailable storage must not prevent opening chat.
  }
  return { ...DEFAULT_LAYOUT };
}

export function writeWorkbenchLayout(
  key: string | null,
  layout: WorkbenchLayout,
) {
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(layout));
  } catch {
    // Restricted storage still allows in-memory resizing for this session.
  }
}
