import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  mocks,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat slash menu positions', () => {
  setupChatTest();

  it.each(['', 'Use this dashboard ', 'Use this dashboard\n', '/\n已有正文\n'])(
    'shows commands and inserts a grouped skill after %j',
    async (prefix) => {
      mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
        {
          skills: [
            {
              id: 'live-dashboard',
              workspaceId: 'workspace-1',
              label: 'Live Dashboard',
            },
          ],
          plugins: [],
          subAgents: [],
          commands: [
            {
              name: 'html-dashboard',
              label: 'Create HTML dashboard',
              kind: 'prompt_workflow',
              action: {
                type: 'insert_text',
                template: 'Create an HTML dashboard: {{args}}',
              },
            },
          ],
        },
      );
      renderChat();
      await waitFor(() =>
        expect(
          screen.getByTestId('runtime-capabilities-ready'),
        ).toHaveTextContent('ready'),
      );

      const text = `${prefix}/`;
      setComposerText(screen.getByRole('textbox'), text);
      const palette = document.querySelector('[data-slot="slash-palette"]');
      if (!(palette instanceof HTMLElement))
        throw new Error('Missing slash menu');
      const menu = within(palette);
      expect(menu.getByText('Localized Plan')).toBeInTheDocument();
      expect(menu.getByText('Localized Plugins')).toBeInTheDocument();
      expect(menu.getByText('Create HTML dashboard')).toBeInTheDocument();

      // Skills are expanded by default; collapsing and reopening the group must
      // preserve the surrounding draft at every slash-menu position.
      const skills = menu.getByText('Skills').closest('button');
      expect(skills).toHaveAttribute('aria-expanded', 'true');
      fireEvent.mouseDown(menu.getByText('Skills'));
      expect(menu.queryByText('Live Dashboard')).not.toBeInTheDocument();
      fireEvent.mouseDown(menu.getByText('Skills'));
      expect(screen.getByRole('textbox').textContent).toBe(text);
      fireEvent.mouseDown(await menu.findByText('Live Dashboard'));

      const textbox = screen.getByRole('textbox');
      expect(within(textbox).getByText('Live Dashboard')).toBeInTheDocument();
      expect(textbox.textContent?.startsWith(prefix)).toBe(true);
      expect(textbox.textContent?.slice(prefix.length)).not.toContain('/');
      expect(mocks.stream.submit).not.toHaveBeenCalled();
    },
  );
});
