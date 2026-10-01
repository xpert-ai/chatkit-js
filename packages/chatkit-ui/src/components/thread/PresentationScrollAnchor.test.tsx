import * as React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PresentationScrollAnchor } from './PresentationScrollAnchor';
import type { MessagePresentationMode } from '../../lib/message-presentation';

function fixture(mode: MessagePresentationMode) {
  return (
    <div data-testid="viewport" style={{ overflowY: 'auto', height: 50 }}>
      <PresentationScrollAnchor mode={mode}>
        <div
          data-message-navigation-id="reply"
          data-offset={mode === 'bubbles' ? 30 : 100}
        >
          Answer
        </div>
      </PresentationScrollAnchor>
    </div>
  );
}

describe('presentation scroll anchor', () => {
  it('keeps the first visible original message at the same offset after changing modes', () => {
    const { getByTestId, getByText, rerender } = render(fixture('transcript'));
    const viewport = getByTestId('viewport');
    const message = getByText('Answer');
    Object.defineProperties(viewport, {
      scrollHeight: { value: 1000 },
      clientHeight: { value: 50 },
    });
    Object.defineProperties(message, {
      getClientRects: { value: () => [new DOMRect()] },
      getBoundingClientRect: {
        value: () => new DOMRect(0, Number(message.dataset.offset), 100, 50),
      },
    });
    viewport.scrollTop = 100;
    rerender(fixture('bubbles'));
    expect(viewport.scrollTop).toBe(30);
    rerender(fixture('transcript'));
    expect(viewport.scrollTop).toBe(100);
  });

  it('keeps following the bottom when switching from the bottom', () => {
    const { getByTestId, rerender } = render(fixture('transcript'));
    const viewport = getByTestId('viewport');
    Object.defineProperties(viewport, {
      scrollHeight: { value: 200 },
      clientHeight: { value: 50 },
    });
    viewport.scrollTop = 150;
    rerender(fixture('bubbles'));
    expect(viewport.scrollTop).toBe(200); // browsers clamp to scrollHeight - clientHeight
  });

  it('does not move the viewport for an update within the same mode', () => {
    const { getByTestId, rerender } = render(fixture('bubbles'));
    const viewport = getByTestId('viewport');
    viewport.scrollTop = 42;
    rerender(fixture('bubbles'));
    expect(viewport.scrollTop).toBe(42);
  });
});
