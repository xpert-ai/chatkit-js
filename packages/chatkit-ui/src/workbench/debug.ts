type DebugData = Record<string, string | number | boolean | null | undefined>;

export function isWorkbenchDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    const override = window.localStorage.getItem(
      'xpert.debug.chatkit-workbench',
    );
    if (override === '0') return false;
    if (override === '1') return true;
  } catch {
    // Storage can be unavailable in embedded contexts.
  }
  return (
    new URLSearchParams(window.location.search).get('xpertDebug') ===
    'chatkit-workbench'
  );
}

function redact(data?: DebugData): DebugData | undefined {
  if (!data) return undefined;
  return Object.fromEntries(
    Object.entries(data).filter(
      ([key]) =>
        !/token|secret|authorization|tenant|organization|html|buffer/i.test(
          key,
        ),
    ),
  );
}

export const workbenchDebug = {
  debug(event: string, data?: DebugData) {
    if (isWorkbenchDebugEnabled()) {
      console.debug('[chatkit-workbench]', event, redact(data));
    }
  },
  warn(event: string, data?: DebugData) {
    console.warn('[chatkit-workbench]', event, redact(data));
  },
  error(event: string, data?: DebugData) {
    console.error('[chatkit-workbench]', event, redact(data));
  },
};
