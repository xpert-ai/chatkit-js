import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageNavigator } from './MessageNavigator';
import type { MessageNavigationItem } from '../../lib/message-navigation';

const items: MessageNavigationItem[] = [
  {
    id: 'message-1',
    messageId: 'message-1',
    index: 0,
    role: 'user',
    title: 'You',
    preview: 'First message',
    tags: [],
  },
  {
    id: 'message-2',
    messageId: 'message-2',
    index: 1,
    role: 'assistant',
    title: 'Assistant',
    preview: 'Loaded a tool',
    tags: ['README.md', 'types.ts', 'search', 'extra'],
  },
];

const waveItems: MessageNavigationItem[] = Array.from(
  { length: 5 },
  (_, index) => ({
    id: `wave-${index + 1}`,
    messageId: `wave-${index + 1}`,
    index,
    role: index % 2 === 0 ? 'user' : 'assistant',
    title: `Message ${index + 1}`,
    preview: `Preview ${index + 1}`,
    tags: [],
  }),
);

function setReadonlyNumberProperty(
  element: HTMLElement,
  property: 'clientHeight' | 'scrollHeight' | 'offsetTop',
  value: number,
) {
  Object.defineProperty(element, property, {
    configurable: true,
    value,
  });
}

function setupNavigator(navigationItems = items) {
  const viewport = document.createElement('div');
  const scrollTo = vi.fn();

  setReadonlyNumberProperty(viewport, 'clientHeight', 400);
  setReadonlyNumberProperty(viewport, 'scrollHeight', 1000);
  setReadonlyNumberProperty(viewport, 'offsetTop', 0);
  viewport.scrollTo = scrollTo;

  const anchors = new Map(
    navigationItems.map((item, index) => {
      const anchor = document.createElement('div');
      setReadonlyNumberProperty(anchor, 'offsetTop', index * 240);
      return [item.id, anchor] as const;
    }),
  );

  render(
    <MessageNavigator
      items={navigationItems}
      viewportRef={{ current: viewport }}
      getAnchor={(item) => anchors.get(item.id) ?? null}
      label="Message navigation"
      tagsOverflowLabel={(count) => `+${count}`}
    />,
  );

  return { viewport, scrollTo };
}

function getMarkerLine(button: HTMLElement) {
  const line = button.querySelector('span');
  expect(line).not.toBeNull();
  return line as HTMLElement;
}

describe('MessageNavigator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders markers in item order without inline top positioning', () => {
    setupNavigator();

    const buttons = screen.getAllByRole('button');

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'You: First message',
      'Assistant: Loaded a tool',
    ]);
    for (const button of buttons) {
      expect(button).not.toHaveAttribute('style');
    }
    expect(getMarkerLine(buttons[1])).toHaveClass('w-2');
  });

  it('tightens marker spacing and creates a width wave around hover', () => {
    setupNavigator(waveItems);

    const buttons = screen.getAllByRole('button');
    fireEvent.mouseEnter(
      screen.getByRole('button', { name: /Message 3: Preview 3/ }),
    );

    expect(buttons[0].parentElement).toHaveClass('h-3.5');
    expect(getMarkerLine(buttons[0])).toHaveClass('w-3.5');
    expect(getMarkerLine(buttons[1])).toHaveClass('w-5');
    expect(getMarkerLine(buttons[2])).toHaveClass('w-7');
    expect(getMarkerLine(buttons[3])).toHaveClass('w-5');
    expect(getMarkerLine(buttons[4])).toHaveClass('w-3.5');
  });

  it('shows a hover preview with tags and overflow count', () => {
    setupNavigator();

    fireEvent.mouseEnter(
      screen.getByRole('button', { name: /Assistant: Loaded a tool/ }),
    );

    expect(screen.getByText('Loaded a tool')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('types.ts')).toBeInTheDocument();
    expect(screen.getByText('search')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('scrolls the viewport to the selected message anchor', () => {
    const { scrollTo } = setupNavigator();

    fireEvent.click(
      screen.getByRole('button', { name: /Assistant: Loaded a tool/ }),
    );

    expect(scrollTo).toHaveBeenCalledWith({
      top: 228,
      behavior: 'smooth',
    });
  });

  it('updates the active marker as the viewport scrolls', async () => {
    const { viewport } = setupNavigator();

    viewport.scrollTop = 260;
    fireEvent.scroll(viewport);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Assistant: Loaded a tool/ }),
      ).toHaveAttribute('aria-current', 'location'),
    );
  });
});
