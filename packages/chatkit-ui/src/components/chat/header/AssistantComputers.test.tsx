import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { AssistantComputers } from './AssistantComputers';
import {
  WorkbenchContext,
  disabledWorkbenchContext,
} from '../../../workbench/context';

const mocks = vi.hoisted(() => ({
  getData: vi.fn(),
  stream: {
    assistantId: 'assistant-a',
    projectId: 'project-a',
    conversationId: 'conversation-a',
    runtimeScopeReady: true,
  },
}));
vi.mock('../../../providers/Stream', () => ({
  useStreamContext: () => ({
    ...mocks.stream,
    client: { viewHosts: { getData: mocks.getData } },
  }),
}));
const cloudView: XpertExtensionViewManifest = {
  key: 'ProComputer__pro-computer',
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  title: { en_US: 'Computer' },
  source: { provider: 'ProComputer' },
  dataSource: { mode: 'platform' },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'pro-computer' },
    dataSource: { mode: 'platform' },
  },
};
function harness(views = [cloudView], loading = false) {
  const onSelect = vi.fn(),
    onNavigate = vi.fn(),
    onOpenLocal = vi.fn();
  const renderContent = () => (
    <WorkbenchContext.Provider
      value={{
        ...disabledWorkbenchContext,
        available: true,
        loading,
        viewMenu: { views, locale: 'en-US', onSelect },
      }}
    >
      <AssistantComputers
        computers={{
          cloud: { viewKey: 'ProComputer__pro-computer' },
          local: { name: 'My Mac', status: 'disabled' },
        }}
        onNavigate={onNavigate}
        onOpenLocal={onOpenLocal}
      />
    </WorkbenchContext.Provider>
  );
  return { renderContent, onSelect, onNavigate, onOpenLocal };
}
beforeEach(() => {
  mocks.getData.mockReset().mockResolvedValue({ item: { state: 'ready' } });
  mocks.stream.conversationId = 'conversation-a';
});
describe('Assistant computer shortcuts', () => {
  it('reads authorized Computer status with the current runtime scope and opens its exact View', async () => {
    const h = harness();
    render(h.renderContent());
    const cloud = await screen.findByRole('button', {
      name: 'Server Computer Running',
    });
    expect(mocks.getData).toHaveBeenCalledWith(
      'agent',
      'assistant-a',
      'ProComputer__pro-computer',
      {},
      expect.objectContaining({
        runtimeScope: {
          projectId: 'project-a',
          conversationId: 'conversation-a',
        },
      }),
    );
    fireEvent.click(cloud);
    expect(h.onSelect).toHaveBeenCalledWith('ProComputer__pro-computer');
    expect(h.onNavigate).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole('button', { name: 'My Mac Local Shell · Disabled' }),
    );
    expect(h.onOpenLocal).toHaveBeenCalledOnce();
  });
  it('does not query unavailable or unresolved Views and leaves local controls available', () => {
    const h = harness([]);
    render(h.renderContent());
    expect(
      screen.getByRole('button', {
        name: 'Server Computer Unavailable for this assistant',
      }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /My Mac/ })).toBeEnabled();
    expect(mocks.getData).not.toHaveBeenCalled();
  });
  it('distinguishes an unstarted Computer from a status error without preventing opening the View', async () => {
    mocks.getData.mockResolvedValueOnce({
      item: { state: 'needs_environment' },
    });
    const h = harness();
    const result = render(h.renderContent());
    expect(
      await screen.findByRole('button', {
        name: 'Server Computer Not started',
      }),
    ).toBeEnabled();
    mocks.getData.mockRejectedValue(new Error('Not authorized'));
    mocks.stream.conversationId = 'conversation-b';
    result.rerender(h.renderContent());
    expect(
      await screen.findByRole('button', {
        name: 'Server Computer Status unavailable',
      }),
    ).toBeEnabled();
  });
  it('ignores stale status responses when switching conversations', async () => {
    let finish: (value: { item: { state: string } }) => void = () => undefined;
    mocks.getData
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue({ item: { state: 'stopped' } });
    const h = harness();
    const result = render(h.renderContent());
    mocks.stream.conversationId = 'conversation-b';
    result.rerender(h.renderContent());
    await screen.findByRole('button', { name: 'Server Computer Stopped' });
    finish({ item: { state: 'ready' } });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Server Computer Stopped' }),
      ).toBeVisible(),
    );
  });
});
