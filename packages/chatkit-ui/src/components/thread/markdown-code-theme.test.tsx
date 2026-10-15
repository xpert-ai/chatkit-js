import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import { coldarkCold, coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../../i18n';
import { ThemeProvider } from '../../providers/Theme';
import { MarkdownText } from './markdown-text';

const code = 'const answer = 42;';
const markdown = '```ts\n' + code + '\n```\n\n```\nplain code\n```\n\n`inline code`';

function content(theme: ChatKitTheme) {
  return (
    <ThemeProvider theme={theme}>
      <MarkdownText>{markdown}</MarkdownText>
    </ThemeProvider>
  );
}

describe('message code themes', () => {
  it.each([
    ['sharp', 'compact'],
    ['round', 'spacious'],
  ] as const)('updates code colors in place with %s radius and %s density', async (radius, density) => {
    setLanguage('en-US');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { container, rerender } = render(content({ colorScheme: 'light', radius, density }));
    const keyword = () => screen.getByText('const', { selector: 'span' });
    await waitFor(() => expect(keyword()).toHaveStyle({ color: coldarkCold.keyword.color }));

    const pre = container.querySelector('pre')!;
    expect(pre).toHaveStyle({ background: 'transparent', color: 'var(--foreground)' });
    expect(pre.parentElement).toHaveClass('bg-muted/30', 'text-foreground', 'rounded-chat-panel');
    expect(screen.getByText('ts').parentElement).toHaveClass('bg-muted', 'text-foreground');
    expect(screen.getByText('plain code').parentElement).toHaveClass('bg-muted/30', 'text-foreground');
    expect(screen.getByText('inline code')).toHaveClass('bg-muted');

    rerender(content({ colorScheme: 'dark', radius, density }));
    await waitFor(() => expect(keyword()).toHaveStyle({ color: coldarkDark.keyword.color }));
    expect(container.querySelector('pre')).toBe(pre);
    expect(container.firstElementChild).toHaveClass('dark');

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(code));

    rerender(content({ colorScheme: 'light', radius, density }));
    await waitFor(() => expect(keyword()).toHaveStyle({ color: coldarkCold.keyword.color }));
    expect(container.firstElementChild).not.toHaveClass('dark');
    expect(container.querySelector('pre')).toHaveTextContent(code);
  });
});
