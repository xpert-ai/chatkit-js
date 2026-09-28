import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ChatKitOptions,
  ChatKitWorkbenchClientCommandRequest,
} from '@xpert-ai/chatkit-types';
import { useWorkbenchNavigation } from './useWorkbenchNavigation';

const sendCommand = vi.hoisted(() => vi.fn());
vi.mock('../hooks/useParentMessenger', () => ({
  useParentMessenger: () => ({ sendCommand, isParentAvailable: true }),
}));
const request: ChatKitWorkbenchClientCommandRequest = {
  commandKey: 'workbench.navigation.open',
  payload: { target: 'assistant.conversation', conversationId: 'conversation' },
  hostType: 'agent',
  hostId: 'root',
  viewKey: 'tasks',
};
const session = {
  assistantId: 'external',
  threadId: 'thread',
  projectId: null,
  conversationId: 'conversation',
  secret: 'scoped',
  organizationId: 'org',
};
const options: ChatKitOptions = {
  api: {
    apiUrl: '/api/ai',
    xpertId: 'root',
    getClientSecret: async () => 'root-secret',
  },
};

describe('Workbench runtime navigation', () => {
  it('defers the scope switch until the reply and refreshes only that authorized scope through the host bridge', async () => {
    // Callback markers are serialized strings inside the embedded frame.
    const embedded: ChatKitOptions = JSON.parse(
      JSON.stringify({
        ...options,
        workbench: { onClientCommand: '[ChatKitMethod]' },
      }),
    );
    const { result } = renderHook(() =>
      useWorkbenchNavigation(embedded, 'org'),
    );
    act(() => result.current.navigate(session, request));
    expect(result.current.session).toBeUndefined();
    await waitFor(() => expect(result.current.session).toEqual(session));
    sendCommand.mockResolvedValue({
      success: true,
      session: { ...session, secret: 'renewed' },
    });
    expect(await result.current.refresh?.()).toEqual({
      secret: 'renewed',
      organizationId: 'org',
    });
    expect(sendCommand).toHaveBeenCalledWith(
      'onWorkbenchClientCommand',
      request,
    );
    sendCommand.mockResolvedValue({
      success: true,
      session: { ...session, assistantId: 'wrong' },
    });
    await expect(result.current.refresh?.()).rejects.toThrow('scope changed');
  });
  it('retains scope on appearance updates and clears it for an explicit parent thread or organization change', async () => {
    const { result, rerender } = renderHook(
      ({ settings, org }) => useWorkbenchNavigation(settings, org),
      { initialProps: { settings: options, org: 'org' } },
    );
    act(() => result.current.navigate(session, request));
    await waitFor(() => expect(result.current.session).toEqual(session));
    rerender({
      settings: { ...options, theme: { colorScheme: 'dark' } },
      org: 'org',
    });
    expect(result.current.session).toEqual(session);
    rerender({
      settings: { ...options, initialThread: 'parent-selected' },
      org: 'org',
    });
    expect(result.current.session).toBeUndefined();
    rerender({ settings: options, org: 'different' });
    expect(result.current.session).toBeUndefined();
    rerender({ settings: options, org: 'org' });
    expect(result.current.session).toBeUndefined();
  });
});
