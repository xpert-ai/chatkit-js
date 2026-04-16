import { describe, expect, it } from 'vitest';

import {
  createMissingApiConfigurationError,
  getMissingApiConfigurationKind,
} from './api-config';

describe('api-config helpers', () => {
  it('reports no missing configuration when both apiUrl and client secret are present', () => {
    expect(
      getMissingApiConfigurationKind({
        apiUrl: 'https://example.com/api/ai',
        clientSecret: 'secret-token',
      }),
    ).toBeNull();
    expect(
      createMissingApiConfigurationError({
        apiUrl: 'https://example.com/api/ai',
        clientSecret: 'secret-token',
      }),
    ).toBeNull();
  });

  it('distinguishes between a missing apiUrl and a missing client secret', () => {
    expect(
      getMissingApiConfigurationKind({
        apiUrl: '',
        clientSecret: 'secret-token',
      }),
    ).toBe('apiUrl');
    expect(
      createMissingApiConfigurationError({
        apiUrl: '',
        clientSecret: 'secret-token',
      })?.message,
    ).toBe('Missing ChatKit API URL');

    expect(
      getMissingApiConfigurationKind({
        apiUrl: 'https://example.com/api/ai',
        clientSecret: '   ',
      }),
    ).toBe('clientSecret');
    expect(
      createMissingApiConfigurationError({
        apiUrl: 'https://example.com/api/ai',
        clientSecret: '   ',
      })?.message,
    ).toBe('Missing ChatKit client secret');
  });

  it('reports when both apiUrl and client secret are missing', () => {
    expect(
      getMissingApiConfigurationKind({
        apiUrl: undefined,
        clientSecret: undefined,
      }),
    ).toBe('apiUrlAndClientSecret');
    expect(
      createMissingApiConfigurationError({
        apiUrl: undefined,
        clientSecret: undefined,
      })?.message,
    ).toBe('Missing ChatKit API URL and client secret');
  });
});
