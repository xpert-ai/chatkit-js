import * as React from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToolComponent, render } from './ai.test-fixture';
import { ToolComponentGroup } from './tool-component-group';
import { CommandToolIcon } from './tool-group/icons/CommandToolIcon';
import type { PartialStepData } from './tool-group/types';

const command = (status: PartialStepData['status'] = 'running') =>
  createToolComponent('command', {
    tool: 'sandbox_shell',
    title: 'Run command',
    status,
    toolPresentation: 'redacted',
    icon: { type: 'svg', value: '<svg><path d="M0 0h22v22H0z"/></svg>' },
    presentation: {
      version: 1,
      activity: { kind: 'command', action: 'execute' },
    },
  });

function loadSprites(container: HTMLElement) {
  container
    .querySelectorAll('[data-command-sprite-preload]')
    .forEach((image) => {
      fireEvent.load(image);
    });
}

afterEach(() => vi.restoreAllMocks());

describe('command timeline icons', () => {
  it('uses the same static shape despite legacy SVG metadata and moves animation on disclosure', () => {
    const { container } = render(
      <ToolComponentGroup
        items={[command()]}
        hasFollowingItem={false}
        isThreadRunning
      />,
    );
    loadSprites(container);
    const group = screen.getByRole('button', {
      name: /Run commands.*1 call/,
    });
    const row = screen.getByRole('button', { name: /^Run command Running/ });
    const groupIcon = group.querySelector('[data-command-icon]');
    const rowIcon = row.querySelector('[data-command-icon]');
    expect(groupIcon?.querySelector('svg')?.innerHTML).toBe(
      rowIcon?.querySelector('svg')?.innerHTML,
    );
    expect(row.querySelector('path[d="M0 0h22v22H0z"]')).toBeNull();
    expect(groupIcon).toHaveAttribute('data-animated', 'false');
    expect(rowIcon).toHaveAttribute('data-animated', 'true');
    fireEvent.click(group);
    loadSprites(container);
    expect(groupIcon).toHaveAttribute('data-animated', 'true');
    expect(rowIcon).toHaveAttribute('data-animated', 'false');
    fireEvent.click(group);
    loadSprites(container);
    expect(groupIcon).toHaveAttribute('data-animated', 'false');
    expect(rowIcon).toHaveAttribute('data-animated', 'true');
  });

  it.each(['success', 'fail', 'canceled'] as const)(
    'stops the animation after %s',
    (status) => {
      const { container, rerender } = render(
        <ToolComponentGroup
          items={[command()]}
          hasFollowingItem={false}
          isThreadRunning
        />,
      );
      loadSprites(container);
      expect(container.querySelector('[data-animated="true"]')).not.toBeNull();
      rerender(
        <ToolComponentGroup
          items={[command(status)]}
          hasFollowingItem={false}
          isThreadRunning={false}
        />,
      );
      expect(container.querySelector('[data-animated="true"]')).toBeNull();
      expect(container.querySelectorAll('[data-command-icon]')).toHaveLength(2);
    },
  );

  it('does not animate paused or stale running history', () => {
    const { container, rerender } = render(
      <ToolComponentGroup
        items={[command()]}
        hasFollowingItem={false}
        isThreadPaused
        isThreadRunning={false}
      />,
    );
    expect(container.querySelector('[data-command-sprite-preload]')).toBeNull();
    rerender(
      <ToolComponentGroup
        items={[command()]}
        hasFollowingItem={false}
        isThreadRunning={false}
      />,
    );
    expect(container.querySelector('[data-animated="true"]')).toBeNull();
  });

  it('preserves non-command custom icons', () => {
    const item = createToolComponent('query', {
      status: 'success',
      icon: { type: 'svg', value: '<svg><path d="M0 0h22v22H0z"/></svg>' },
      presentation: { version: 1, activity: { kind: 'data', action: 'query' } },
    });
    const { container } = render(
      <ToolComponentGroup items={[item]} hasFollowingItem={false} />,
    );
    expect(container.querySelector('[data-command-icon]')).toBeNull();
    expect(
      container.querySelector('[data-slot="tool-step-icon"]'),
    ).not.toBeNull();
  });

  it('falls back to the static icon when sprite loading fails', () => {
    const { container } = render(<CommandToolIcon animated />);
    expect(container.querySelector('[data-command-icon]')).toHaveAttribute(
      'data-animated',
      'false',
    );
    loadSprites(container);
    expect(container.querySelector('[data-command-icon]')).toHaveAttribute(
      'data-animated',
      'true',
    );
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('[data-command-icon]')).toHaveAttribute(
      'data-animated',
      'false',
    );
    expect(container.querySelector('.ck-command-icon-static')).not.toBeNull();
  });

  it('animates only the active command inside a mixed activity group', () => {
    const query = createToolComponent('query', {
      title: 'Query data',
      status: 'success',
      presentation: { version: 1, activity: { kind: 'data', action: 'query' } },
    });
    const { container } = render(
      <ToolComponentGroup
        items={[command(), query]}
        hasFollowingItem={false}
        isThreadRunning
      />,
    );
    loadSprites(container);
    const group = screen.getByRole('button', {
      name: /Command execution and Data operations.*2 calls/,
    });
    expect(group.querySelector('[data-command-icon]')).toBeNull();
    expect(container.querySelectorAll('[data-animated="true"]')).toHaveLength(
      1,
    );
    fireEvent.click(group);
    expect(container.querySelector('[data-animated="true"]')).toBeNull();
  });

  it('releases motion listeners and preloading when the command finishes', () => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    const removeMedia = vi.spyOn(media, 'removeEventListener');
    const removeVisibility = vi.spyOn(document, 'removeEventListener');
    const { container, rerender } = render(<CommandToolIcon animated />);
    loadSprites(container);
    rerender(<CommandToolIcon animated={false} />);
    expect(container.querySelector('[data-command-sprite-preload]')).toBeNull();
    expect(container.querySelector('[data-animated="true"]')).toBeNull();
    expect(removeMedia).toHaveBeenCalledWith('change', expect.any(Function));
    expect(removeVisibility).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });

  it('responds to reduced motion and page visibility changes while running', () => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const { container, unmount } = render(<CommandToolIcon animated />);
    loadSprites(container);
    const icon = container.querySelector('[data-command-icon]');
    expect(icon).toHaveAttribute('data-animated', 'true');
    act(() => {
      Object.defineProperty(media, 'matches', {
        value: true,
        configurable: true,
      });
      media.dispatchEvent(new Event('change'));
    });
    expect(icon).toHaveAttribute('data-animated', 'false');
    act(() => {
      Object.defineProperty(media, 'matches', { value: false });
      media.dispatchEvent(new Event('change'));
    });
    expect(icon).toHaveAttribute('data-animated', 'true');
    act(() => {
      hidden.mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(icon).toHaveAttribute('data-animated', 'false');
    const remove = vi.spyOn(document, 'removeEventListener');
    unmount();
    expect(remove).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });
});
