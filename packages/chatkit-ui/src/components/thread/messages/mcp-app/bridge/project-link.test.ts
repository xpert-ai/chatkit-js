import { describe, expect, it } from 'vitest';
import { parseMcpAppProjectLink } from './project-link';
describe('MCP project links', () => {
  it('accepts only a typed project target', () =>
    expect(
      parseMcpAppProjectLink(
        'xpert://project/12345678-1234-4234-8234-123456789abc?viewKey=platform.project-tasks__timeline',
      ),
    ).toEqual({
      projectId: '12345678-1234-4234-8234-123456789abc',
      viewKey: 'platform.project-tasks__timeline',
    }));
  it.each([
    'javascript:alert(1)',
    'https://project/x',
    'xpert://user@project/12345678-1234-4234-8234-123456789abc?viewKey=p__t',
    'xpert://project/invalid?viewKey=p__t',
    'xpert://project/12345678-1234-4234-8234-123456789abc?viewKey=p__t&token=x',
  ])('rejects %s', (url) => expect(parseMcpAppProjectLink(url)).toBeNull());
});
