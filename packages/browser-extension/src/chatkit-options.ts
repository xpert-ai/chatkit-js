import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

import type { ChatKitExtensionConfig } from './types';
import type { ChatKitDisplayMode } from './types';

type ChatKitOptionsBuildOptions = {
  displayMode?: ChatKitDisplayMode;
  onClientTool?: ChatKitOptions['onClientTool'];
};

export function createChatKitOptions(
  config: ChatKitExtensionConfig,
  options: ChatKitOptionsBuildOptions = {},
): ChatKitOptions {
  const displayMode = options.displayMode ?? config.displayMode;
  const pet: ChatKitOptions['pet'] =
    displayMode === 'pet'
      ? {
          position: {
            scale: config.pet.scale,
            boundsPadding: config.pet.boundsPadding,
          },
        }
      : undefined;
  const api: ChatKitOptions['api'] = {
    apiUrl: config.apiUrl,
    getClientSecret: async () => ({
      secret: config.clientSecret,
    }),
  };

  if (config.xpertId) {
    api.xpertId = config.xpertId;
  }

  return {
    frameUrl: config.frameUrl,
    api,
    locale: config.locale,
    displayMode,
    pet,
    theme: config.theme,
    onClientTool: config.hostAutomation.enabled
      ? options.onClientTool
      : undefined,
  };
}
