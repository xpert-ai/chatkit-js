import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { setupWorkbenchTests, fixture } from './WorkbenchShell.test-fixture';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import {
  usePublishWorkbenchChat,
  useWorkbenchChat,
  type WorkbenchChatMetadata,
} from './floating-chat/context';
const {
  React,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  mocks,
  WorkbenchShell,
  WorkbenchToggleButton,
  baseOptions,
  manifest,
  setObservedWidth,
} = fixture;

function MainChat({ metadata }: { metadata: WorkbenchChatMetadata }) {
  usePublishWorkbenchChat(metadata);
  const presentation = useWorkbenchChat();
  return (
    <>
      <WorkbenchToggleButton />
      <div hidden={presentation?.floating && presentation.mode !== 'expanded'}>
        Messages
      </div>
      <input role="textbox" aria-label="Draft" defaultValue="Unsent draft" />
      <Popover>
        <PopoverTrigger asChild>
          <button>Composer menu</button>
        </PopoverTrigger>
        <PopoverContent>
          <button>Menu option</button>
        </PopoverContent>
      </Popover>
    </>
  );
}
const tree = (metadata: WorkbenchChatMetadata) => (
  <WorkbenchShell
    options={{ ...baseOptions, workbench: { enabled: true } }}
    locale="en-US"
    onRequestContextChange={() => undefined}
  >
    <MainChat metadata={metadata} />
  </WorkbenchShell>
);

async function openExpanded(width = 1200) {
  setObservedWidth(width);
  await waitFor(() =>
    expect(screen.getByLabelText('Open views')).toBeEnabled(),
  );
  fireEvent.click(screen.getByLabelText('Open views'));
  await screen.findByTestId('remote-view');
  fireEvent.click(screen.getByLabelText('Expand panel'));
}

describe('Workbench floating main conversation', () => {
  setupWorkbenchTests();
  it('moves the same editor between three modes, full tab and split without remounting views', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const result = render(tree({ title: 'Review bid', running: false }));
    const draft = screen.getByLabelText('Draft');
    fireEvent.change(draft, { target: { value: 'Keep this draft' } });
    await openExpanded();
    const remote = screen.getByTestId('remote-view');
    expect(screen.getByRole('tab', { name: 'Review bid' })).toBeVisible();
    const floating = screen.getByRole('region', {
      name: 'Floating conversation',
    });
    expect(within(floating).getByLabelText('Draft')).toBe(draft);
    expect(screen.getByText('Messages')).not.toBeVisible();
    fireEvent.click(screen.getByLabelText('Expand messages'));
    expect(screen.getByText('Messages')).toBeVisible();
    fireEvent.click(screen.getByText('Composer menu'));
    fireEvent.keyDown(screen.getByText('Menu option'), { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByText('Menu option')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Messages')).toBeVisible();
    fireEvent.keyDown(draft, { key: 'Escape' });
    expect(screen.getByText('Messages')).not.toBeVisible();
    fireEvent.click(screen.getByLabelText('Minimize conversation'));
    expect(draft).not.toBeVisible();
    expect(
      screen.getByLabelText('Open conversation input: Review bid'),
    ).toHaveFocus();
    fireEvent.click(
      screen.getByLabelText('Open conversation input: Review bid'),
    );
    expect(draft).toHaveFocus();
    fireEvent.keyDown(draft, { key: 'Escape' });
    expect(
      screen.getByLabelText('Open conversation input: Review bid'),
    ).toHaveFocus();
    fireEvent.click(
      screen.getByLabelText('Open conversation input: Review bid'),
    );
    fireEvent.click(screen.getByLabelText('Open conversation tab'));
    expect(
      screen.queryByRole('region', { name: 'Floating conversation' }),
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole('tabpanel', { name: 'Review bid' }),
      ).getByLabelText('Draft'),
    ).toBe(draft);
    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(
      within(
        screen.getByRole('region', { name: 'Floating conversation' }),
      ).getByLabelText('Draft'),
    ).toBe(draft);
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(draft).toHaveValue('Keep this draft');
    expect(screen.getByTestId('remote-view')).toBe(remote);
    expect(mocks.remoteUnmounts).toBe(0);
    result.rerender(tree({ title: 'Renamed bid', running: true }));
    fireEvent.click(screen.getByLabelText('Expand panel'));
    expect(screen.getByRole('tab', { name: 'Renamed bid' })).toBeVisible();
    act(() => draft.focus());
    expect(screen.getByLabelText('Working')).toBeVisible();
  });

  it('expands each interactive request once, keeps manual mode through ordinary updates', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const result = render(tree({ title: 'Review', running: true }));
    await openExpanded();
    fireEvent.click(screen.getByLabelText('Minimize conversation'));
    result.rerender(tree({ title: 'Review', running: false }));
    expect(
      screen.getByLabelText('Open conversation input: Review'),
    ).toBeVisible();
    result.rerender(
      tree({ title: 'Review', running: false, attentionKey: 'approval-1' }),
    );
    expect(screen.getByText('Messages')).toBeVisible();
    fireEvent.click(screen.getByLabelText('Collapse messages'));
    result.rerender(
      tree({
        title: 'Review updated',
        running: false,
        attentionKey: 'approval-1',
      }),
    );
    expect(screen.getByText('Messages')).not.toBeVisible();
    result.rerender(
      tree({
        title: 'Review updated',
        running: false,
        attentionKey: 'input-2',
      }),
    );
    expect(screen.getByText('Messages')).toBeVisible();
  });

  it('keeps the floating editor inside a narrow Sheet and Escape does not close the workbench', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(tree({ title: 'Review', running: false }));
    await openExpanded(720);
    const dialog = screen.getByRole('dialog');
    const draft = within(dialog).getByLabelText('Draft');
    expect(draft.closest('[aria-hidden="true"]')).toBeNull();
    fireEvent.click(screen.getByLabelText('Expand messages'));
    act(() => draft.focus());
    fireEvent.keyDown(draft, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.getByText('Messages')).not.toBeVisible();
    fireEvent.keyDown(draft, { key: 'Escape' });
    expect(
      screen.getByLabelText('Open conversation input: Review'),
    ).toHaveFocus();
    expect(screen.getByRole('dialog')).toBe(dialog);
    fireEvent.click(screen.getByLabelText('Open conversation input: Review'));
    expect(draft).toHaveFocus();
    setObservedWidth(1200);
    expect(screen.getByLabelText('Draft')).toBe(draft);
  });

  it('opens the existing side-chat runtime from the title menu and keeps the main draft', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    mocks.copyThread.mockResolvedValue({ thread_id: 'side-thread' });
    mocks.stream.isLoading = true;
    render(tree({ title: 'Review', running: true }));
    await openExpanded();
    const draft = screen.getByLabelText('Draft');
    act(() => draft.focus());
    fireEvent.keyDown(screen.getByLabelText('Conversation menu: Review'), {
      key: 'Enter',
    });
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'New side chat' }),
    );
    await waitFor(() => expect(mocks.sideChatMounts).toBe(1));
    expect(mocks.copyThread).toHaveBeenCalledWith('thread-1', {
      mode: 'latest-sealed-reply',
      requestId: expect.any(String),
    });
    expect(mocks.stream.isLoading).toBe(true);
    expect(
      screen.queryByRole('region', { name: 'Floating conversation' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(screen.getByLabelText('Draft')).toBe(draft);
    expect(draft).toHaveValue('Unsent draft');
  });
});
