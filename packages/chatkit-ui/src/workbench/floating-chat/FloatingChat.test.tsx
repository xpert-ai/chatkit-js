import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPortal } from 'react-dom';
import { Client } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../providers/Theme';
import { initI18n } from '../../i18n';
import { useWorkbenchPanelHost } from '../useWorkbenchPanelHost';
import {
  WorkbenchChatProvider,
  usePublishWorkbenchChat,
  type WorkbenchChatMetadata,
} from './context';
import { FloatingChat } from './FloatingChat';

const observers = new Set<() => void>();
const openChat = vi.fn();
const newSideChat = vi.fn();
let conversationMenu: WorkbenchChatMetadata['conversationMenu'];
function Content() {
  usePublishWorkbenchChat({
    title: 'Review bid',
    running: false,
    conversationMenu,
  });
  return <input role="textbox" aria-label="Draft" defaultValue="Keep draft" />;
}
function Surface() {
  const host = useWorkbenchPanelHost();
  return (
    <>
      <button>Business page</button>
      <FloatingChat
        active
        host={host.attach}
        onOpenChat={openChat}
        onNewSideChat={newSideChat}
      />
      {host.container && createPortal(<Content />, host.container)}
    </>
  );
}
function setup() {
  const result = render(
    <ThemeProvider>
      <WorkbenchChatProvider scope="test" floating>
        <Surface />
      </WorkbenchChatProvider>
    </ThemeProvider>,
  );
  const bounds = result.container.querySelector<HTMLElement>(
    '.chatkit-floating-chat-layer',
  );
  const surface = result.container.querySelector<HTMLElement>(
    '.chatkit-floating-chat-surface',
  );
  const header = result.container.querySelector<HTMLElement>(
    '.chatkit-floating-chat-header',
  );
  if (!bounds || !surface || !header) throw new Error('Missing floating chat');
  const area = { width: 1200, height: 800 };
  Object.defineProperties(bounds, {
    clientWidth: { get: () => area.width },
    clientHeight: { get: () => area.height },
    getBoundingClientRect: { value: () => ({ left: 0, top: 0, ...area }) },
  });
  const width = () =>
    Math.min(parseFloat(surface.style.width.slice(4)), area.width - 32);
  const height = () =>
    bounds.dataset.floatingChatMode === 'expanded'
      ? area.height * 0.8
      : header.hidden
        ? 80
        : 128;
  Object.defineProperties(surface, {
    offsetWidth: { get: width },
    offsetHeight: { get: height },
    getBoundingClientRect: {
      value: () => ({
        left: parseFloat(surface.style.left) || 0,
        top:
          surface.style.top === 'auto'
            ? area.height - parseFloat(surface.style.bottom) - height()
            : parseFloat(surface.style.top) || 0,
        width: width(),
        height: height(),
      }),
    },
  });
  for (const element of [
    header,
    ...surface.querySelectorAll('.chatkit-floating-chat-resize'),
  ]) {
    Object.assign(element, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
    });
  }
  const measure = () =>
    act(() => {
      observers.forEach((callback) => callback());
    });
  const focus = () => {
    act(() => screen.getByLabelText('Draft').focus());
    measure();
  };
  measure();
  return { ...result, bounds, surface, header, area, measure, focus };
}
function drag(element: Element, dx: number, dy: number) {
  fireEvent.pointerDown(element, {
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(element, { pointerId: 1, clientX: dx, clientY: dy });
  fireEvent.pointerUp(element, { pointerId: 1 });
  fireEvent.click(element, { detail: 1 });
}

beforeEach(() => {
  void initI18n().changeLanguage('en-US');
  openChat.mockReset();
  newSideChat.mockReset();
  observers.clear();
  conversationMenu = undefined;
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    },
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
        observers.add(callback);
      }
      observe() {}
      disconnect() {
        observers.delete(this.callback);
      }
    },
  );
});
afterEach(async () => {
  await act(async () => undefined);
  vi.unstubAllGlobals();
});

describe('FloatingChat interactions', () => {
  it('publishes live conversation actions without remounting the draft or toggling the card', async () => {
    const client = new Client({ apiUrl: 'https://example.invalid' });
    vi.spyOn(client.conversations, 'get').mockResolvedValue({
      id: 'record',
      threadId: 'thread',
      title: 'Review bid',
      projectId: 'project',
    });
    vi.spyOn(client.conversations, 'searchMessages').mockResolvedValue({
      items: [],
      total: 0,
    });
    const rename = vi.fn().mockResolvedValue(undefined);
    conversationMenu = {
      context: {
        client,
        scopeKey: 'test',
        ready: true,
        running: false,
        activeConversationId: 'record',
        activeThreadId: 'thread',
        branchEnabled: true,
        rename,
        delete: vi.fn(),
        navigate: vi.fn(),
      },
      target: {
        recordId: 'record',
        id: 'thread',
        title: 'Review bid',
        status: 'idle',
        projectId: 'project',
      },
    };
    const { bounds } = setup();
    const draft = screen.getByLabelText('Draft');
    const trigger = screen.getByLabelText('Conversation menu: Review bid');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Rename' }),
      ).not.toHaveAttribute('aria-disabled'),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'Conversation title' }),
      { target: { value: 'Updated' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save title' }));
    await waitFor(() =>
      expect(rename).toHaveBeenCalledWith(
        expect.objectContaining({ recordId: 'record', id: 'thread' }),
        'Updated',
      ),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(bounds).toHaveAttribute('data-floating-chat-mode', 'compact');
    expect(screen.getByLabelText('Draft')).toBe(draft);
    expect(draft).toHaveValue('Keep draft');
  });

  it('keeps the header and input stable across focus changes, including after dragging', () => {
    const { surface, header, focus, measure } = setup();
    const inputTop = () =>
      surface.getBoundingClientRect().top + (header.hidden ? 0 : 48);
    const initial = inputTop();
    focus();
    expect(inputTop()).toBe(initial);
    drag(header, -80, -120);
    const moved = inputTop();
    expect(moved).toBe(initial - 120);
    for (let i = 0; i < 2; i++) {
      act(() => screen.getByText('Business page').focus());
      measure();
      expect(header).toBeVisible();
      expect(inputTop()).toBe(moved);
      focus();
      expect(header).toBeVisible();
      expect(inputTop()).toBe(moved);
    }
    fireEvent.keyDown(header, { key: 'ArrowUp' });
    expect(inputTop()).toBe(moved - 16);
    fireEvent.keyDown(header, { key: 'ArrowDown' });
    expect(inputTop()).toBe(moved);
  });

  it('keeps the compact header visible and lets its menu own Escape', async () => {
    const { header, bounds, focus } = setup();
    expect(header).toBeVisible();
    focus();
    expect(header).toBeVisible();
    fireEvent.blur(window);
    expect(header).toBeVisible();
    fireEvent.focus(window);
    expect(header).toBeVisible();
    fireEvent.keyDown(screen.getByLabelText('Conversation menu: Review bid'), {
      key: 'Enter',
    });
    expect(
      await screen.findByRole('menuitem', { name: 'New side chat' }),
    ).toBeVisible();
    expect(header).toBeVisible();
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'New side chat' }), {
      key: 'Escape',
    });
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    );
    expect(bounds).toHaveAttribute('data-floating-chat-mode', 'compact');
    expect(header).toBeVisible();
    act(() => screen.getByText('Business page').focus());
    await waitFor(() => expect(header).toBeVisible());
  });

  it('opens the current conversation or starts a side chat without expanding on menu clicks', async () => {
    const { bounds, focus } = setup();
    focus();
    fireEvent.keyDown(screen.getByLabelText('Conversation menu: Review bid'), {
      key: 'Enter',
    });
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Open conversation tab' }),
    );
    expect(openChat).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    );
    focus();
    fireEvent.keyDown(screen.getByLabelText('Conversation menu: Review bid'), {
      key: 'Enter',
    });
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'New side chat' }),
    );
    expect(newSideChat).toHaveBeenCalledOnce();
    expect(bounds).toHaveAttribute('data-floating-chat-mode', 'compact');
  });

  it('restores the compact position and width after expanding, dragging, and minimizing', () => {
    const { bounds, surface, header, focus, measure } = setup();
    focus();
    const input = screen.getByLabelText('Draft');
    drag(header, -80, -120);
    expect(bounds).toHaveAttribute('data-floating-chat-mode', 'compact');
    drag(screen.getByLabelText('Resize conversation from right'), 80, 0);
    const compact = {
      left: surface.style.left,
      top: surface.getBoundingClientRect().top,
      width: surface.style.width,
    };
    expect(compact.width).toContain('720px');
    fireEvent.click(header);
    measure();
    expect(bounds).toHaveAttribute('data-floating-chat-mode', 'expanded');
    drag(header, 150, -100);
    drag(screen.getByLabelText('Resize conversation from left'), -50, 0);
    fireEvent.click(screen.getByLabelText('Minimize conversation'));
    fireEvent.click(
      screen.getByLabelText('Open conversation input: Review bid'),
    );
    measure();
    expect(bounds).toHaveAttribute('data-floating-chat-mode', 'compact');
    expect({
      left: surface.style.left,
      top: surface.getBoundingClientRect().top,
      width: surface.style.width,
    }).toEqual(compact);
    expect(screen.getByLabelText('Draft')).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Keep draft');
  });

  it('resizes from both edges with minimum width and workbench boundaries', () => {
    const { surface, area, focus, measure } = setup();
    focus();
    const right = screen.getByLabelText('Resize conversation from right');
    drag(right, 2000, 0);
    expect(surface.offsetWidth + parseFloat(surface.style.left)).toBe(1184);
    drag(right, -2000, 0);
    expect(surface.offsetWidth).toBe(320);
    const beforeRight = parseFloat(surface.style.left) + surface.offsetWidth;
    fireEvent.keyDown(screen.getByLabelText('Resize conversation from left'), {
      key: 'ArrowLeft',
    });
    expect(surface.offsetWidth).toBe(336);
    expect(parseFloat(surface.style.left) + surface.offsetWidth).toBe(
      beforeRight,
    );
    area.width = 300;
    measure();
    expect(surface.offsetWidth).toBe(268);
    expect(surface.style.left).toBe('16px');
  });
});
