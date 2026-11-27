import * as React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  TMessageContentComponent,
  ToolOutputImageAttachment,
} from '@xpert-ai/chatkit-types';
import { createToolComponent, render } from './ai.test-fixture';
import { ToolComponentGroup } from './tool-component-group';
import { ParentMessengerContext } from '../../../providers/ParentMessenger';
import { ThemeProvider } from '../../../providers/Theme';
import { parseToolCallPresentation } from '../../../lib/tool-call-presentation';

const image: ToolOutputImageAttachment = {
  type: 'image',
  artifactId: 'artifact',
  artifactVersionId: 'version',
  sha256: 'a'.repeat(64),
  mimeType: 'image/png',
  source: 'sandbox',
  modelDetail: 'low',
  title: 'chart.png',
  width: 64,
  height: 64,
};
const call = createToolComponent('call-image', {
  title: 'View image',
  tool: 'view_image',
  toolPresentation: 'redacted',
  output: 'Image read',
  presentation: {
    version: 1,
    activity: { kind: 'image', action: 'view' },
    images: [image],
  },
});
type Parent = NonNullable<
  React.ComponentProps<typeof ParentMessengerContext.Provider>['value']
>;
function messenger(sendCommand: Parent['sendCommand']): Parent {
  const unregister = () => () => undefined;
  return {
    isParentAvailable: true,
    sendCommand,
    updateComposer: vi.fn(),
    focusComposer: vi.fn(),
    sendEvent: vi.fn(),
    registerOnSetOptions: unregister,
    registerOnSetPetEnabled: unregister,
    registerOnSetComposerValue: unregister,
    registerOnSetRuntimeCapabilities: unregister,
    registerOnFocusComposer: unregister,
  };
}

describe('image activity timeline', () => {
  it('loads only after expanding the group, displays a thumbnail and keeps parameters secondary', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ previewUrl: 'https://assets.example/chart.png' });
    render(
      <ParentMessengerContext.Provider value={messenger(send)}>
        <ToolComponentGroup items={[call, call]} hasFollowingItem />
      </ParentMessengerContext.Provider>,
    );
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: /View images.*1 call.*1 image/ }),
    );
    const thumbnail = await screen.findByRole('button', {
      name: 'Open chart.png',
    });
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://assets.example/chart.png',
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1].toolCallId).toBe('call-image');
    expect(
      screen.getByText('Parameters and result').closest('details'),
    ).not.toHaveAttribute('open');
    fireEvent.click(thumbnail);
    const dialog = screen.getByRole('dialog', { name: 'chart.png' });
    expect(within(dialog).getByRole('img')).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Close image preview' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(thumbnail).toHaveFocus());
  });

  it('preserves a user-collapsed call when streaming replaces its image descriptors', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ previewUrl: 'https://assets.example/chart.png' });
    const host = messenger(send);
    const view = (item: TMessageContentComponent) => (
      <ParentMessengerContext.Provider value={host}>
        <ToolComponentGroup items={[item]} hasFollowingItem={false} />
      </ParentMessengerContext.Provider>
    );
    const { rerender } = render(view(call));
    await screen.findByRole('button', { name: 'Open chart.png' });
    fireEvent.click(
      screen.getByRole('button', { name: /^View image Completed/ }),
    );
    rerender(view(structuredClone(call)));
    expect(
      screen.getByRole('button', { name: /^View image Completed/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not load running images and reveals them after a successful streamed update', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ previewUrl: 'https://assets.example/chart.png' });
    const host = messenger(send);
    const view = (status: 'running' | 'success') => (
      <ParentMessengerContext.Provider value={host}>
        <ToolComponentGroup
          items={[
            createToolComponent('call-image', {
              title: 'View image',
              status,
              presentation: {
                version: 1,
                activity: { kind: 'image', action: 'view' },
                images: [image],
              },
            }),
          ]}
          hasFollowingItem={false}
          isThreadRunning
        />
      </ParentMessengerContext.Provider>
    );
    const { rerender } = render(view('running'));
    expect(send).not.toHaveBeenCalled();
    rerender(view('success'));
    await screen.findByRole('button', { name: 'Open chart.png' });
    expect(send).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole('button', { name: /View images.*1 call/ }),
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('Parameters and result')).not.toBeInTheDocument();
  });

  it('counts repeated immutable images once while retaining distinct calls', () => {
    render(
      <ToolComponentGroup
        items={[call, { ...call, id: 'another-call' }]}
        hasFollowingItem
      />,
    );
    expect(
      screen.getByRole('button', { name: /2 calls.*1 image/ }),
    ).toBeVisible();
  });

  it.each([
    { images: [{ ...image, previewUrl: 'https://assets.example/chart.png' }] },
    { images: [{ ...image, mimeType: 'image/svg+xml' }] },
    { images: [{ ...image, sha256: 'invalid' }] },
    { images: Array.from({ length: 21 }, () => image) },
  ])('rejects invalid timeline image descriptors %#', ({ images }) => {
    expect(parseToolCallPresentation({ version: 1, images })).toBeUndefined();
  });

  it('does not treat a private legacy artifact as permission to display an image', () => {
    const send = vi.fn();
    render(
      <ParentMessengerContext.Provider value={messenger(send)}>
        <ToolComponentGroup
          items={[
            createToolComponent('legacy', {
              title: 'View image',
              artifact: {
                type: 'xpert.tool-output',
                version: 1,
                attachments: [image],
              },
            }),
          ]}
          hasFollowingItem={false}
        />
      </ParentMessengerContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^View image/ }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('counts images separately from calls and keeps failures out of the preview', () => {
    render(
      <ToolComponentGroup
        items={[
          call,
          createToolComponent('failed', {
            title: 'Failed image',
            status: 'fail',
            error: 'Access denied',
            presentation: {
              version: 1,
              activity: { kind: 'image', action: 'view' },
              images: [image],
            },
          }),
        ]}
        hasFollowingItem={false}
      />,
    );
    expect(
      screen.getByRole('button', {
        name: /View images.*2 calls.*1 image.*Partially failed/i,
      }),
    ).toBeVisible();
    expect(screen.getAllByText('Parameters and result')).toHaveLength(1);
  });

  it('shows a recoverable rejection and applies live theme tokens to the image portal', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('Forbidden'))
      .mockResolvedValue({ previewUrl: 'https://assets.example/chart.png' });
    const host = messenger(send);
    const view = (dark: boolean) => (
      <ThemeProvider
        theme={{
          colorScheme: dark ? 'dark' : 'light',
          radius: dark ? 'sharp' : 'round',
          density: dark ? 'compact' : 'spacious',
        }}
      >
        <ParentMessengerContext.Provider value={host}>
          <ToolComponentGroup items={[call]} hasFollowingItem={false} />
        </ParentMessengerContext.Provider>
      </ThemeProvider>
    );
    const { rerender } = render(view(false));
    expect(await screen.findByText('Preview unavailable')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Open chart.png' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    const original = dialog.getAttribute('style');
    rerender(view(true));
    expect(dialog.getAttribute('style')).not.toBe(original);
    expect(dialog.getAttribute('style')).toContain('--chat-panel-radius: 0');
    expect(dialog.style.getPropertyValue('--chat-density-scale')).toBe('0.75');
  });
});
