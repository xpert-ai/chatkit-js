import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHostCredentials } from './useHostCredentials';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(cleanup);

describe('host credential lifecycle', () => {
  it('shares one host request between bootstrap and concurrent API consumers', async () => {
    const pending = deferred<{ secret: string; organizationId: string }>();
    const sendCommand = vi.fn(() => pending.promise);
    const { result } = renderHook(() =>
      useHostCredentials({
        initialClientSecret: '',
        apiUrl: '/api',
        assistantId: 'a',
        isParentAvailable: true,
        sendCommand,
      }),
    );
    expect(result.current.isClientSecretInitializing).toBe(true);
    const first = result.current.getClientSecret!();
    const second = result.current.getClientSecret!();
    expect(first).toBe(second);
    expect(sendCommand).toHaveBeenCalledOnce();
    await act(async () =>
      pending.resolve({ secret: 'cs-x-a', organizationId: 'org-a' }),
    );
    expect(result.current.clientSecret).toBe('cs-x-a');
    expect(result.current.organizationId).toBe('org-a');
    expect(result.current.isClientSecretInitializing).toBe(false);
  });

  it('discards a late response from a previous Assistant and keeps the current scope', async () => {
    const old = deferred<{ secret: string; organizationId: string }>();
    const next = deferred<{ secret: string; organizationId: string }>();
    const sendCommand = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(
      ({ assistantId }) =>
        useHostCredentials({
          initialClientSecret: '',
          apiUrl: '/api',
          assistantId,
          isParentAvailable: true,
          sendCommand,
        }),
      { initialProps: { assistantId: 'a' } },
    );
    const response = result.current.getClientSecret!();
    const rejection = expect(response).rejects.toMatchObject({
      name: 'AbortError',
    });
    rerender({ assistantId: 'b' });
    expect(result.current.clientSecret).toBe('');
    await act(async () =>
      next.resolve({ secret: 'cs-x-b', organizationId: 'org-b' }),
    );
    await act(async () =>
      old.resolve({ secret: 'cs-x-a', organizationId: 'org-a' }),
    );
    await rejection;
    expect(result.current.clientSecret).toBe('cs-x-b');
    expect(result.current.organizationId).toBe('org-b');
  });

  it('does not reuse the first Assistant credential after a binding change', async () => {
    const sendCommand = vi.fn(() => new Promise<unknown>(() => {}));
    const { result, rerender } = renderHook(
      ({ assistantId }) =>
        useHostCredentials({
          initialClientSecret: 'cs-x-initial',
          apiUrl: '/api',
          assistantId,
          isParentAvailable: true,
          sendCommand,
        }),
      { initialProps: { assistantId: 'a' } },
    );
    expect(result.current.clientSecret).toBe('cs-x-initial');
    rerender({ assistantId: 'b' });
    expect(result.current.clientSecret).toBe('');
  });

  it('keeps the bootstrap usable through StrictMode effect replay', async () => {
    const sendCommand = vi.fn().mockResolvedValue({ secret: 'cs-x-a' });
    const { result } = renderHook(
      () =>
        useHostCredentials({
          initialClientSecret: '',
          apiUrl: '/api',
          assistantId: 'a',
          isParentAvailable: true,
          sendCommand,
        }),
      { wrapper: React.StrictMode },
    );
    await waitFor(() => expect(result.current.clientSecret).toBe('cs-x-a'));
    expect(result.current.isClientSecretInitializing).toBe(false);
  });

  it('does not request host credentials for standalone mode', () => {
    const sendCommand = vi.fn();
    const { result } = renderHook(() =>
      useHostCredentials({
        initialClientSecret: 'cs-x-standalone',
        isParentAvailable: false,
        sendCommand,
      }),
    );
    expect(result.current.clientSecret).toBe('cs-x-standalone');
    expect(result.current.getClientSecret).toBeUndefined();
    expect(sendCommand).not.toHaveBeenCalled();
  });
});

it('preserves resolved Assistant identity and organization for legacy string refresh responses', async () => {
  const sendCommand = vi
    .fn()
    .mockResolvedValueOnce({
      secret: 'cs-x-initial',
      assistantId: 'resolved-assistant',
      organizationId: 'org',
    })
    .mockResolvedValueOnce('cs-x-refreshed');
  const { result } = renderHook(() =>
    useHostCredentials({
      initialClientSecret: '',
      apiUrl: '/api',
      isParentAvailable: true,
      sendCommand,
    }),
  );
  await waitFor(() =>
    expect(result.current.resolvedXpertId).toBe('resolved-assistant'),
  );
  await act(async () => {
    await result.current.getClientSecret!();
  });
  expect(result.current.clientSecret).toBe('cs-x-refreshed');
  expect(result.current.resolvedXpertId).toBe('resolved-assistant');
  expect(result.current.organizationId).toBe('org');
});

it('does not carry a group session into another group in the same frame', async () => {
  const sendCommand = vi
    .fn()
    .mockResolvedValueOnce('cs-x-one')
    .mockResolvedValueOnce('cs-x-two');
  const { result, rerender } = renderHook(
    ({ groupId }) =>
      useHostCredentials({
        initialClientSecret: '',
        apiUrl: '/api',
        groupId,
        isParentAvailable: true,
        sendCommand,
      }),
    { initialProps: { groupId: 'one' } },
  );
  await waitFor(() => expect(result.current.clientSecret).toBe('cs-x-one'));
  rerender({ groupId: 'two' });
  expect(result.current.clientSecret).toBe('');
  await waitFor(() => expect(result.current.clientSecret).toBe('cs-x-two'));
  expect(sendCommand).toHaveBeenLastCalledWith('onGetClientSecret', null);
});
