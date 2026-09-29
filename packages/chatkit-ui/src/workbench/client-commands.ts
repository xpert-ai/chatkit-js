import type { ChatKitWorkbenchClientCommandRequest } from '@xpert-ai/chatkit-types';
import type { XpertViewQuery } from '@xpert-ai/xpert-sdk';
import {
  field,
  parseAppendReferences,
  parseNavigation,
  parseNavigationSession,
  parsePreview,
  type NavigationSession,
  type WorkbenchPreview,
  type ExecutionNavigationRequest,
  type ExecutionNavigationResult,
} from './client-command-payload';
import type { ComposerValuePayload } from '../lib/references';

export type WorkbenchCommandHost = {
  apiUrl: string;
  openView: (key: string, query: XpertViewQuery) => boolean;
  openPreview: (preview: WorkbenchPreview) => void;
  revealChat: () => void;
  updateComposer: (value: ComposerValuePayload) => Promise<void>;
  focusComposer: () => Promise<void>;
  openExecution?: (
    request: ExecutionNavigationRequest,
  ) => Promise<ExecutionNavigationResult>;
  navigate?: (
    session: NavigationSession,
    request: ChatKitWorkbenchClientCommandRequest,
  ) => void;
  forward: (request: ChatKitWorkbenchClientCommandRequest) => Promise<unknown>;
};
const invalid = () => ({ success: false, code: 'bad_request' });
export const unsupportedCommand = (commandKey: string) => ({
  success: false,
  code: 'unsupported',
  commandKey,
});

export async function executeWorkbenchCommand(
  request: ChatKitWorkbenchClientCommandRequest,
  host: WorkbenchCommandHost,
): Promise<unknown> {
  const { commandKey, payload } = request;
  if (commandKey === 'assistant.composer.append_references') {
    const references = parseAppendReferences(payload);
    if (!references) return invalid();
    await host.updateComposer({ references, appendReferences: true });
    host.revealChat();
    // Do not ask the plugin to retry a reference already appended when focus fails.
    let focused = true;
    try {
      await host.focusComposer();
    } catch {
      focused = false;
    }
    return { success: true, status: 'appended', focused };
  }
  if (
    commandKey === 'workbench.file.open' ||
    commandKey === 'workbench.browser.open'
  ) {
    const preview = parsePreview(
      commandKey === 'workbench.file.open' ? 'file' : 'browser',
      payload,
      host.apiUrl,
    );
    if (!preview) return invalid();
    host.openPreview(preview);
    return {
      success: true,
      status: 'opened',
      tabId: preview.key,
      ...(preview.file ? { file: preview.file } : { url: preview.url }),
    };
  }
  if (commandKey === 'workbench.navigation.open') {
    const navigation = parseNavigation(payload);
    if (!navigation.target) return invalid();
    const executionTarget = navigation.target === 'assistant.execution';
    if (
      executionTarget &&
      (!navigation.conversationId || !navigation.executionId)
    )
      return invalid();
    if (
      executionTarget ||
      (navigation.target === 'assistant.conversation' && navigation.executionId)
    ) {
      if (!navigation.conversationId || !navigation.executionId)
        return invalid();
      const result = await host.openExecution?.({
        conversationId: navigation.conversationId,
        executionId: navigation.executionId,
        threadId: navigation.threadId,
        projectId: navigation.projectId,
      });
      // Only a context the embedded client cannot handle falls back to the host.
      if (result && (result.success || result.code !== 'unsupported'))
        return result;
      if (executionTarget) {
        // Older hosts understand conversation navigation with an execution anchor.
        return executeWorkbenchCommand(
          {
            ...request,
            payload: { ...navigation, target: 'assistant.conversation' },
          },
          { ...host, openExecution: undefined },
        );
      }
    }
    if (navigation.target === 'workbench.view') {
      if (!navigation.viewKey) return invalid();
      return host.openView(navigation.viewKey, navigation.query)
        ? {
            success: true,
            status: 'opened',
            target: navigation.target,
            viewKey: navigation.viewKey,
            ...navigation.query,
          }
        : {
            success: false,
            code: 'view_unavailable',
            viewKey: navigation.viewKey,
          };
    }
    if (
      navigation.target === 'assistant.conversation' ||
      navigation.target === 'assistant.project'
    ) {
      if (
        (navigation.target === 'assistant.conversation' &&
          !navigation.conversationId) ||
        (navigation.target === 'assistant.project' && !navigation.projectId)
      )
        return invalid();
      if (!host.navigate) return unsupportedCommand(commandKey);
      const result = await host.forward(request);
      const session = parseNavigationSession(result);
      if (!session) {
        if (
          field(result, 'success') === true &&
          field(result, 'status') === 'opened' &&
          !field(result, 'session')
        )
          return { success: true, status: 'opened', target: navigation.target };
        const message = field(result, 'message');
        return {
          success: false,
          code:
            field(result, 'success') === true
              ? 'invalid_session'
              : (field(result, 'code') ?? 'unsupported'),
          ...(typeof message === 'string' ? { message } : {}),
        };
      }
      // An authorization result may canonicalize the Assistant, but cannot silently change the requested resource.
      if (
        (navigation.target === 'assistant.conversation' &&
          session.conversationId !== navigation.conversationId) ||
        (navigation.target === 'assistant.conversation' && !session.threadId) ||
        (navigation.threadId && navigation.threadId !== session.threadId) ||
        (navigation.projectId && navigation.projectId !== session.projectId)
      )
        return { success: false, code: 'navigation_mismatch' };
      host.navigate(session, request);
      return {
        success: true,
        status: 'opened',
        target: navigation.target,
        conversationId: session.conversationId,
        threadId: session.threadId,
        xpertId: session.assistantId,
        projectId: session.projectId,
      };
    }
  }
  return host.forward(request);
}
