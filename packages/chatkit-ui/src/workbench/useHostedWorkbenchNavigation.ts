import * as React from 'react';
import type {
  ChatKitWorkbenchNavigation,
  ChatKitWorkbenchOptions,
} from '@xpert-ai/chatkit-types';
import type {
  XpertExtensionViewManifest,
  XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import { useResourceCardNavigation } from './resource-cards/useResourceCardNavigation';
import { useParentMessenger } from '../hooks/useParentMessenger';

/** The host URL and iframe history must never both own the same navigation. */
export function useHostedWorkbenchNavigation(input: {
  options?: ChatKitWorkbenchOptions;
  projectId: string | null;
  scopeKey: string;
  ready: boolean;
  currentView: ChatKitWorkbenchNavigation['view'];
  canPublish?: boolean;
  restore: (view: NonNullable<ChatKitWorkbenchNavigation['view']>) => boolean;
  close: () => void;
  onError: (error: unknown) => void;
}) {
  const parent = useParentMessenger();
  const callbacks = React.useRef(input);
  callbacks.current = input;
  const applied = React.useRef<string | undefined>(undefined);
  const pending = React.useRef<string | undefined>(undefined);
  const emitted = React.useRef<string | undefined>(undefined);
  const navigation = input.options?.navigation;
  const key = JSON.stringify([input.scopeKey, navigation]);
  const current = JSON.stringify(input.currentView);

  React.useEffect(() => {
    if (!navigation || !input.ready || navigation.projectId !== input.projectId)
      return;
    if (applied.current === key) return;
    applied.current = key;
    pending.current = JSON.stringify(navigation.view);
    emitted.current = undefined;
    if (navigation.view) {
      if (!callbacks.current.restore(navigation.view)) {
        callbacks.current.close();
        // Keep a denied/missing target in the host URL, but allow subsequent
        // explicit user navigation to recover without replaying that target.
        pending.current = JSON.stringify(null);
      }
    } else callbacks.current.close();
  }, [key, navigation, input.ready, input.projectId]);

  React.useEffect(() => {
    if (
      !navigation ||
      !input.ready ||
      navigation.projectId !== input.projectId ||
      applied.current !== key
    )
      return;
    if (pending.current !== undefined) {
      if (pending.current !== current) return;
      pending.current = undefined;
      emitted.current = current;
      return;
    }
    if (input.canPublish === false || emitted.current === current) return;
    emitted.current = current;
    const state: ChatKitWorkbenchNavigation = {
      projectId: input.projectId,
      view: input.currentView,
    };
    const callback = input.options?.onNavigationChange;
    void Promise.resolve()
      .then(() =>
        typeof callback === 'function'
          ? callback(state)
          : parent.isParentAvailable
            ? parent.sendCommand('onWorkbenchNavigationChange', state)
            : undefined,
      )
      .catch((error: unknown) => callbacks.current.onError(error));
  }, [
    current,
    key,
    navigation,
    input.ready,
    input.projectId,
    input.currentView,
    input.canPublish,
    input.options?.onNavigationChange,
    parent,
  ]);
}

export function hostedWorkbenchView(
  viewKey: string | null,
  query: XpertViewQuery | undefined,
): ChatKitWorkbenchNavigation['view'] {
  return viewKey
    ? {
        viewKey,
        ...(query?.selectionId ? { selectionId: query.selectionId } : {}),
        ...(query?.parameters ? { parameters: query.parameters } : {}),
      }
    : null;
}

/** Adapt shell tabs without giving the host ownership of native panels. */
export function useWorkbenchViewNavigation(input: {
  enabled: boolean;
  historyScope: string;
  conversationId?: string | null;
  options?: ChatKitWorkbenchOptions;
  projectId: string | null;
  scopeKey: string;
  ready: boolean;
  open: boolean;
  activeViewKey: string | null;
  views: XpertExtensionViewManifest[];
  queries: Record<string, XpertViewQuery>;
  setQueries: React.Dispatch<
    React.SetStateAction<Record<string, XpertViewQuery>>
  >;
  selectView: (key: string) => void;
  setOpen: (open: boolean) => void;
  onError: (error: unknown) => void;
}) {
  const restore = (view: NonNullable<ChatKitWorkbenchNavigation['view']>) => {
    if (!input.views.some((item) => item.key === view.viewKey)) return false;
    input.setQueries((current) => ({
      ...current,
      [view.viewKey]: {
        ...(view.selectionId ? { selectionId: view.selectionId } : {}),
        ...(view.parameters ? { parameters: view.parameters } : {}),
      },
    }));
    input.selectView(view.viewKey);
    input.setOpen(true);
    return true;
  };
  const close = () => input.setOpen(false);
  const local = useResourceCardNavigation({
    scope: input.historyScope,
    conversationId: input.conversationId,
    enabled: input.enabled && input.options?.navigation === undefined,
    ready: input.ready,
    isConversationScoped: (key) => {
      const workbench = input.views.find((view) => view.key === key)?.workbench;
      return Boolean(
        workbench &&
        'contextScope' in workbench &&
        workbench.contextScope === 'conversation',
      );
    },
    restore: (target) => target.target === 'workbench.view' && restore(target),
    close,
  });
  const navigation = input.options?.navigation;
  const requested = navigation?.view;
  const exact =
    requested && input.views.find((view) => view.key === requested.viewKey);
  const aliases = requested
    ? input.views.filter((view) => view.key.endsWith(`__${requested.viewKey}`))
    : [];
  const resolved = exact ?? (aliases.length === 1 ? aliases[0] : undefined);
  const normalized =
    requested && resolved && navigation
      ? { ...navigation, view: { ...requested, viewKey: resolved.key } }
      : navigation;
  useHostedWorkbenchNavigation({
    ...input,
    options: { ...input.options, navigation: normalized },
    ready: input.enabled && input.ready,
    currentView: hostedWorkbenchView(
      input.open && input.views.some((view) => view.key === input.activeViewKey)
        ? input.activeViewKey
        : null,
      input.activeViewKey ? input.queries[input.activeViewKey] : undefined,
    ),
    restore,
    canPublish:
      !input.open ||
      !input.activeViewKey ||
      input.views.some((view) => view.key === input.activeViewKey),
    close: () => {
      // Host URL state addresses Remote Views, not a file/browser/native tab.
      if (
        !input.activeViewKey ||
        input.views.some((view) => view.key === input.activeViewKey)
      )
        close();
    },
  });
  return local;
}
