import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  baseChatOptions,
  Chat,
  mocks,
  renderChat,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat composer layout', () => {
  setupChatTest();
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
    expect(composerShell).toHaveClass(
      'bg-composer-shell',
      'px-composer-inset',
      'pt-composer-inset',
      'rounded-composer-shell',
      'shadow-composer-shell',
    );
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
      'bg-background',
      'min-h-[6.5rem]',
      'rounded-composer-editor',
    );
    expect(editorSurface).not.toHaveClass('min-h-[10rem]');
    expect(editorSurface).not.toHaveClass('border', 'border-border');
    expect(editorSurface).not.toHaveClass('shadow-sm', 'shadow-md');
    const composerEditor = screen.getByRole('textbox');
    expect(document.querySelector('[data-slot="composer-body"]')).toHaveClass(
      'min-h-10',
      'max-h-32',
    );
    expect(composerEditor).not.toHaveClass('min-h-20');
    const projectRail = document.querySelector(
      '[data-slot="composer-project-rail"]',
    );
    expect(projectRail).toBeInTheDocument();
    expect(projectRail).toHaveClass('h-10', 'items-center');
    expect(projectRail).not.toHaveClass('mt-1');

    const contextUsage = screen.getByTestId('context-usage');
    const send = screen.getByRole('button', { name: 'send' });
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
    expect(composerShell).toHaveClass(
      'px-composer-inset',
      'pt-composer-inset',
      'rounded-composer-shell',
    );
    expect(
      document.querySelector('[data-slot="composer-project-rail"]'),
    ).not.toBeInTheDocument();

    expect(
      document.querySelector('[data-slot="composer-editor-surface"]'),
    ).toHaveClass('rounded-composer-editor');
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
