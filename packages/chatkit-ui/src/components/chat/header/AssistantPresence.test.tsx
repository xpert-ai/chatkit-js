import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../../providers/Theme';
import {
  AssistantPresence,
  AssistantSummaryDialog,
  type AssistantPresenceProps,
} from './AssistantPresence';
import { AssistantCharacter } from './AssistantCharacter';
import { normalizeChatkitAvatar } from '../../ui/chatkit-avatar';
import { mergeTaskSummary } from '../../../lib/task-summary';

const presence = (): AssistantPresenceProps => ({
  avatar: null,
  name: 'Bosi',
  motionId: 'test-assistant-presence',
  state: 'review',
  waitingForInput: false,
  open: false,
  onOpenChange: vi.fn(),
  onCustomize: vi.fn(),
});
function PresenceHarness({
  props = presence(),
}: {
  props?: AssistantPresenceProps;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <ThemeProvider>
      <button
        data-slot="task-summary-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        Summary
      </button>
      <input aria-label="Composer" />
      <AssistantPresence {...props} open={open} onOpenChange={setOpen} />
      <AssistantSummaryDialog
        presence={{ ...props, open, onOpenChange: setOpen }}
        summary={{
          summary: mergeTaskSummary(null, {
            outputs: [],
            sources: [],
            agents: [],
            pending: [],
            running: [],
            fileChanges: [],
          }),
          onRetryHistory: vi.fn(),
          onLoadSection: vi.fn(),
          onNavigateMessage: vi.fn(),
          onFocusComposer: vi.fn(),
          onOpenResource: vi.fn(),
        }}
      />
    </ThemeProvider>
  );
}

describe('Assistant message presence', () => {
  it('shows live status, opens the shared summary, and hides the centered duplicate while expanded', () => {
    const props = presence();
    const view = render(
      <ThemeProvider>
        <AssistantPresence {...props} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Thinking');
    fireEvent.click(screen.getByRole('button', { name: 'Open Bosi details' }));
    expect(props.onOpenChange).toHaveBeenCalledWith(true);
    expect(
      screen.queryByRole('button', { name: 'Customize appearance' }),
    ).toBeNull();
    view.rerender(
      <ThemeProvider>
        <AssistantPresence {...props} state="running" waitingForInput />
      </ThemeProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Waiting for confirmation',
    );
    view.rerender(
      <ThemeProvider>
        <AssistantPresence {...props} open />
      </ThemeProvider>,
    );
    expect(
      screen.queryByRole('button', { name: 'Open Bosi details' }),
    ).toBeNull();
  });
  it('uses the published pet independently of global pet preferences and supports reduced motion', () => {
    const avatar = normalizeChatkitAvatar({
      url: 'https://example.test/preview.png',
      appearance: { version: 1, kind: 'pet', id: 'boba' },
    });
    const { container, rerender } = render(
      <AssistantCharacter
        avatar={avatar}
        name="Bosi"
        state="running"
        reducedMotion
      />,
    );
    const sprite = container.querySelector<HTMLElement>(
      '.chatkit-inline-pet-status__sprite',
    )!;
    expect(sprite.style.backgroundImage).toContain(
      '/pets/boba/spritesheet.webp',
    );
    expect(sprite.style.animation).toBe('none');
    expect(container.querySelector('[data-pet-state="running"]')).toBeTruthy();
    rerender(<AssistantCharacter avatar={avatar} name="Bosi" state="failed" />);
    expect(container.querySelector('[data-pet-state="failed"]')).toBeTruthy();
    expect(
      container.querySelectorAll('[data-chatkit-inline-pet-status]'),
    ).toHaveLength(1);
  });
  it('rejects malformed appearance metadata while preserving the legacy image', () => {
    expect(
      normalizeChatkitAvatar({
        url: '/legacy.png',
        appearance: { version: 1, kind: 'pet', id: '../secret' },
      }),
    ).toMatchObject({ url: '/legacy.png', appearance: undefined });
    expect(
      normalizeChatkitAvatar({ emoji: { id: 'cat', unified: '1f431' } })?.emoji
        ?.id,
    ).toBe('cat');
  });
  it('keeps the centered space and disables exiting controls during rapid reversals', () => {
    const { container } = render(<PresenceHarness />);
    const centered = container.querySelector(
      '[data-slot="assistant-presence"]',
    );
    const trigger = screen.getByRole('button', { name: 'Summary' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(centered).toBeInTheDocument();
    expect(centered?.querySelector('button')).toHaveAttribute('inert');
    expect(
      centered?.querySelector('[data-slot="assistant-presence-character"]'),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Close assistant details' }),
    );
    expect(dialog).toHaveAttribute('inert');
    expect(dialog).toHaveAttribute('aria-hidden', 'true');
    expect(dialog).toHaveStyle({ pointerEvents: 'none' });
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).not.toHaveAttribute('inert');
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.querySelector('[data-slot="assistant-presence"]')).toBe(
      centered,
    );
    expect(
      centered?.querySelectorAll('[data-slot="assistant-presence-character"]'),
    ).toHaveLength(1);
  });
  it('skips spatial motion when reduced motion is requested and releases the panel', async () => {
    const { container } = render(
      <PresenceHarness props={{ ...presence(), reducedMotion: true }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Bosi details' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.transform).toBe('none');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.getByRole('button', { name: 'Open Bosi details' }),
    ).toHaveFocus();
    await waitFor(() =>
      expect(
        container.querySelector('[data-slot="assistant-summary-dialog"]'),
      ).toBeNull(),
    );
  });
  it('keeps the summary non-modal, supports Escape and restores focus', async () => {
    const props = presence();
    render(<PresenceHarness props={props} />);
    const trigger = screen.getByRole('button', { name: 'Summary' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(
      screen.getByRole('dialog', { name: 'Assistant details' }),
    ).toHaveAttribute('aria-modal', 'false');
    fireEvent.click(
      screen.getByRole('button', { name: 'Customize appearance' }),
    );
    expect(props.onCustomize).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Pointer dismissal must not steal focus from the composer.
    const composer = screen.getByRole('textbox', { name: 'Composer' });
    fireEvent.pointerDown(composer, { pointerType: 'mouse', button: 0 });
    composer.focus();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(composer).toHaveFocus();
    expect(
      screen.getByRole('button', { name: 'Open Bosi details' }),
    ).toBeVisible();
    fireEvent.click(trigger);
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.blur(window);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
