import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from './MessageList';
import { MessageTimestamp } from './MessageTimestamp';

const locale = vi.hoisted(() => ({ language: 'en-US' }));
vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string, values?: { time?: string }) =>
      values?.time ? `Updated ${values.time}` : key,
    i18n: locale,
  }),
}));

describe('message update timestamps', () => {
  beforeEach(() => {
    locale.language = 'en-US';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-23T00:05:00'));
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('shows actual updatedAt for human and assistant messages and updates after hydration', () => {
    const updatedAt = '2026-09-23T10:22:00Z';
    const messages = [
      { id: 'h', type: 'user' as const, content: 'Question', updatedAt },
      {
        id: 'a',
        type: 'assistant' as const,
        content: 'Answer',
        status: 'success',
        updatedAt,
      },
    ];
    const { container, rerender } = render(<MessageList messages={messages} />);
    expect(container.querySelectorAll('time')).toHaveLength(2);
    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      new Date(updatedAt).toISOString(),
    );
    const next = '2026-09-23T10:24:00Z';
    rerender(
      <MessageList
        messages={[{ ...messages[0], updatedAt: next }, messages[1]]}
      />,
    );
    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      new Date(next).toISOString(),
    );
  });

  it('exposes the full date and timezone on keyboard focus', async () => {
    const { container } = render(
      <MessageTimestamp updatedAt="2026-09-23T10:22:00Z" />,
    );
    const timestamp = container.querySelector('time')!;
    expect(timestamp).toHaveTextContent(
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date('2026-09-23T10:22:00Z')),
    );
    fireEvent.focus(timestamp);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('2026');
  });

  it.each([
    ['2026-09-23T00:01:00', '00:01'],
    ['2026-09-22T23:58:00', 'yesterday 23:58'],
    ['2026-09-21T23:58:00', '2 days ago 23:58'],
    ['2026-09-20T16:13:00', '3 days ago 16:13'],
    ['2026-09-16T16:13:00', 'Sep 16 16:13'],
    ['2025-09-23T16:13:00', 'Sep 23, 2025 16:13'],
  ])('formats local calendar dates: %s', (updatedAt, expected) => {
    const { container } = render(<MessageTimestamp updatedAt={updatedAt} />);
    expect(container.querySelector('time')?.textContent).toBe(expected);
  });

  it('localizes relative dates in Chinese', () => {
    locale.language = 'zh-CN';
    const { container, rerender } = render(
      <MessageTimestamp updatedAt="2026-09-22T16:13:00" />,
    );
    expect(container.querySelector('time')?.textContent).toBe('昨天 16:13');
    rerender(<MessageTimestamp updatedAt="2026-09-21T16:13:00" />);
    expect(container.querySelector('time')?.textContent).toBe('前天 16:13');
  });

  it.each([undefined, null, '', 'invalid'])(
    'omits absent or invalid timestamps: %s',
    (updatedAt) => {
      const { container } = render(<MessageTimestamp updatedAt={updatedAt} />);
      expect(container.querySelector('time')).toBeNull();
    },
  );
});
