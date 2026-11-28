import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { useLauncherPins } from './LauncherMenu';
import { useSearchHistory } from '../browser-preview/useSearchHistory';
import { rankSuggestions } from '../browser-preview/search-suggestions';
import { sideChatSelection } from '../side-chat/side-chat-records';
import type { Thread } from '@xpert-ai/xpert-sdk';

beforeEach(() => localStorage.clear());
const actions = ['chat', 'files', 'terminal', 'plugin'].map((id) => ({
  id,
  title: id,
  icon: null,
  run: () => {},
}));

it('keeps pin ordering in sync across start tabs and isolates user scopes', () => {
  const first = renderHook(() => useLauncherPins('alice', actions));
  const second = renderHook(() => useLauncherPins('alice', actions));
  act(() => first.result.current.save(['plugin', 'files']));
  expect(second.result.current.pins).toEqual(['plugin', 'files']);
  const other = renderHook(() => useLauncherPins('bob', actions));
  expect(other.result.current.pins).toEqual([
    'chat',
    'files',
    'terminal',
    'plugin',
  ]);
  act(() => second.result.current.save(null));
  expect(first.result.current.pins).toEqual(other.result.current.pins);
});

it('retains query and URL history from consecutive actions and clears all mounted views', () => {
  const a = renderHook(() => useSearchHistory('alice', '/api/ai'));
  const b = renderHook(() => useSearchHistory('alice', '/api/ai'));
  act(() => {
    a.result.current.remember({
      value: 'timeline',
      title: 'timeline',
      kind: 'query',
    });
    a.result.current.remember({
      value: 'https://example.com/',
      title: 'Example',
      kind: 'website',
    });
  });
  expect(b.result.current.entries.map((e) => e.kind)).toEqual([
    'website',
    'query',
  ]);
  const other = renderHook(() => useSearchHistory('bob', '/api/ai'));
  expect(other.result.current.entries).toEqual([]);
  act(() => b.result.current.clear());
  expect(a.result.current.entries).toEqual([]);
});

it('ignores unsafe stored addresses and corrupt preference data', () => {
  localStorage.setItem(
    'chatkit:search:v1:alice',
    JSON.stringify([
      { value: 'javascript:alert(1)', title: 'Unsafe', kind: 'website', at: 1 },
    ]),
  );
  localStorage.setItem('chatkit:launcher:v1:alice', '{broken');
  expect(
    renderHook(() => useSearchHistory('alice', '/api/ai')).result.current
      .entries,
  ).toEqual([]);
  expect(
    renderHook(() => useLauncherPins('alice', actions)).result.current.pins,
  ).toHaveLength(4);
});

it('deduplicates history in favor of an open tab even when the history entry is newer', () => {
  const item = {
    title: 'Timeline',
    kind: 'website' as const,
    detail: 'https://example.com/',
    onSelect: () => {},
  };
  const ranked = rankSuggestions(
    [
      { ...item, key: 'open', opened: true, updatedAt: 1 },
      { ...item, key: 'recent', updatedAt: 9 },
    ],
    'time',
  );
  expect(ranked.map((r) => r.key)).toEqual(['open']);
  expect(
    rankSuggestions(
      [
        { ...item, key: 'partial', title: 'My timeline' },
        { ...item, kind: 'action', detail: '', key: 'exact', title: 'time' },
      ],
      'time',
    )[0].key,
  ).toBe('exact');
});

it('restores only an authorized editing branch within its side-chat lineage', () => {
  const thread = (id: string, parent: string, purpose: string): Thread => ({
    thread_id: id,
    created_at: '',
    updated_at: '',
    metadata: { parent_thread_id: parent, purpose },
    status: 'idle',
    values: {},
    interrupts: {},
  });
  const threads = [
    thread('root', 'main', 'side-chat'),
    thread('edit', 'root', 'message-edit'),
    thread('other', 'main', 'side-chat'),
    thread('foreign', 'other', 'message-edit'),
  ];
  expect(sideChatSelection(threads, 'root', 'edit')).toBe('edit');
  expect(sideChatSelection(threads, 'root', 'foreign')).toBe('root');
  expect(sideChatSelection(threads, 'root', 'revoked')).toBe('root');
});

it('orders recent websites and queries by time without including launchers or files', () => {
  const ranked = rankSuggestions(
    [
      {
        key: 'open',
        title: 'Open website',
        kind: 'website',
        detail: 'https://old.test/',
        opened: true,
        updatedAt: 1,
        onSelect: () => {},
      },
      {
        key: 'query',
        title: 'timeline',
        kind: 'query',
        updatedAt: 3,
        onSelect: () => {},
      },
      {
        key: 'website',
        title: 'Website',
        kind: 'website',
        detail: 'https://new.test/',
        updatedAt: 2,
        onSelect: () => {},
      },
      {
        key: 'file',
        title: 'File',
        kind: 'file',
        updatedAt: 4,
        onSelect: () => {},
      },
      { key: 'action', title: 'Terminal', kind: 'action', onSelect: () => {} },
      {
        key: 'recent-open',
        title: 'Recent visit to open website',
        kind: 'website',
        detail: 'https://old.test/',
        updatedAt: 9,
        onSelect: () => {},
      },
    ],
    '',
    'recent',
  );
  expect(ranked.map((item) => item.key)).toEqual(['open', 'query', 'website']);
  expect(ranked[0]).toMatchObject({ opened: true, updatedAt: 9 });
});
