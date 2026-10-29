import * as React from 'react';
import { Client } from '@xpert-ai/xpert-sdk';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatHeaderActions } from './ChatHeaderActions';
import { HostedWebUpdateContext } from '../../../web-update/context';
import { ThemeProvider } from '../../../providers/Theme';

vi.mock('../../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../../workbench/context', () => ({
  WorkbenchToggleButton: () => null,
}));
afterEach(cleanup);

it('offers About in the real actions menu for an opted-in standalone page', async () => {
  const openAbout = vi.fn();
  render(
    <ThemeProvider>
      <HostedWebUpdateContext.Provider
        value={{ openAbout, registerLeave: () => () => undefined }}
      >
        <ChatHeaderActions />
      </HostedWebUpdateContext.Provider>
    </ThemeProvider>,
  );
  fireEvent.keyDown(screen.getByRole('button', { name: 'chat.moreActions' }), {
    key: 'Enter',
  });
  fireEvent.click(
    await screen.findByRole('menuitem', { name: 'webUpdate.about' }),
  );
  expect(openAbout).toHaveBeenCalledTimes(1);
});

it('does not add an update menu to an embed or third-party application', () => {
  render(
    <ThemeProvider>
      <ChatHeaderActions />
    </ThemeProvider>,
  );
  expect(
    screen.queryByRole('button', { name: 'chat.moreActions' }),
  ).not.toBeInTheDocument();
});

it('keeps sharing available alongside About when both features are enabled', async () => {
  const openAbout = vi.fn();
  render(
    <ThemeProvider>
      <HostedWebUpdateContext.Provider
        value={{ openAbout, registerLeave: () => () => undefined }}
      >
        <ChatHeaderActions
          share={{
            client: new Client({ apiUrl: 'https://example.test/api' }),
            conversationId: 'conversation',
            threadId: 'thread',
          }}
        />
      </HostedWebUpdateContext.Provider>
    </ThemeProvider>,
  );
  fireEvent.keyDown(screen.getByRole('button', { name: 'chat.moreActions' }), {
    key: 'Enter',
  });
  expect(await screen.findByRole('menuitem', { name: 'sharing.action' }))
    .not.toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(screen.getByRole('menuitem', { name: 'webUpdate.about' }));
  expect(openAbout).toHaveBeenCalledTimes(1);
});
