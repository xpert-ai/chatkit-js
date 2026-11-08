import { MAIN_CHAT_VIEW_KEY } from '../WorkbenchPanel';
import { SIDE_CHAT_VIEW_KEY } from '../side-chat/types';
import { EXTERNAL_ASSISTANTS_VIEW_KEY } from '../external-assistant/external-assistant-runs';
import { NATIVE_PREFIX } from '../native/useNativeWorkbench';

export const isNativeView = (key: string | null) =>
  key === MAIN_CHAT_VIEW_KEY ||
  key === SIDE_CHAT_VIEW_KEY ||
  key === EXTERNAL_ASSISTANTS_VIEW_KEY ||
  Boolean(key?.startsWith(NATIVE_PREFIX));
