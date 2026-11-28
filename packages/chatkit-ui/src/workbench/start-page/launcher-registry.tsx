import type { ReactNode } from 'react';
import {
  Folder,
  Terminal,
  MessagesSquare,
  Layers,
  Loader2,
} from 'lucide-react';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { IconDefinitionRenderer } from '../../components/ui/icon-definition';
import { resolveManifestText } from '../manifest-text';
import type { NativeTool } from '../native/useNativeWorkbench';
import {
  terminalRestrictionMessage,
  type TerminalRestriction,
} from '../native/terminal/terminal-restriction';
import type { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export type LauncherAction = {
  id: string;
  title: string;
  description?: string;
  icon: ReactNode;
  disabled?: boolean;
  reason?: string;
  opened?: boolean;
  run: () => void;
};
export function launcherActions(options: {
  views: XpertExtensionViewManifest[];
  openedViewKeys: string[];
  locale: string;
  conversationReady: boolean;
  sideChatEnabled: boolean;
  sideChatOpening?: boolean;
  terminalUnavailable?: TerminalRestriction | null;
  onOpenTool?: (tool: NativeTool) => void;
  onSelectView: (key: string) => void;
  t: ReturnType<typeof useChatkitTranslation>['t'];
}): LauncherAction[] {
  const { t } = options;
  return [
    ...(options.sideChatEnabled
      ? [
          {
            id: 'tool:side-chat',
            title: t('workbench.start.sideChat'),
            icon: options.sideChatOpening ? (
              <Loader2 size={21} className="animate-spin" />
            ) : (
              <MessagesSquare size={21} />
            ),
            disabled:
              options.sideChatOpening ||
              !options.conversationReady ||
              !options.onOpenTool,
            reason: !options.conversationReady
              ? t('workbench.start.conversationRequired')
              : undefined,
            run: () => options.onOpenTool?.('side-chat'),
          },
        ]
      : []),
    {
      id: 'tool:files',
      title: t('workbench.start.files'),
      icon: <Folder size={21} />,
      disabled: !options.onOpenTool,
      run: () => options.onOpenTool?.('files'),
    },
    {
      id: 'tool:terminal',
      title: t('workbench.start.terminal'),
      icon: <Terminal size={21} />,
      disabled:
        !options.conversationReady ||
        !!options.terminalUnavailable ||
        !options.onOpenTool,
      reason: options.terminalUnavailable
        ? t(terminalRestrictionMessage[options.terminalUnavailable])
        : !options.conversationReady
          ? t('workbench.start.conversationRequired')
          : undefined,
      run: () => options.onOpenTool?.('terminal'),
    },
    ...options.views.map((view) => ({
      id: `view:${view.key}`,
      title: resolveManifestText(
        view.workbench?.menu?.label ?? view.title,
        view.key,
        options.locale,
      ),
      description: resolveManifestText(view.description, '', options.locale),
      icon: (
        <IconDefinitionRenderer
          icon={view.workbench?.menu?.icon ?? view.icon}
          size={21}
          fallback={<Layers size={21} />}
        />
      ),
      opened: options.openedViewKeys.includes(view.key),
      run: () => options.onSelectView(view.key),
    })),
  ];
}
