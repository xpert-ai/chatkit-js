import { contentTabKey, contentViewKey } from './content/tab-identity';
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
import type { EditorLifecycle } from './editors/editor-lifecycle';

/** The host URL and iframe history must never both own the same navigation. */
export function useHostedWorkbenchNavigation(input: {
  options?: ChatKitWorkbenchOptions;
  projectId: string | null;
  scopeKey: string;
  ready: boolean;
  currentView: ChatKitWorkbenchNavigation['view'];
  canPublish?: boolean;
  restore: (
    view: NonNullable<ChatKitWorkbenchNavigation['view']>,
  ) => boolean | Promise<boolean>;
  close: () => void | Promise<void>;
  onError: (error: unknown) => void;
}) {
  const parent = useParentMessenger();
  const [replayRevision, retryPublication] = React.useReducer(
    (value: number) => value + 1,
    0,
  );
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
    const isCurrent = () =>
      key ===
      JSON.stringify([
        callbacks.current.scopeKey,
        callbacks.current.options?.navigation,
      ]);
    const failed = (error: unknown) => {
      if (!isCurrent()) return;
      // A blocked leave keeps the current editor and restores its address in the host.
      pending.current = undefined;
      emitted.current = undefined;
      callbacks.current.onError(error);
      retryPublication();
    };
    const complete = (restored: boolean | void) => {
      if (!isCurrent() || restored !== false) return;
      pending.current = JSON.stringify(null);
      void Promise.resolve(callbacks.current.close()).catch(failed);
    };
    try {
      const result = navigation.view
        ? callbacks.current.restore(navigation.view)
        : callbacks.current.close();
      if (result instanceof Promise) void result.then(complete).catch(failed);
      else complete(result);
    } catch (error) {
      failed(error);
    }
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
    replayRevision,
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
  editors?: EditorLifecycle;
  unsavedMessage?: string;
  enabled: boolean;
  historyScope: string;
  conversationId?: string | null;
  options?: ChatKitWorkbenchOptions;
  projectId: string | null;
  scopeKey: string;
  ready: boolean;
  open: boolean;
  expanded: boolean;
  activeViewKey: string | null;
  views: XpertExtensionViewManifest[];
  queries: Record<string, XpertViewQuery>;
  setQueries: React.Dispatch<
    React.SetStateAction<Record<string, XpertViewQuery>>
  >;
  selectView: (key: string) => void;
  setOpen: (open: boolean) => void;
  setExpanded: (expanded: boolean) => void;
  onError: (error: unknown) => void;
}) {
  const latest = React.useRef(input);
  latest.current = input;
  const attempt = React.useRef(0);
  // Both host URL replay and local history use the editor's flush gate before replacing a document.
  const navigate = (
    viewKey: string | undefined,
    action: () => void,
    replacing = true,
  ) => {
    const ticket = ++attempt.current;
    const perform = () => {
      if (
        ticket !== attempt.current ||
        latest.current.scopeKey !== input.scopeKey
      )
        return;
      action();
    };
    const dirty =
      replacing &&
      (viewKey ? input.editors?.isDirty(viewKey) : input.editors?.dirty);
    if (!dirty || !input.editors) {
      perform();
      return;
    }
    return input.editors.prepare(viewKey).then((ready) => {
      if (
        ticket !== attempt.current ||
        latest.current.scopeKey !== input.scopeKey
      )
        return;
      if (!ready) throw new Error(input.unsavedMessage);
      perform();
    });
  };
  const restore = (view: NonNullable<ChatKitWorkbenchNavigation['view']>) => {
    if (!input.views.some((item) => item.key === view.viewKey)) return false;
    const query = {
      ...(view.selectionId ? { selectionId: view.selectionId } : {}),
      ...(view.parameters ? { parameters: view.parameters } : {}),
    };
    const key = contentTabKey(view.viewKey, query);
    const previous = input.queries[key];
    // URL publication is echoed by the embedding host. Selecting the same
    // mounted resource does not dispose its draft and must not request a flush.
    // A different singleton selection or an explicit reload still uses the gate.
    const replacing =
      previous?.selectionId !== query.selectionId ||
      Boolean(
        query.parameters?.reload &&
        query.parameters.reload !== previous?.parameters?.reload,
      );
    const result = navigate(
      key,
      () => {
        input.setQueries((current) => ({
          ...current,
          [key]: {
            ...(view.selectionId ? { selectionId: view.selectionId } : {}),
            ...(view.parameters ? { parameters: view.parameters } : {}),
          },
        }));
        input.selectView(key);
        input.setOpen(true);
        if (view.layout) input.setExpanded(view.layout === 'maximized');
      },
      replacing,
    );
    return result ? result.then(() => true) : true;
  };
  const close = () => navigate(undefined, () => input.setOpen(false));
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
    restore: (target) => {
      if (target.target !== 'workbench.view') return false;
      const result = restore(target);
      if (result instanceof Promise) {
        void result.catch(input.onError);
        return true;
      }
      return result;
    },
    close: () => {
      void Promise.resolve(close()).catch(input.onError);
    },
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
  const currentView = hostedWorkbenchView(
    input.open &&
      input.views.some(
        (view) => view.key === contentViewKey(input.activeViewKey ?? ''),
      )
      ? contentViewKey(input.activeViewKey ?? '')
      : null,
    input.activeViewKey ? input.queries[input.activeViewKey] : undefined,
  );
  useHostedWorkbenchNavigation({
    ...input,
    options: { ...input.options, navigation: normalized },
    ready: input.enabled && input.ready,
    currentView:
      currentView && requested?.layout
        ? { ...currentView, layout: input.expanded ? 'maximized' : 'split' }
        : currentView,
    restore,
    canPublish:
      !input.open ||
      !input.activeViewKey ||
      input.views.some(
        (view) => view.key === contentViewKey(input.activeViewKey ?? ''),
      ),
    close: () => {
      // Host URL state addresses Remote Views, not a file/browser/native tab.
      if (
        !input.activeViewKey ||
        input.views.some(
          (view) => view.key === contentViewKey(input.activeViewKey ?? ''),
        )
      )
        return close();
    },
  });
  return local;
}
