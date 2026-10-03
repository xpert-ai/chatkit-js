import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createResourceCardContent,
  type ChatkitMessage,
} from '@xpert-ai/chatkit-types';
import { ThemeProvider } from '../../../providers/Theme';
import { AssistantMessage } from './ai';

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

describe('resource cards at the end of an Assistant reply', () => {
  it.each([false, true])(
    'holds incoming cards until streaming ends, then displays the complete set (collapseProcess=%s)',
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
      expect(screen.queryByTestId('resource-card')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Project created/ })).toBeNull();

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
      expect(screen.queryByTestId('resource-card')).not.toBeInTheDocument();

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
