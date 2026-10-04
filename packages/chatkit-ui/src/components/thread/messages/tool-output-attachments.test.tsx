import * as React from 'react';

import type { ToolOutputPresentation } from '@xpert-ai/chatkit-types';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ParentMessengerContext } from '../../../providers/ParentMessenger';
import { parseToolOutputPresentation } from '../../../lib/tool-output-attachments';
import { ToolOutputAttachments } from './tool-output-attachments';

const presentation: ToolOutputPresentation = {
  type: 'xpert.tool-output',
  version: 1,
  attachments: [
    {
      type: 'image',
      artifactId: 'artifact-1',
      artifactVersionId: 'version-1',
      sha256: 'a'.repeat(64),
      mimeType: 'image/png',
      width: 1280,
      height: 720,
      title: 'Flange loading sketch',
      alt: 'Sketch showing flange loading dimensions',
      source: 'knowledge-document',
      modelDetail: 'high',
      anchors: {
        page: 75,
        visualAssetId: 'visual-asset-1',
      },
    },
  ],
};

type ParentMessengerValue = NonNullable<
  React.ComponentProps<typeof ParentMessengerContext.Provider>['value']
>;

function parentMessengerValue(
  sendCommand: ParentMessengerValue['sendCommand'],
): ParentMessengerValue {
  const unregister = () => () => undefined;
  return {
    isParentAvailable: true,
    updateComposer: vi.fn().mockResolvedValue(undefined),
    focusComposer: vi.fn().mockResolvedValue(undefined),
    sendCommand,
    sendEvent: vi.fn(),
    registerOnSetOptions: unregister,
    registerOnSetPetEnabled: unregister,
    registerOnSetComposerValue: unregister,
    registerOnSetRuntimeCapabilities: unregister,
    registerOnFocusComposer: unregister,
  };
}

describe('ToolOutputAttachments', () => {
  it('keeps the image and open dialog mounted while streamed text recreates attachment data', async () => {
    const sendCommand = vi.fn().mockResolvedValue({
      previewUrl: 'https://assets.example/flange.png?token=short-lived',
    });
    function StreamingMessage({ text }: { text: string }) {
      const parsed = parseToolOutputPresentation(presentation);
      if (!parsed) throw new Error('Invalid test presentation');
      return (
        <ParentMessengerContext.Provider
          value={parentMessengerValue(sendCommand)}
        >
          <ToolOutputAttachments
            presentation={parsed}
            toolCallId="tool-call-1"
            executionId="execution-1"
          />
          <p>{text}</p>
        </ParentMessengerContext.Provider>
      );
    }
    const { rerender } = render(<StreamingMessage text="Looking" />);
    const image = await screen.findByAltText(
      'Sketch showing flange loading dimensions',
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Open Flange loading sketch/i }),
    );
    const dialog = screen.getByRole('dialog');

    for (const text of [
      'Looking at',
      'Looking at the',
      'Looking at the screenshot',
    ]) {
      rerender(<StreamingMessage text={text} />);
      expect(image).toBeInTheDocument();
      expect(dialog).toBeInTheDocument();
      expect(
        within(screen.getByTestId('tool-output-attachments')).getByRole('img', {
          hidden: true,
        }),
      ).toBe(image);
    }
    expect(sendCommand).toHaveBeenCalledTimes(1);
  });

  it('resolves again when the execution or attachment version changes', async () => {
    const sendCommand = vi
      .fn()
      .mockResolvedValueOnce({ previewUrl: 'https://assets.example/first.png' })
      .mockResolvedValueOnce({
        previewUrl: 'https://assets.example/second.png',
      })
      .mockResolvedValueOnce({
        previewUrl: 'https://assets.example/new-version.png',
      });
    function preview(executionId: string, value = presentation) {
      return (
        <ParentMessengerContext.Provider
          value={parentMessengerValue(sendCommand)}
        >
          <ToolOutputAttachments
            presentation={value}
            toolCallId="tool-call-1"
            executionId={executionId}
          />
        </ParentMessengerContext.Provider>
      );
    }
    const { rerender } = render(preview('execution-1'));
    expect(await screen.findByRole('img')).toHaveAttribute(
      'src',
      'https://assets.example/first.png',
    );
    rerender(preview('execution-2'));
    await waitFor(() =>
      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        'https://assets.example/second.png',
      ),
    );
    const updated = {
      ...presentation,
      attachments: presentation.attachments.map((attachment) => ({
        ...attachment,
        artifactVersionId: 'version-2',
        sha256: 'b'.repeat(64),
      })),
    };
    rerender(preview('execution-2', updated));
    await waitFor(() =>
      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        'https://assets.example/new-version.png',
      ),
    );
    expect(sendCommand).toHaveBeenCalledTimes(3);
    expect(sendCommand).toHaveBeenLastCalledWith(
      'onToolOutputAttachmentPreview',
      {
        attachment: updated.attachments[0],
        toolCallId: 'tool-call-1',
        executionId: 'execution-2',
      },
    );
  });

  it('resolves a private preview through the host and opens the image dialog', async () => {
    const sendCommand = vi.fn().mockResolvedValue({
      previewUrl: 'https://assets.example/flange.png?token=short-lived',
    });

    render(
      <ParentMessengerContext.Provider
        value={parentMessengerValue(sendCommand)}
      >
        <ToolOutputAttachments
          presentation={presentation}
          toolCallId="tool-call-1"
          executionId="execution-1"
        />
      </ParentMessengerContext.Provider>,
    );

    await waitFor(() => {
      expect(sendCommand).toHaveBeenCalledWith(
        'onToolOutputAttachmentPreview',
        {
          attachment: presentation.attachments[0],
          toolCallId: 'tool-call-1',
          executionId: 'execution-1',
        },
      );
    });

    const openButton = await screen.findByRole('button', {
      name: /Open Flange loading sketch/i,
    });
    expect(
      screen.getByAltText('Sketch showing flange loading dimensions'),
    ).toHaveAttribute(
      'src',
      'https://assets.example/flange.png?token=short-lived',
    );

    fireEvent.click(openButton);

    expect(
      screen.getByRole('dialog', { name: 'Flange loading sketch' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close image preview' }),
    ).toBeInTheDocument();
  });

  it('shows a recoverable state when the trusted host rejects preview access', async () => {
    const sendCommand = vi.fn().mockRejectedValue(new Error('forbidden'));

    render(
      <ParentMessengerContext.Provider
        value={parentMessengerValue(sendCommand)}
      >
        <ToolOutputAttachments presentation={presentation} />
      </ParentMessengerContext.Provider>,
    );

    expect(await screen.findByText('Preview unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(sendCommand).toHaveBeenCalledTimes(2));
  });

  it('does not loop preview resolution when a resolved image fails to load', async () => {
    const sendCommand = vi.fn().mockResolvedValue({
      previewUrl: 'https://assets.example/broken.png?token=short-lived',
    });

    render(
      <ParentMessengerContext.Provider
        value={parentMessengerValue(sendCommand)}
      >
        <ToolOutputAttachments presentation={presentation} />
      </ParentMessengerContext.Provider>,
    );

    const image = await screen.findByAltText(
      'Sketch showing flange loading dimensions',
    );
    fireEvent.error(image);

    expect(await screen.findByText('Preview unavailable')).toBeInTheDocument();
    expect(sendCommand).toHaveBeenCalledTimes(1);
  });
});
