import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parsePreview } from './client-command-payload';
import { useWorkbenchPages } from './useWorkbenchPages';

function website(path: string) {
  const preview = parsePreview(
    'browser',
    { url: `https://example.test/${path}` },
    '/api/ai',
  );
  if (!preview) throw new Error('Invalid website fixture');
  return preview;
}

describe('workbench browser navigation', () => {
  it('returns manually opened websites to the guide when previews must be cleared', () => {
    const { result } = renderHook(() => useWorkbenchPages('one'));
    const key = 'chatkit.new-tab:one';
    act(() => result.current.addNewTab(key));
    act(() => result.current.navigateBrowser(key, website('a')));
    act(() => result.current.clearPreviews());
    expect(result.current.newTabs).toEqual([key]);
    expect(result.current.previews).toEqual([]);
    expect(result.current.recent).toEqual([]);
    expect(result.current.browserHistory[key]).toEqual({
      entries: [null],
      index: 0,
    });
  });

  it('keeps the tab identity across guide, navigation, back and forward', () => {
    const { result } = renderHook(() => useWorkbenchPages('conversation-1'));
    act(() => result.current.addNewTab('tab-1'));
    act(() => result.current.navigateBrowser('tab-1', website('a')));
    act(() => result.current.navigateBrowser('tab-1', website('b')));
    expect(result.current.previews).toEqual([
      { ...website('b'), key: 'tab-1' },
    ]);
    act(() => result.current.moveBrowser('tab-1', -1));
    expect(result.current.previews[0].url).toBe(website('a').url);
    act(() => result.current.moveBrowser('tab-1', -1));
    expect(result.current.newTabs).toEqual(['tab-1']);
    expect(result.current.previews).toEqual([]);
    act(() => result.current.moveBrowser('tab-1', -1));
    expect(result.current.browserHistory['tab-1'].index).toBe(0);
    act(() => result.current.moveBrowser('tab-1', 1));
    expect(result.current.newTabs).toEqual([]);
    expect(result.current.previews).toEqual([
      { ...website('a'), key: 'tab-1' },
    ]);
    act(() => result.current.navigateBrowser('tab-1', website('c')));
    act(() => result.current.moveBrowser('tab-1', 1));
    expect(result.current.previews[0].url).toBe(website('c').url);
    expect(result.current.browserHistory['tab-1'].entries).toEqual([
      null,
      website('a'),
      website('c'),
    ]);
    expect(result.current.recent.map(({ preview }) => preview.url)).toEqual(
      ['c', 'a', 'b'].map((path) => website(path).url),
    );
  });

  it('isolates tabs, ignores closed tabs and clears navigation when the conversation changes', () => {
    const { result, rerender } = renderHook(
      ({ scope }) => useWorkbenchPages(scope),
      { initialProps: { scope: 'one' } },
    );
    act(() => {
      result.current.addNewTab('one');
      result.current.addNewTab('two');
    });
    act(() => {
      result.current.navigateBrowser('one', website('a'));
      result.current.navigateBrowser('two', website('b'));
    });
    act(() => result.current.moveBrowser('one', -1));
    expect(result.current.previews).toEqual([{ ...website('b'), key: 'two' }]);
    act(() => result.current.closeNewTab('one'));
    act(() => result.current.navigateBrowser('one', website('c')));
    expect(result.current.newTabs).toEqual([]);
    expect(result.current.previews).toHaveLength(1);
    act(() => result.current.closePreview('two'));
    act(() => result.current.moveBrowser('two', -1));
    expect(result.current.browserHistory).toEqual({});
    expect(result.current.recent).toHaveLength(2);
    rerender({ scope: 'two' });
    expect(result.current.recent).toEqual([]);
    expect(result.current.previews).toEqual([]);
    expect(result.current.browserHistory).toEqual({});
  });

  it('reopens host previews that were navigated home without duplicating the tab', () => {
    const { result } = renderHook(() => useWorkbenchPages('one'));
    const preview = website('a');
    act(() => result.current.openPreview(preview));
    act(() => result.current.moveBrowser(preview.key, -1));
    expect(result.current.newTabs).toEqual([preview.key]);
    act(() => result.current.openPreview(preview));
    expect(result.current.newTabs).toEqual([]);
    expect(result.current.previews).toEqual([preview]);
    expect(result.current.recent).toHaveLength(1);
  });
});
