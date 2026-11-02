import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import {
  baseChatOptions,
  Chat,
  mocks,
  renderChat,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat composer layout', () => {
  setupChatTest();
  it.each([
    { radius: 'sharp', density: 'compact', colorScheme: 'light' },
    { radius: 'round', density: 'spacious', colorScheme: 'dark' },
  ] satisfies ChatKitTheme[])(
    'keeps tasks and errors attached through shrinking/restoring ($radius/$density/$colorScheme)',
    async (theme) => {
      mocks.theme = theme;
      mocks.stream.messages = [
        { id: 'message', type: 'human', content: 'Hello' },
      ];
      mocks.stream.error = new Error('Save was not confirmed');
      mocks.stream.todos = {
        componentId: 'tasks',
        title: 'Tasks',
        tool: 'write_todos',
        category: 'Tool',
        toolset: 'todos',
        status: 'running',
        createdDate: '2026-11-02T10:00:00Z',
        receivedAt: 0,
        items: [
          { id: 'task', content: 'Check the result', status: 'in_progress' },
        ],
      };
      const view = renderChat();
      await act(async () => {});
      const viewport = view.container.querySelector<HTMLElement>(
        '[data-chatkit-root]',
      );
      if (!viewport) throw new Error('Missing viewport');
      Object.defineProperties(viewport, {
        scrollHeight: { configurable: true, value: 2000 },
        clientHeight: { configurable: true, value: 500 },
      });
      const input = screen.getByRole('textbox');
      const shell = view.container.querySelector<HTMLElement>(
        '[data-slot="composer-input-shell"]',
      );
      const content = view.container.querySelector(
        '[data-slot="composer-content"]',
      );
      const panels = view.container.querySelector<HTMLElement>(
        '[data-slot="composer-before"]',
      );
      const toggle = screen.getByRole('button', { name: 'chat.todos.summary' });
      const error = screen.getByText('Save was not confirmed');
      const assertAttached = (layout: string) => {
        expect(shell).toHaveAttribute('data-layout', layout);
        expect(content).toContainElement(panels);
        expect(panels).toContainElement(toggle);
        expect(panels).toContainElement(error);
        expect(panels?.nextElementSibling).toContainElement(input);
        expect(panels?.parentElement).toBe(content);
        expect(input.closest('form')).not.toContainElement(panels);
        expect(screen.getByRole('textbox')).toBe(input);
        expect(shell).toHaveClass('pointer-events-none', 'justify-end');
        expect(shell?.style.getPropertyValue('--chat-density-scale')).toBe(
          theme.density === 'compact' ? '0.75' : '1.25',
        );
      };
      viewport.scrollTop = 1452;
      fireEvent.scroll(viewport);
      assertAttached('stacked');
      viewport.scrollTop = 1451;
      fireEvent.scroll(viewport);
      assertAttached('compact');
      expect(
        screen.getByRole('button', { name: 'chat.scrollToBottom' })
          .parentElement?.parentElement,
      ).toBe(content);
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      viewport.scrollTop = 1452;
      fireEvent.scroll(viewport);
      assertAttached('stacked');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(mocks.stream.submit).not.toHaveBeenCalled();
    },
  );
  it('uses the scroll-to-bottom threshold for compact mode and keeps the editor and context mounted', async () => {
    mocks.stream.messages = [
      { id: 'message', type: 'human', content: 'Hello' },
    ];
    const view = renderChat();
    await act(async () => {});
    const viewport = view.container.querySelector<HTMLElement>(
      '[data-chatkit-root]',
    );
    if (!viewport) throw new Error('Missing viewport');
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, value: 2000 },
      clientHeight: { configurable: true, value: 500 },
    });
    const input = screen.getByRole('textbox');
    const shell = view.container.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    const context = view.container.querySelector(
      '[data-slot="composer-context-collapse"]',
    );
    viewport.scrollTop = 1451;
    fireEvent.scroll(viewport);
    expect(
      screen.getByRole('button', { name: 'chat.scrollToBottom' }),
    ).toBeVisible();
    expect(shell).toHaveAttribute('data-layout', 'compact');
    expect(context).toHaveAttribute('inert');
    expect(context).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('textbox')).toBe(input);
    viewport.scrollTop = 1452;
    fireEvent.scroll(viewport);
    expect(
      screen.queryByRole('button', { name: 'chat.scrollToBottom' }),
    ).toBeNull();
    expect(shell).toHaveAttribute('data-layout', 'stacked');
    expect(context).not.toHaveAttribute('inert');
    expect(screen.getByRole('textbox')).toBe(input);
    expect(
      view.container.querySelector('[data-slot="composer-context-collapse"]'),
    ).toBe(context);
  });
  it('updates composer surface geometry after a theme change', () => {
    mocks.theme = { radius: 'sharp', density: 'compact' };
    const { rerender } = render(
      <Chat clientSecret="secret" options={baseChatOptions} />,
    );
    const shell = document.querySelector('[data-slot="composer-input-shell"]');
    expect(shell).toHaveStyle(
      '--chat-panel-radius: 0px; --chat-density-scale: 0.75',
    );
    mocks.theme = { radius: 'pill', density: 'spacious' };
    rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
    expect(shell).toHaveStyle(
      '--chat-panel-radius: calc(var(--radius, 0.625rem) + 12px); --chat-density-scale: 1.25',
    );
  });

  it('renders the stacked WorkBuddy composer with project rail and context before send', async () => {
    const onProjectChange = vi.fn();
    render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-1"
        projectsEnabled
        connectorsEnabled
        onProjectChange={onProjectChange}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');
    expect(composerShell).toHaveClass('overflow-visible');
    expect(composerShell).not.toHaveClass('p-3', 'px-0.5', 'pt-0.5');
    expect(composerShell).not.toHaveClass(
      'border',
      'border-border',
      'focus-within:border-muted-foreground/30',
    );
    expect(composerShell).not.toHaveClass('shadow-sm', 'shadow-md');
    const chatComposer = document.querySelector(
      '[data-slot="chatkit-chat-composer"]',
    );
    expect(chatComposer).toHaveAttribute('data-position', 'centered');
    expect(chatComposer).toHaveClass(
      'mx-auto',
      'w-full',
      'max-w-2xl',
      'px-4',
      'pt-2',
      'pb-4',
    );
    expect(chatComposer).not.toHaveClass('p-2', 'py-2');
    expect(chatComposer).toHaveClass('mb-auto');
    expect(chatComposer).not.toHaveClass('my-auto');
    expect(chatComposer).not.toHaveClass('absolute', 'top-1/2');
    const editorSurface = document.querySelector(
      '[data-slot="composer-editor-surface"]',
    );
    expect(editorSurface).toBeInTheDocument();
    expect(editorSurface).toHaveClass(
      'bg-input-background',
      'shadow-composer-shell',
    );
    expect(editorSurface).not.toHaveClass('min-h-[10rem]');
    expect(editorSurface).not.toHaveClass('border', 'border-border');
    expect(editorSurface).not.toHaveClass('shadow-sm', 'shadow-md');
    const composerEditor = screen.getByRole('textbox');
    expect(editorSurface).toContainElement(composerEditor);
    expect(document.querySelector('[data-slot="composer-body"]')).toHaveClass(
      'min-h-10',
      'max-h-32',
    );
    expect(composerEditor).not.toHaveClass('min-h-20');
    const projectRail = document.querySelector<HTMLElement>(
      '[data-slot="composer-project-rail"]',
    );
    expect(projectRail).toBeInTheDocument();
    expect(projectRail).toHaveClass('h-10', 'items-center');
    expect(projectRail).not.toHaveClass('mt-1');
    const contextSurface = document.querySelector(
      '[data-slot="composer-context-surface"]',
    );
    expect(contextSurface?.closest('[data-slot="composer-input-shell"]')).toBe(
      composerShell,
    );
    expect(editorSurface?.closest('[data-slot="composer-input-shell"]')).toBe(
      composerShell,
    );
    expect(contextSurface).toContainElement(projectRail);
    expect(editorSurface).not.toContainElement(projectRail);

    const contextUsage = screen.getByTestId('context-usage');
    const send = screen.getByRole('button', { name: 'send' });
    expect(editorSurface).toContainElement(contextUsage);
    expect(editorSurface).toContainElement(send);
    expect(
      contextUsage.compareDocumentPosition(send) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId('project-selector'));
    expect(onProjectChange).toHaveBeenCalledOnce();
    expect(onProjectChange).toHaveBeenCalledWith('project-2', undefined, {
      resumeLatestConversation: true,
    });
  });

  it('keeps the file selector rail when the project selector is disabled', async () => {
    renderChat();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(
      document.querySelector('[data-slot="composer-file-selector"]'),
    ).toBeInTheDocument();
    expect(composerShell).not.toHaveClass('pb-composer-inset');
    expect(composerShell).toHaveClass('overflow-visible');
    expect(
      document.querySelector('[data-slot="composer-project-rail"]'),
    ).not.toBeInTheDocument();

    const contextSurface = document.querySelector(
      '[data-slot="composer-context-surface"]',
    );
    expect(contextSurface?.closest('[data-slot="composer-input-shell"]')).toBe(
      composerShell,
    );
    expect(contextSurface).toContainElement(
      document.querySelector('[data-slot="composer-file-selector"]'),
    );
  });

  it.each([
    { id: 'plan', label: 'Plan' },
    { id: 'goal', label: 'Goal' },
  ])(
    'reveals the $label tool remove action without reserving idle space',
    async ({ id, label }) => {
      renderChat({
        composer: {
          tools: [
            {
              id,
              label,
              icon: 'write',
              pinned: true,
            },
          ],
        },
      });

      await act(async () => {
        mocks.parentMessengerOptions?.onSetComposerValue?.({
          selectedToolId: id,
        });
      });

      const tool = document.querySelector(
        '[data-slot="composer-selected-tool"]',
      );
      const remove = document.querySelector(
        '[data-slot="composer-selected-tool-remove"]',
      );

      expect(tool).toHaveTextContent(label);
      expect(tool).not.toHaveClass('gap-1.5');
      expect(remove).toHaveClass(
        'w-0',
        'opacity-0',
        'group-hover/tool:w-4',
        'group-hover/tool:opacity-100',
        'focus-visible:w-4',
        'focus-visible:opacity-100',
      );
    },
  );

  it('returns the composer to the bottom after the conversation has messages', async () => {
    mocks.stream.messages = [
      {
        id: 'message-1',
        type: 'human',
        content: 'Hello',
      },
    ];

    renderChat();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const chatComposer = document.querySelector(
      '[data-slot="chatkit-chat-composer"]',
    );
    expect(chatComposer).toHaveAttribute('data-position', 'bottom');
    expect(chatComposer).toHaveClass('sticky', 'bottom-0');
    expect(chatComposer).not.toHaveClass('absolute', 'top-1/2');
  });
});
