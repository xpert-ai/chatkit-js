import { createResourceCardContent } from '@xpert-ai/chatkit-types';
import { describe, expect, it } from 'vitest';
import { useResourceCardActions } from '../resource-cards/context';
import { fixture, setupWorkbenchTests } from './WorkbenchShell.test-fixture';

const {
  React,
  fireEvent,
  render,
  screen,
  waitFor,
  vi,
  mocks,
  WorkbenchShell,
  WorkbenchToggleButton,
  useWorkbench,
  manifest,
  baseOptions,
  setObservedWidth,
} = fixture;

const projectView = {
  ...manifest,
  key: 'platform.project-tasks__timeline',
  title: { en_US: 'Project tasks' },
};

function ProjectLinks() {
  const workbench = useWorkbench();
  const resources = useResourceCardActions();
  const [opened, setOpened] = React.useState(false);
  const card = createResourceCardContent({
    resource: { namespace: 'platform', type: 'project', id: 'project-1' },
    title: 'Current project',
    open: {
      target: 'assistant.project',
      projectId: 'project-1',
      viewKey: projectView.key,
    },
  });
  return (
    <>
      <button
        onClick={async () => {
          const result = await workbench.openProject?.(
            'project-1',
            projectView.key,
          );
          if (
            result &&
            typeof result === 'object' &&
            'success' in result &&
            result.success
          )
            setOpened(true);
        }}
      >
        MCP project link
      </button>
      <button
        onClick={async () => {
          const result = await resources.openResourceCard?.(card, 'message-1');
          if (result?.success) setOpened(true);
        }}
      >
        Project resource card
      </button>
      {opened && <span>Project view opened</span>}
      <input aria-label="Draft" defaultValue="Keep my draft" />
      <p>Current conversation message</p>
    </>
  );
}

describe('opening the current Project view', () => {
  setupWorkbenchTests();

  it.each([
    ['MCP project link', false],
    ['Project resource card', false],
    ['MCP project link', true],
    ['Project resource card', true],
  ] as const)(
    'preserves the conversation through %s (streaming=%s)',
    async (link, streaming) => {
      mocks.stream.isLoading = streaming;
      mocks.stream.messages = [
        {
          id: 'message-1',
          type: 'ai',
          content: 'Current conversation message',
        },
      ];
      const messages = mocks.stream.messages;
      mocks.listSlotViews.mockResolvedValue([projectView]);
      const onClientCommand = vi.fn().mockResolvedValue({
        success: true,
        session: {
          assistantId: 'agent-1',
          projectId: 'project-1',
          threadId: null,
          secret: 'new-session',
        },
      });
      const onNavigate = vi.fn();
      render(
        <WorkbenchShell
          options={{
            ...baseOptions,
            workbench: { enabled: true, onClientCommand },
          }}
          locale="en-US"
          onRequestContextChange={vi.fn()}
          onNavigate={onNavigate}
        >
          <WorkbenchToggleButton />
          <ProjectLinks />
        </WorkbenchShell>,
      );
      setObservedWidth(1200);
      await waitFor(() =>
        expect(screen.getByLabelText('Open views')).toBeEnabled(),
      );
      const draft = screen.getByLabelText('Draft');
      fireEvent.change(draft, { target: { value: 'Unsaved input' } });
      fireEvent.click(screen.getByRole('button', { name: link }));
      await screen.findByText('Project view opened');
      expect(
        screen.getByRole('tab', { name: 'Project tasks' }),
      ).toHaveAttribute('aria-selected', 'true');
      expect(mocks.remoteViewProps?.runtimeScope).toEqual({
        projectId: 'project-1',
        conversationId: 'conversation-1',
      });
      expect(screen.getByLabelText('Draft')).toBe(draft);
      expect(draft).toHaveValue('Unsaved input');
      expect(
        screen.getByText('Current conversation message'),
      ).toBeInTheDocument();
      expect(mocks.stream.messages).toBe(messages);
      expect(mocks.stream.threadId).toBe('thread-1');
      expect(mocks.stream.isLoading).toBe(streaming);
      expect(mocks.stream.reset).not.toHaveBeenCalled();
      expect(onClientCommand).not.toHaveBeenCalled();
      expect(onNavigate).not.toHaveBeenCalled();
    },
  );
});
