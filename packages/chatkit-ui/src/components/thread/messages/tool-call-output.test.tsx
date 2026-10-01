import * as React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToolOutputPresentation } from '@xpert-ai/chatkit-types';
import { setLanguage } from '../../../i18n';
import { ParentMessengerContext } from '../../../providers/ParentMessenger';
import { DefaultToolCallOutput, ToolCallValueBlock } from './tool-call-output';

const legacyOutput = [
  { type: 'text', text: 'Image prepared for inspection.' },
  {
    type: 'image_url',
    image_url: {
      url: `data:image/png;base64,${'PRIVATE_PIXELS'.repeat(1000)}`,
      detail: 'high',
    },
  },
];
const presentation: ToolOutputPresentation = {
  type: 'xpert.tool-output',
  version: 1,
  attachments: [
    {
      type: 'image',
      artifactId: 'artifact',
      artifactVersionId: 'version',
      sha256: 'a'.repeat(64),
      mimeType: 'image/png',
      source: 'tool',
      modelDetail: 'high',
      title: 'Construction detail',
    },
  ],
};

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

afterEach(() => {
  cleanup();
  setLanguage('en-US');
  vi.restoreAllMocks();
});

describe('tool output image display', () => {
  it('omits image bytes from tree, raw, and copy while preserving the useful text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    try {
      const { container } = render(<ToolCallValueBlock value={legacyOutput} />);
      expect(
        screen.getByText(/Embedded image data omitted: 1/),
      ).toBeInTheDocument();
      expect(container.textContent).toContain('Image prepared for inspection.');
      expect(container.innerHTML).not.toContain('PRIVATE_PIXELS');
      const raw = screen.getByRole('tab', { name: 'Raw' });
      fireEvent.mouseDown(raw, { button: 0 });
      fireEvent.click(raw);
      expect(container.textContent).toContain('[image/png image data omitted]');
      expect(container.innerHTML).not.toContain('PRIVATE_PIXELS');
      await act(async () =>
        fireEvent.click(screen.getByRole('button', { name: 'Copy' })),
      );
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(writeText.mock.calls[0][0]).toContain(
        'Image prepared for inspection.',
      );
      expect(writeText.mock.calls[0][0]).not.toContain('PRIVATE_PIXELS');
      expect(container.querySelector('img')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses the existing authorized attachment preview alongside sanitized legacy output', async () => {
    const sendCommand = vi.fn().mockResolvedValue({
      previewUrl: 'https://assets.example/authorized.png',
    });
    const { container } = render(
      <ParentMessengerContext.Provider value={messenger(sendCommand)}>
        <DefaultToolCallOutput
          content={{
            type: 'component',
            id: 'call',
            executionId: 'execution',
            data: { category: 'Tool' },
          }}
          data={{ output: legacyOutput, artifact: presentation }}
        />
      </ParentMessengerContext.Provider>,
    );
    expect(
      await screen.findByRole('button', { name: 'Open Construction detail' }),
    ).toBeInTheDocument();
    expect(screen.getByAltText('Construction detail')).toHaveAttribute(
      'src',
      'https://assets.example/authorized.png',
    );
    expect(sendCommand).toHaveBeenCalledWith('onToolOutputAttachmentPreview', {
      attachment: presentation.attachments[0],
      toolCallId: 'call',
      executionId: 'execution',
    });
    expect(screen.getByText(/Tool image ·/)).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('PRIVATE_PIXELS');
  });

  it('does not authorize arbitrary output or invalid attachment data as an image preview', () => {
    const sendCommand = vi.fn();
    const { container } = render(
      <ParentMessengerContext.Provider value={messenger(sendCommand)}>
        <DefaultToolCallOutput
          content={{
            type: 'component',
            id: 'call',
            data: { category: 'Tool' },
          }}
          data={{
            artifact: {
              ...presentation,
              attachments: [
                {
                  ...presentation.attachments[0],
                  previewUrl: 'data:image/png;base64,PRIVATE_PIXELS',
                },
              ],
            },
          }}
        />
      </ParentMessengerContext.Provider>,
    );
    expect(sendCommand).not.toHaveBeenCalled();
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('PRIVATE_PIXELS');
  });

  it('localizes the image summary and generic tool source in Chinese', async () => {
    setLanguage('zh-CN');
    const sendCommand = vi.fn().mockResolvedValue({
      previewUrl: 'https://assets.example/authorized.png',
    });
    render(
      <ParentMessengerContext.Provider value={messenger(sendCommand)}>
        <DefaultToolCallOutput
          content={{
            type: 'component',
            id: 'call',
            data: { category: 'Tool' },
          }}
          data={{ output: legacyOutput, artifact: presentation }}
        />
      </ParentMessengerContext.Provider>,
    );
    expect(screen.getByText(/已省略 1 项内嵌图片数据/)).toBeInTheDocument();
    expect(await screen.findByText(/工具图片 ·/)).toBeInTheDocument();
  });
});
