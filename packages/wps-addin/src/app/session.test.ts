import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearUserApiKeyConfig,
  createUserApiKeyChatKitSession,
  normalizeUserApiKeyConfig,
  readCompleteUserApiKeyConfig,
  saveUserApiKeyConfig,
} from './session';

describe('user API key session config', () => {
  afterEach(() => {
    clearUserApiKeyConfig();
    vi.unstubAllGlobals();
  });

  it('normalizes required fields and defaults the secret TTL', () => {
    expect(
      normalizeUserApiKeyConfig({
        apiUrl: 'https://api.example.com/api/ai/',
        apiKey: ' sk-test ',
        xpertId: ' xpert-123 ',
        frameUrl: ' https://app.example.com/chatkit/index.html ',
      }),
    ).toEqual({
      apiUrl: 'https://api.example.com/api/ai',
      apiKey: 'sk-test',
      xpertId: 'xpert-123',
      frameUrl: 'https://app.example.com/chatkit/index.html',
      expiresAfter: 600,
    });
  });

  it('round-trips complete config through local storage', () => {
    const config = normalizeUserApiKeyConfig({
      apiUrl: 'https://api.example.com/api/ai',
      apiKey: 'sk-test',
      xpertId: 'xpert-123',
      frameUrl: 'https://app.example.com/chatkit/index.html',
      expiresAfter: 300,
    });

    saveUserApiKeyConfig(config);

    expect(readCompleteUserApiKeyConfig()).toEqual(config);
  });

  it('creates ChatKit sessions directly with the user API key', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ client_secret: 'cs-test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await createUserApiKeyChatKitSession({
      apiUrl: 'https://api.example.com/api/ai',
      apiKey: 'sk-test',
      xpertId: 'xpert-123',
      frameUrl: 'https://app.example.com/chatkit/index.html',
      expiresAfter: 300,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/ai/v1/chatkit/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-api-key': 'sk-test',
        }),
        body: JSON.stringify({ expires_after: 300 }),
      }),
    );
    expect(session).toMatchObject({
      apiUrl: 'https://api.example.com/api/ai',
      client_secret: 'cs-test',
      frameUrl: 'https://app.example.com/chatkit/index.html',
      organizationId: null,
      xpertId: 'xpert-123',
    });
    const requestInit = (
      fetchMock.mock.calls as unknown as Array<
        [string, { headers?: Record<string, string> }]
      >
    )[0]?.[1];
    expect(requestInit?.headers).not.toHaveProperty('organization-id');
    expect(requestInit?.headers).not.toHaveProperty('x-principal-user-id');
  });

  it('explains likely CORS failures when direct session fetch is blocked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await expect(
      createUserApiKeyChatKitSession({
        apiUrl: 'https://api.example.com/api/ai',
        apiKey: 'sk-test',
        xpertId: 'xpert-123',
        frameUrl: 'https://app.example.com/chatkit/index.html',
      }),
    ).rejects.toThrow(
      'The API must allow origin http://localhost:3000 and the x-api-key header.',
    );
  });
});
