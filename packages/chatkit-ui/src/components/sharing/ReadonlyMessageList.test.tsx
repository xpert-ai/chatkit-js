import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../providers/Theme';
import { ReadonlyMessageList } from './ReadonlyMessageList';
import { MessageList } from '../thread/MessageList';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));

describe('readonly shared transcript', () => {
  it('uses the real message list and Markdown presentation without conversation actions', () => {
    const { container } = render(
      <ThemeProvider>
        <ReadonlyMessageList
          messages={[
            { role: 'human', text: 'Please explain' },
            {
              role: 'ai',
              text: '**Answer**\n\n| Item | Value |\n| --- | --- |\n| result | `42` |',
            },
          ]}
        />
      </ThemeProvider>,
    );
    expect(
      container.querySelector('[data-slot="chatkit-message-list"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-human-bubble]')).toHaveTextContent(
      'Please explain',
    );
    expect(container.querySelector('strong')).toHaveTextContent('Answer');
    expect(screen.getByRole('table')).toHaveTextContent('result');
    expect(container.querySelector('code')).toHaveTextContent('42');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(container.querySelector('[data-quote-message-id]')).toBeNull();
  });

  it('keeps remote images and private resource links inert, while allowing explicit web navigation', () => {
    const { container } = render(
      <ThemeProvider>
        <ReadonlyMessageList
          messages={[
            {
              role: 'ai',
              text: '![tracker](https://example.com/pixel.png)\n\n[private](/api/files/secret) [citation](xpert://knowledgebase/chunk?documentId=private) [web](https://example.com/page)\n\n<script>alert(1)</script>',
            },
          ]}
        />
      </ThemeProvider>,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.queryByRole('link', { name: 'private' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'citation' })).toBeNull();
    expect(screen.getByRole('link', { name: 'web' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('does not change the normal chat renderer outside readonly mode', () => {
    const { container } = render(
      <ThemeProvider>
        <MessageList
          messages={[
            {
              id: 'live',
              type: 'assistant',
              status: 'success',
              content: '![chart](https://example.com/chart.png)',
            },
          ]}
        />
      </ThemeProvider>,
    );
    expect(screen.getByRole('img', { name: 'chart' })).toHaveAttribute(
      'src',
      'https://example.com/chart.png',
    );
    expect(
      container.querySelector('[data-quote-message-id="live"]'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'messageActions.copy' }),
    ).toBeTruthy();
  });
});
