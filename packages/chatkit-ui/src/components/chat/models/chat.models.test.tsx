import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  mocks,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat hosted and custom models', () => {
  setupChatTest();
  it('loads hosted models, submits the selection, and saves picker changes', async () => {
    mocks.stream.client.assistants.getModels.mockResolvedValue({
      models: [
        {
          id: 'mdl_primary',
          label: 'Primary',
          default: true,
          avatar: {
            url: 'https://cdn.example.com/provider-primary.svg',
            background: '#f7f7f7',
          },
        },
        {
          id: 'mdl_fast',
          label: 'Fast',
          avatar: { url: 'https://cdn.example.com/provider-fast.svg' },
        },
      ],
      selected_model_id: 'mdl_primary',
      preference_persistable: true,
    });

    renderChat();

    const picker = await screen.findByRole('button', {
      name: 'chat.modelPicker.label: Primary',
    });
    const actionBar = picker.closest('[data-slot="composer-action-bar"]');
    expect(actionBar).not.toBeNull();
    expect(picker.closest('[data-slot="chat-footer"]')).toBeNull();
    const contextUsage = within(actionBar as HTMLElement).getByTestId(
      'context-usage',
    );
    const sendButton = within(actionBar as HTMLElement).getByRole('button', {
      name: 'send',
    });
    expect(
      contextUsage.compareDocumentPosition(picker) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      picker.compareDocumentPosition(sendButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    picker.focus();
    fireEvent.keyDown(picker, { key: 'Enter', code: 'Enter' });
    expect(
      await screen.findByText('chat.modelPicker.futureTitle'),
    ).toBeInTheDocument();
    expect(screen.getByText('chat.modelPicker.title')).toHaveClass(
      'text-popover-foreground',
    );
    expect(
      within(screen.getByRole('menuitemradio', { name: /Primary/ })).getByText(
        'Primary',
      ),
    ).toHaveClass('text-popover-foreground');
    expect(screen.getByText('chat.modelPicker.futureTitle')).toHaveClass(
      'text-popover-foreground',
    );
    const primaryOption = screen.getByRole('menuitemradio', {
      name: /Primary/,
    });
    expect(primaryOption.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/provider-primary.svg',
    );
    const pickerHeader = screen
      .getByText('chat.modelPicker.title')
      .closest('div');
    expect(pickerHeader?.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/provider-primary.svg',
    );
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Fast' }));

    await waitFor(() =>
      expect(
        mocks.stream.client.assistants.setModelPreference,
      ).toHaveBeenCalledWith('assistant-1', 'mdl_fast'),
    );

    setComposerText(screen.getByRole('textbox'), 'use fast');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    expect(mocks.stream.submit.mock.calls[0]?.[0]).toMatchObject({
      input: { input: 'use fast', model: 'mdl_fast' },
    });
  });

  it('treats a missing hosted model endpoint as an unsupported optional capability', async () => {
    let rejectCatalog!: (reason?: unknown) => void;
    mocks.stream.client.assistants.getModels.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectCatalog = reject;
      }),
    );

    renderChat();
    await waitFor(() =>
      expect(mocks.stream.client.assistants.getModels).toHaveBeenCalledWith(
        'assistant-1',
        { signal: expect.any(AbortSignal) },
      ),
    );

    await act(async () => {
      rejectCatalog({ status: 404 });
      await Promise.resolve();
    });

    expect(mocks.parentSendEvent).not.toHaveBeenCalledWith('public_event', [
      'error',
      expect.any(Object),
    ]);
  });

  it('still reports hosted model catalog failures other than not found', async () => {
    mocks.stream.client.assistants.getModels.mockRejectedValue({ status: 500 });

    renderChat();

    await waitFor(() =>
      expect(mocks.parentSendEvent).toHaveBeenCalledWith('public_event', [
        'error',
        { error: expect.any(Error) },
      ]),
    );
  });

  it('keeps a programmatic model selection made before the hosted catalog loads', async () => {
    let resolveCatalog!: (value: {
      models: Array<{ id: string; label: string; default?: boolean }>;
      selected_model_id: string;
      preference_persistable: boolean;
    }) => void;
    mocks.stream.client.assistants.getModels.mockReturnValue(
      new Promise((resolve) => {
        resolveCatalog = resolve;
      }),
    );

    renderChat();
    act(() => {
      mocks.parentMessengerOptions?.onSetComposerValue?.({
        selectedModelId: 'mdl_fast',
      });
    });
    act(() => {
      resolveCatalog({
        models: [
          { id: 'mdl_primary', label: 'Primary', default: true },
          { id: 'mdl_fast', label: 'Fast' },
        ],
        selected_model_id: 'mdl_primary',
        preference_persistable: true,
      });
    });

    expect(
      await screen.findByRole('button', {
        name: 'chat.modelPicker.label: Fast',
      }),
    ).toBeInTheDocument();
  });

  it('uses custom composer models without calling the hosted catalog', async () => {
    renderChat({
      composer: {
        models: [
          { id: 'custom-primary', label: 'Custom Primary', default: true },
          { id: 'custom-fast', label: 'Custom Fast' },
        ],
      },
    });

    expect(
      await screen.findByRole('button', {
        name: 'chat.modelPicker.label: Custom Primary',
      }),
    ).toBeInTheDocument();
    expect(mocks.stream.client.assistants.getModels).not.toHaveBeenCalled();
  });

  it('does not silently select another model when the hosted Primary is unavailable', async () => {
    mocks.stream.client.assistants.getModels.mockResolvedValue({
      models: [
        {
          id: 'mdl_primary',
          label: 'Primary',
          default: false,
          disabled: true,
        },
        { id: 'mdl_fast', label: 'Fast' },
      ],
      selected_model_id: null,
      preference_persistable: true,
    });

    renderChat();
    await waitFor(() =>
      expect(mocks.stream.setSelectedModelId.mock.calls.length).toBeGreaterThan(
        1,
      ),
    );
    expect(mocks.stream.selectedModelId).toBeNull();

    setComposerText(screen.getByRole('textbox'), 'keep primary behavior');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    const payload = mocks.stream.submit.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      input: { input: 'keep primary behavior' },
    });
    expect(payload?.input?.model).toBeUndefined();
    expect(payload?.state?.human?.model).toBeUndefined();
  });
});
