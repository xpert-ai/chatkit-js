import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useInitialLoading } from './useInitialLoading';

describe('initial session loading', () => {
  it('reveals the session once and does not cover background refreshes', () => {
    const { result, rerender } = renderHook(
      ({ scope, pending }) => useInitialLoading(scope, pending),
      {
        initialProps: { scope: 'assistant-1', pending: true },
      },
    );
    expect(result.current).toBe(true);
    rerender({ scope: 'assistant-1', pending: false });
    expect(result.current).toBe(false);
    rerender({ scope: 'assistant-1', pending: true });
    expect(result.current).toBe(false);
    rerender({ scope: 'assistant-2', pending: true });
    expect(result.current).toBe(true);
  });
});
