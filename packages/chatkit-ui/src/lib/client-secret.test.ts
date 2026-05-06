import { describe, expect, it } from 'vitest';

import { normalizeClientSecretResult } from './client-secret';

describe('normalizeClientSecretResult', () => {
  it('accepts the legacy string response and preserves the current organization id', () => {
    expect(
      normalizeClientSecretResult('  cs-x-next  ', '  org-123  '),
    ).toEqual({
      secret: 'cs-x-next',
      organizationId: 'org-123',
    });
  });

  it('accepts the object response and uses the returned organization id', () => {
    expect(
      normalizeClientSecretResult({
        secret: '  cs-x-next  ',
        organizationId: '  org-456  ',
        xpertId: '  xpert-1  ',
      }),
    ).toEqual({
      secret: 'cs-x-next',
      organizationId: 'org-456',
      xpertId: 'xpert-1',
    });
  });

  it('throws when the secret is missing or empty', () => {
    expect(() =>
      normalizeClientSecretResult({
        secret: '   ',
        organizationId: 'org-456',
      }),
    ).toThrow('[chatkit-ui] Parent returned an invalid client secret.');
  });

  it('clears organization id when the object response returns it as empty', () => {
    expect(
      normalizeClientSecretResult(
        {
          secret: 'cs-x-next',
          organizationId: '   ',
        },
        'org-123',
      ),
    ).toEqual({
      secret: 'cs-x-next',
    });
  });
});
