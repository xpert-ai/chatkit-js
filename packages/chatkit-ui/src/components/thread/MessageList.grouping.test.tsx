import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageList, type MessageListProps } from './MessageList';
import { ThemeProvider } from '../../providers/Theme';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));
vi.mock('../ui/chatkit-avatar', () => ({
  ChatkitAvatar: ({ label }: { label: string }) => (
    <span data-test-avatar={label} />
  ),
}));
afterEach(cleanup);
const actors = {
  a: { id: 'a', kind: 'user' as const, name: 'Alice' },
  c: { id: 'c', kind: 'assistant' as const, name: 'Expert' },
  me: { id: 'me', kind: 'user' as const, name: 'Me' },
};
function timeline(ids: (keyof typeof actors)[]) {
  const context: NonNullable<MessageListProps['messageContext']> = {};
  const messages = ids.map((actor, index) => {
    context[String(index)] = { actor: actors[actor], isSelf: actor === 'me' };
    return {
      id: String(index),
      type: actor === 'c' ? ('assistant' as const) : ('user' as const),
      content: `Message ${index}`,
    };
  });
  return { messages, messageContext: context };
}
describe('group sender presentation in the existing MessageList', () => {
  it('shows the sender once and places one avatar at the last bubble of each consecutive run', () => {
    const { container } = render(
      <MessageList
        {...timeline(['a', 'a', 'c', 'c', 'me', 'me', 'a'])}
        messagePresentation={{ mode: 'bubbles' }}
        showActions={false}
      />,
      { wrapper: ThemeProvider },
    );
    const rows = Array.from(container.querySelectorAll('[data-author]'));
    expect(
      rows.map((row) => !!row.querySelector('[data-test-avatar]')),
    ).toEqual([false, true, false, true, false, false, true]);
    expect(
      rows.map((row) => row.getAttribute('data-message-group-start')),
    ).toEqual(['true', 'false', 'true', 'false', 'true', 'false', 'true']);
    expect(rows[0]).toHaveTextContent('Alice');
    expect(rows[1]).not.toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Expert');
    expect(rows[3]).not.toHaveTextContent('Expert');
    expect(
      rows[1].querySelector('[data-slot="message-avatar-column"]'),
    ).toHaveClass('items-end');
    for (const row of rows.filter(
      (row) => row.getAttribute('data-author') === 'me',
    )) {
      expect(row).toHaveClass('justify-end');
      expect(
        row.querySelector('[data-slot="message-avatar-column"]'),
      ).toBeNull();
      expect(row.querySelector('[data-slot="message-sender-name"]')).toBeNull();
    }
  });
  it('leaves the live avatar to the activity footer and restores it on the completed tail', () => {
    const { container, rerender } = render(
      <MessageList {...timeline(['c'])} />,
      { wrapper: ThemeProvider },
    );
    expect(
      container.querySelector('#group-message-0 [data-test-avatar]'),
    ).not.toBeNull();
    const next = timeline(['c', 'c']);
    next.messageContext['1'].streaming = true;
    rerender(<MessageList {...next} />);
    expect(
      container.querySelector('#group-message-0 [data-test-avatar]'),
    ).toBeNull();
    expect(
      container.querySelector('#group-message-1 [data-test-avatar]'),
    ).toBeNull();
    expect(container.querySelector('#group-message-0')).not.toBeNull();
    expect(container).not.toHaveTextContent('message.answering');
    next.messageContext['1'].streaming = false;
    rerender(<MessageList {...next} />);
    expect(
      container.querySelector('#group-message-1 [data-test-avatar]'),
    ).not.toBeNull();
  });
  it('keeps ordinary private-chat presentation without group sender columns', () => {
    const { container } = render(
      <MessageList messages={timeline(['a', 'c']).messages} />,
      { wrapper: ThemeProvider },
    );
    expect(
      container.querySelector('[data-slot="message-avatar-column"]'),
    ).toBeNull();
    expect(container.querySelector('[data-message-group-start]')).toBeNull();
  });
});
