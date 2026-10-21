import { afterEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  fixture as f,
  setupWorkbenchTests,
} from './WorkbenchShell.test-fixture';

setupWorkbenchTests();
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('mounts the Workbench before any file is opened when only getRandomValues is available', async () => {
  vi.stubGlobal('crypto', {
    getRandomValues: crypto.getRandomValues.bind(crypto),
  });
  f.mocks.listSlotViews.mockResolvedValue([f.manifest]);
  f.render(
    <f.WorkbenchShell
      options={{ ...f.baseOptions, workbench: { enabled: true } }}
      locale="en-US"
      onRequestContextChange={() => undefined}
    >
      <f.WorkbenchToggleButton />
    </f.WorkbenchShell>,
  );
  f.setObservedWidth(1200);

  await f.waitFor(() =>
    expect(f.screen.getByLabelText('Open views')).toBeEnabled(),
  );
  f.fireEvent.click(f.screen.getByLabelText('Open views'));
  expect(await f.screen.findByTestId('remote-view')).toBeVisible();
  expect(
    f.mocks.stream.client.viewHosts.createFileAccessSession,
  ).not.toHaveBeenCalled();
});
