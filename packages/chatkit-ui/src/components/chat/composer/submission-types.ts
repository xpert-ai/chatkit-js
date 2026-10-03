import type { ChatKitCommandSource } from '@xpert-ai/chatkit-types';
import type { RuntimeCapabilitiesSelection } from '../../../lib/runtime-capabilities';

export type SubmitDraftOptions = {
  inputText?: string;
  displayText?: string;
  commandSource?: ChatKitCommandSource;
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
  planMode?: boolean;
};
