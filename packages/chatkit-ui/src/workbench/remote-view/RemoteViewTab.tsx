import * as React from 'react';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { PanelRight } from 'lucide-react';
import { IconDefinitionRenderer } from '../../components/ui/icon-definition';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { EditorLifecycleContext } from '../editors/context';
import { resolveManifestText } from '../manifest-text';
import { WorkbenchTab } from '../WorkbenchTab';

/** Editor metadata is instance-local; the manifest remains the stable view-picker label. */
export function RemoteViewTab({
  view,
  resourceId,
  resourceTitle,
  locale = 'en-US',
  selected,
  onSelect,
  onClose,
}: {
  view: XpertExtensionViewManifest;
  resourceId?: string;
  resourceTitle?: string;
  locale?: string;
  selected: boolean;
  onSelect: () => void;
  onClose?: () => void;
}) {
  const { t } = useChatkitTranslation();
  const editors = React.useContext(EditorLifecycleContext);
  const snapshot = React.useCallback(() => {
    const state = editors?.getTabState(view.key);
    // During navigation the old frame may still be mounted until layout cleanup.
    return resourceId && state?.resourceId === resourceId ? state : undefined;
  }, [editors, view.key, resourceId]);
  const state = React.useSyncExternalStore(
    editors?.subscribe ?? noSubscription,
    snapshot,
    snapshot,
  );
  const label =
    state?.title || resourceTitle ||
    resolveManifestText(
      view.workbench?.menu?.label ?? view.title,
      view.key,
      locale,
    );
  return (
    <WorkbenchTab
      label={label}
      dirty={state?.dirty}
      selected={selected}
      onSelect={onSelect}
      icon={
        <IconDefinitionRenderer
          icon={view.workbench?.menu?.icon ?? view.icon}
          size={16}
          fallback={<PanelRight size={16} />}
        />
      }
      close={
        onClose
          ? { label: `${t('workbench.close')}: ${label}`, onClick: onClose }
          : undefined
      }
    />
  );
}

const noSubscription = () => () => {};
