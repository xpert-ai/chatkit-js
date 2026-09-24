import type { ReactElement } from 'react';
import { ThemeProvider } from '../../providers/Theme';
import { fireEvent, render as renderUI, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageFileActivity, FileChangeList } from './FileActivity';
import { ParentMessengerContext } from '../../providers/ParentMessenger';

const render = (ui: ReactElement) => renderUI(ui, { wrapper: ThemeProvider });

describe('message file activity', () => {
  it('updates both delivery and review surfaces with the theme', () => {
    const content = (
      <MessageFileActivity
        message={{
          id: 'm',
          content: '',
          taskSummary: {
            version: 1,
            outputs: [
              {
                id: 'out',
                title: 'report.json',
                kind: 'file',
                origin: 'tool',
                resource: {
                  type: 'artifact',
                  artifactId: 'a',
                  artifactVersionId: 'v',
                },
              },
            ],
            fileChanges: [
              {
                id: 'c',
                workspacePath: 'report.json',
                title: 'report.json',
                operation: 'added',
                coverage: 'observed',
                before: null,
                after: { sha256: 'a'.repeat(64), size: 1 },
              },
            ],
          },
        }}
      />
    );
    const { container, rerender } = render(
      <ThemeProvider theme={{ radius: 'sharp', density: 'compact' }}>
        {content}
      </ThemeProvider>,
    );
    const surface = container.querySelector(
      '[data-slot="message-file-activity"]',
    );
    expect(surface).toHaveStyle(
      '--chat-panel-radius: 0px; --chat-density-scale: 0.75',
    );
    expect(
      container.querySelector('[data-slot="file-delivery-card"]'),
    ).toHaveClass('chatkit-delivery-card');
    expect(
      container.querySelector('[data-slot="file-change-card"]'),
    ).toHaveClass('chatkit-file-change-card');
    rerender(
      <ThemeProvider theme={{ radius: 'round', density: 'normal' }}>
        {content}
      </ThemeProvider>,
    );
    expect(surface).toHaveStyle(
      '--chat-panel-radius: calc(var(--radius, 0.625rem) + 4px); --chat-density-scale: 1',
    );
  });

  it('renders only producer-declared cards, emitting the pinned resource to the host', () => {
    const sendEvent = vi.fn();
    render(
      <ParentMessengerContext.Provider
        value={{
          sendEvent,
          isParentAvailable: true,
          sendCommand: vi.fn(),
          registerOnSetOptions: vi.fn(),
          registerOnSetPetEnabled: vi.fn(),
          registerOnSetComposerValue: vi.fn(),
          registerOnSetRuntimeCapabilities: vi.fn(),
          registerOnFocusComposer: vi.fn(),
        }}
      >
        <MessageFileActivity
          message={{
            id: 'm',
            content: '',
            taskSummary: {
              version: 1,
              outputs: [
                {
                  id: 'out',
                  title: 'final.json',
                  kind: 'file',
                  mimeType: 'application/json',
                  origin: 'tool',
                  resource: {
                    type: 'artifact',
                    artifactId: 'a',
                    artifactVersionId: 'v1',
                  },
                },
                {
                  id: 'old',
                  title: 'spec.json',
                  kind: 'file',
                  origin: 'legacy',
                  resource: {
                    type: 'workspace_file',
                    workspacePath: 'spec.json',
                  },
                },
              ],
            },
          }}
        />
      </ParentMessengerContext.Provider>,
    );
    expect(screen.queryByText('spec.json')).not.toBeInTheDocument();
    expect(
      screen
        .getByRole('button', { name: /final.json/ })
        .querySelector('[data-file-type="json"]'),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /final.json/ }));
    expect(sendEvent).toHaveBeenCalledWith('public_event', [
      'effect',
      expect.objectContaining({
        data: {
          resource: {
            type: 'artifact',
            artifactId: 'a',
            artifactVersionId: 'v1',
          },
          messageId: 'm',
          title: 'final.json',
        },
      }),
    ]);
  });
  it('keeps unverified legacy changes visible with no invented review action', () => {
    render(
      <FileChangeList
        changes={[
          {
            id: 'c',
            workspacePath: 'patch.json',
            title: 'patch.json',
            operation: 'unknown',
            coverage: 'legacy',
          },
        ]}
        onOpenResource={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /patch.json/ })).toBeDisabled();
  });
});
