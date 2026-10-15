import type { RuntimeResourceCommand } from '@xpert-ai/xpert-sdk';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Chat,
  baseChatOptions,
  mocks,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';
import * as resourceCommandsHook from '../useResourceCommands';

const ref = { bindingId: 'binding', version: 'version', skillKey: 'bom' };
const selected = {
  revision: 2,
  resources: [{ bindingId: ref.bindingId, version: ref.version }],
};
const command = {
  skill: ref,
  packageName: 'operations',
  description: 'BOM',
  command: {
    label: 'BOM 管理',
    subcommands: { plan: { label: '审核计划' }, import: {} },
  },
};
describe('plugin commands in ChatKit conversations', () => {
  setupChatTest();
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });
  function setup(commandOverride: RuntimeResourceCommand = command) {
    mocks.stream.threadId = 'thread';
    mocks.stream.conversationId = 'conversation';
    mocks.stream.messages = [
      { id: 'old', type: 'human', content: 'Existing conversation' },
    ];
    mocks.stream.client.conversations.getRuntimeResources.mockResolvedValue(
      selected,
    );
    mocks.stream.client.assistants.getResourceCommands.mockResolvedValue([
      commandOverride,
    ]);
    renderChat({ composer: { resources: { enabled: true } } });
  }
  it('shows tags in an empty conversation, hides them as soon as messages arrive, and still offers label search through /', async () => {
    const commandResult = vi
      .spyOn(resourceCommandsHook, 'useResourceCommands')
      .mockReturnValue({ key: 'test', commands: [command], error: undefined });
    try {
      const { rerender } = renderChat();
      expect(
        screen.getByRole('button', { name: 'BOM 管理/审核计划' }),
      ).toBeVisible();
      // A new message can arrive before the host receives the thread ID.
      mocks.stream.messages = [
        { id: 'first', type: 'human', content: 'Started' },
      ];
      rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
      expect(
        document.querySelector('[data-slot="resource-command-shortcuts"]'),
      ).toBeNull();
      setComposerText(screen.getByRole('textbox'), '/审核');
      expect(
        await screen.findByRole('button', { name: /BOM 管理\/审核计划/ }),
      ).toBeVisible();
      expect(
        screen.queryByRole('button', { name: /BOM 管理\/import/ }),
      ).toBeNull();
      mocks.stream.threadId = 'existing-thread';
      mocks.stream.messages = [];
      rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
      expect(
        document.querySelector('[data-slot="resource-command-shortcuts"]'),
      ).toBeNull();
    } finally {
      commandResult.mockRestore();
    }
  });
  it('keeps /plan literal after the skill chip and submits pinned skill selection without turning on plan mode', async () => {
    setup();
    await waitFor(() =>
      expect(
        mocks.stream.client.assistants.getResourceCommands,
      ).toHaveBeenCalled(),
    );
    expect(
      document.querySelector('[data-slot="resource-command-shortcuts"]'),
    ).toBeNull();
    setComposerText(screen.getByRole('textbox'), '/bom/pla');
    fireEvent.mouseDown(
      await screen.findByRole('button', { name: /BOM 管理\/审核计划/ }),
    );
    const textbox = screen.getByRole('textbox');
    expect(
      textbox.querySelector('[data-composer-capability-key]'),
    ).not.toBeNull();
    expect(textbox.textContent).toContain('/plan');
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
      input: '/plan',
      resourceSkills: [ref],
      runtimeResources: selected,
    });
    expect(mocks.stream.submit.mock.calls[0][0].input).not.toHaveProperty(
      'planMode',
    );
  });
  it('allows a plain skill command with no typed arguments to be sent', async () => {
    setup({ ...command, command: { subcommands: {} } });
    await waitFor(() =>
      expect(
        mocks.stream.client.assistants.getResourceCommands,
      ).toHaveBeenCalled(),
    );
    setComposerText(screen.getByRole('textbox'), '/');
    fireEvent.mouseDown(await screen.findByRole('button', { name: /^bom / }));
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
      input: '',
      resourceSkills: [ref],
    });
  });
});
