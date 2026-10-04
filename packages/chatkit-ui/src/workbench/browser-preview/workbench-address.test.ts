import { describe, expect, it } from 'vitest';
import { resolveWorkbenchAddress } from './workbench-address';

describe('workbench addresses', () => {
  it.each([
    [' example.test/docs?q=a#intro ', 'https://example.test/docs?q=a#intro'],
    ['localhost:5173/demo', 'http://localhost:5173/demo'],
    ['127.0.0.1:4300/', 'http://127.0.0.1:4300/'],
    ['[::1]:5173', 'http://[::1]:5173/'],
    ['https://example.test/', 'https://example.test/'],
  ])('normalizes %s as an explicit website', (input, url) => {
    expect(resolveWorkbenchAddress(input, '/api/ai')).toMatchObject({
      kind: 'url',
      preview: { kind: 'browser', url },
    });
  });

  it.each(['', 'project files', 'reports/budget.xlsx', '/reports', 'Studio'])(
    'keeps %s as a local search',
    (input) => {
      expect(
        resolveWorkbenchAddress(input, 'https://api.example.test/ai'),
      ).toEqual({ kind: 'search' });
    },
  );

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///tmp/report',
    'ftp://example.test',
    'https://user:secret@example.test/',
    'https://',
    'https://invalid host/',
  ])('rejects unsafe or malformed addresses: %s', (input) => {
    expect(resolveWorkbenchAddress(input, '/api/ai')).toEqual({
      kind: 'invalid',
    });
  });
});
