import * as React from 'react';

import type { ToolOutputPresentation } from '@xpert-ai/chatkit-types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ParentMessengerContext } from '../../../providers/ParentMessenger';
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
