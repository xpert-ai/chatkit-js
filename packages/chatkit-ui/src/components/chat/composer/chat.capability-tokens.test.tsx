import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  insertComposerText,
  mocks,
  placeComposerCaretAtEnd,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat runtime capability tokens', () => {
  setupChatTest();
  it('renders only recommended runtime capabilities on human messages', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
          },
          {
            nodeKey: 'middleware-available',
            provider: 'available',
            label: 'Available Only',
          },
        ],
        subAgents: [],
      },
    );
    mocks.stream.messages = [
      {
        id: 'human-1',
        type: 'human',
        content: 'run it',
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { ids: [] },
          plugins: { nodeKeys: ['middleware-1'] },
          subAgents: { nodeKeys: [] },
          recommended: {
            skills: { ids: [] },
            plugins: { nodeKeys: ['middleware-1'] },
            subAgents: { nodeKeys: [] },
          },
        },
      },
      {
        id: 'human-2',
        type: 'human',
        content: 'available only',
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { ids: [] },
          plugins: { nodeKeys: ['middleware-available'] },
          subAgents: { nodeKeys: [] },
        },
      },
    ] as any;

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    expect(screen.getByText('Sandbox')).toBeInTheDocument();
    expect(screen.queryByText('Available Only')).not.toBeInTheDocument();
    expect(screen.getByText('run it')).toBeInTheDocument();
  });

  it('inserts slash-selected runtime capabilities as atomic composer tokens', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
            meta: {
              icon: {
                type: 'svg',
                value:
                  '<svg viewBox="0 0 16 16"><path d="M2 2h12v12H2z" /></svg>',
              },
            },
          },
        ],
        subAgents: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    let textbox = screen.getByRole('textbox');
    textbox = setComposerText(textbox, '/sand');
    fireEvent.mouseDown(await screen.findByText('Sandbox'));
    textbox = screen.getByRole('textbox');

    await waitFor(() =>
      expect(within(textbox).getByText('Sandbox')).toBeInTheDocument(),
    );
    expect(
      textbox.querySelector('[data-slot="runtime-capability-meta-icon"] svg'),
    ).toBeInTheDocument();

    placeComposerCaretAtEnd(textbox);
    fireEvent.keyDown(textbox, { key: 'Backspace' });

    await waitFor(() =>
      expect(screen.getByRole('textbox')).not.toHaveTextContent('Sandbox'),
    );

    setComposerText(screen.getByRole('textbox'), 'run it');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(
      mocks.stream.submit.mock.calls[0][0].input.runtimeCapabilities,
    ).toEqual({
      mode: 'allowlist',
      skills: { ids: [] },
      plugins: { nodeKeys: [] },
      subAgents: { nodeKeys: [] },
    });
  });

  it('inserts parent-requested runtime capabilities as atomic composer tokens', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-docs',
            workspaceId: 'workspace-1',
            label: 'documents',
            repositoryName: 'Documents',
            meta: {
              color: '#2563EB',
            },
          },
        ],
        plugins: [],
        subAgents: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    expect(mocks.parentMessengerOptions?.onSetComposerValue).toEqual(
      expect.any(Function),
    );
    await act(async () => {
      mocks.parentMessengerOptions?.onSetComposerValue?.({
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { workspaceId: 'workspace-1', ids: ['skill-docs'] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        },
        insertRuntimeCapabilities: true,
      });
    });

    await waitFor(() =>
      expect(
        within(screen.getByRole('textbox')).getByText('documents'),
      ).toBeInTheDocument(),
    );

    let textbox = screen.getByRole('textbox');
    const capabilityToken = textbox.querySelector(
      '[data-composer-capability-key]',
    );
    expect(capabilityToken).toHaveAttribute('data-capability-id', 'skill-docs');
    expect(capabilityToken).toHaveStyle({ color: '#2563EB' });
    expect(textbox.textContent).toContain('documents ');

    textbox = insertComposerText(textbox, 'create a doc');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(
      mocks.stream.submit.mock.calls[0][0].input.runtimeCapabilities,
    ).toEqual({
      mode: 'allowlist',
      skills: { workspaceId: 'workspace-1', ids: ['skill-docs'] },
      plugins: { nodeKeys: [] },
      subAgents: { nodeKeys: [] },
      recommended: {
        skills: { workspaceId: 'workspace-1', ids: ['skill-docs'] },
        plugins: { nodeKeys: [] },
        subAgents: { nodeKeys: [] },
      },
    });
  });

  it('places parent-requested runtime capability tokens before prompt text', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-docs',
            workspaceId: 'workspace-1',
            label: 'documents',
            repositoryName: 'Documents',
          },
        ],
        plugins: [],
        subAgents: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const prompt = 'Draft a project memo as a document';
    await act(async () => {
      mocks.parentMessengerOptions?.onSetComposerValue?.({
        text: prompt,
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { workspaceId: 'workspace-1', ids: ['skill-docs'] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        },
        insertRuntimeCapabilities: true,
      });
    });

    await waitFor(() =>
      expect(
        within(screen.getByRole('textbox')).getByText('documents'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('textbox')).toHaveTextContent(prompt);

    const textContent = screen.getByRole('textbox').textContent ?? '';
    expect(textContent).toContain(`documents ${prompt}`);
    expect(textContent.indexOf('documents')).toBeLessThan(
      textContent.indexOf(prompt),
    );
  });
});
