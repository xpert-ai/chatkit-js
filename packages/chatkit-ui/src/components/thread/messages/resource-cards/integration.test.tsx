import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createResourceCardContent,
  type ChatkitMessage,
} from '@xpert-ai/chatkit-types';
import { ThemeProvider } from '../../../../providers/Theme';
import {
  disabledWorkbenchContext,
  WorkbenchContext,
} from '../../../../workbench/context';
import { changesReceipt } from '../../../../test/file-activity-fixtures';
import { AssistantMessage } from '../ai';

const project = createResourceCardContent({
  resource: { namespace: 'platform', type: 'project', id: 'project-1' },
  title: 'Project created',
  open: {
    target: 'assistant.project',
    projectId: 'project-1',
    viewKey: 'platform.project-tasks__timeline',
  },
});
const scheduler = createResourceCardContent({
  resource: { namespace: 'platform', type: 'task', id: 'task-1' },
  title: 'Daily briefing',
  open: {
    target: 'workbench.view',
    viewKey: 'platform.scheduler__detail',
    selectionId: 'task-1',
  },
});
const reply: ChatkitMessage & { type: 'assistant' } = {
  id: 'reply',
  type: 'assistant',
  content: [project],
  status: 'answering',
};

afterEach(cleanup);

describe('resource cards throughout an Assistant reply', () => {
  it.each(['bubbles', 'transcript'] as const)(
    'keeps file delivery and review cards standalone and opens the saved HTML version in %s mode',
    (mode) => {
      const openHtmlArtifact = vi.fn(() => true);
      const { container } = render(
        <ThemeProvider>
          <WorkbenchContext.Provider
            value={{ ...disabledWorkbenchContext, openHtmlArtifact }}
          >
            <AssistantMessage
              mode={mode}
              message={{
                ...reply,
                status: 'success',
                content: [
                  { type: 'text', text: 'Your page is ready.' },
                  changesReceipt,
                ],
                taskSummary: {
                  version: 1,
                  outputs: [
                    {
                      id: 'page',
                      title: 'index.html',
                      kind: 'file',
                      mimeType: 'text/html',
                      origin: 'tool',
                      resource: {
                        type: 'artifact',
                        artifactId: 'page',
                        artifactVersionId: 'saved-version',
                      },
                    },
                  ],
                },
              }}
            />
          </WorkbenchContext.Provider>
        </ThemeProvider>,
      );
      const delivery = screen.getByRole('button', { name: /index.html/ });
      const review = container.querySelector('[data-slot="file-change-card"]');
      expect(delivery).toBeVisible();
      expect(delivery.closest('[data-message-bubble]')).toBeNull();
      expect(review).toBeVisible();
      expect(review?.closest('[data-message-bubble]')).toBeNull();
      const textBubble = screen
        .getByText('Your page is ready.')
        .closest('[data-message-bubble]');
      if (mode === 'bubbles') expect(textBubble).not.toBeNull();
      else expect(textBubble).toBeNull();
      fireEvent.click(delivery);
      expect(openHtmlArtifact).toHaveBeenCalledWith(
        { artifactId: 'page', artifactVersionId: 'saved-version' },
        'index.html',
      );
    },
  );

  it('shows and updates a plugin resource during streaming without nesting another message bubble', () => {
    const execution = createResourceCardContent({
      resource: {
        namespace: 'example.reports',
        type: 'report',
        id: 'attempt',
      },
      title: 'Data totals',
      description: 'Implementation · Codex · Running',
      open: {
        target: 'workbench.view',
        viewKey: 'platform.project-tasks__timeline',
      },
    });
    const view = (card: typeof execution, isStreaming: boolean) => (
      <ThemeProvider>
        <AssistantMessage
          mode="bubbles"
          message={{ ...reply, content: [project, card] }}
          isStreaming={isStreaming}
        />
      </ThemeProvider>
    );
    const { rerender } = render(view(execution, true));
    expect(screen.getAllByTestId('resource-card')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: /Open Data totals/ }),
    ).toBeVisible();
    expect(
      screen
        .getAllByTestId('resource-card')[1]
        .closest('[data-message-bubble]'),
    ).toBeNull();
    const updated = {
      ...execution,
      data: {
        ...execution.data,
        description: 'Implementation · Codex · Execution succeeded',
      },
    };
    rerender(view(updated, true));
    expect(screen.getAllByTestId('resource-card')).toHaveLength(2);
    expect(screen.getByText(updated.data.description)).toBeVisible();
    rerender(view(updated, false));
    expect(screen.getAllByTestId('resource-card')).toHaveLength(2);
  });
  it.each([false, true])(
    'shows committed cards immediately and deduplicates later snapshots (collapseProcess=%s)',
    (collapseProcess) => {
      const view = (message: typeof reply, isStreaming: boolean) => (
        <ThemeProvider>
          <AssistantMessage
            message={message}
            collapseProcess={collapseProcess}
            isStreaming={isStreaming}
          />
        </ThemeProvider>
      );
      const { rerender } = render(view(reply, true));
      expect(screen.getAllByTestId('resource-card')).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: /Project created/ }),
      ).toBeVisible();

      const completed: typeof reply = {
        ...reply,
        status: 'success',
        content: [
          { type: 'text', text: 'Both resources are ready.' },
          project,
          scheduler,
          { ...project, data: { ...project.data, title: 'Updated project' } },
        ],
      };
      // The end event can arrive before the stream itself has finished.
      rerender(view(completed, true));
      expect(screen.getByText('Both resources are ready.')).toBeVisible();
      expect(screen.getAllByTestId('resource-card')).toHaveLength(2);

      rerender(view(completed, false));
      expect(screen.getAllByTestId('resource-card')).toHaveLength(2);
      expect(screen.getByText('Updated project')).toBeVisible();
      expect(screen.getByText('Daily briefing')).toBeVisible();
      expect(screen.queryByText('Project created')).not.toBeInTheDocument();
    },
  );

  it.each(['success', 'interrupted', 'error'])(
    'retains saved cards after output stops or history reloads (status=%s)',
    (status) => {
      render(
        <ThemeProvider>
          <AssistantMessage
            message={{ ...reply, status, historical: true }}
            isStreaming={false}
            isThreadRunning
          />
        </ThemeProvider>,
      );
      // Running a later reply must not hide this reply's saved resources.
      expect(screen.getAllByTestId('resource-card')).toHaveLength(1);
      expect(screen.getByText('Project created')).toBeVisible();
    },
  );
});
