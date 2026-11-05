import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getComposerSelectionOffset,
  setComposerSelectionOffset,
} from '../../../lib/composer-parts';
import {
  PET_LOCAL_SETTINGS_STORAGE_KEY,
  readPetLocalSettings,
} from '../../pet/pet-local-settings';
import {
  goalRuntimeCapabilities,
  insertComposerText,
  mocks,
  placeComposerCaretAtEnd,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Slash mode commands preserve the draft', () => {
  setupChatTest();

  beforeEach(() => {
    window.localStorage.removeItem(PET_LOCAL_SETTINGS_STORAGE_KEY);
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValue({
      ...goalRuntimeCapabilities,
      skills: [
        { id: 'first', workspaceId: 'workspace-1', label: 'First Skill' },
        { id: 'last', workspaceId: 'workspace-1', label: 'Last Skill' },
      ],
    });
  });

  describe.each([
    { name: 'plan', label: 'Localized Plan' },
    { name: 'pet', label: 'Pet' },
    { name: 'goal', label: 'Goal' },
  ])('$name', ({ name, label }) => {
    it.each(['leading', 'inline', 'tokens'])(
      'removes only the active query in a %s draft',
      async (position) => {
        renderChat();
        await waitFor(() =>
          expect(
            screen.getByTestId('runtime-capabilities-ready'),
          ).toHaveTextContent('ready'),
        );

        let textbox = screen.getByRole('textbox');
        let start = 0;
        if (position === 'tokens') {
          textbox = setComposerText(textbox, '$first');
          fireEvent.mouseDown(await screen.findByText('First Skill'));
          textbox = screen.getByRole('textbox');
          placeComposerCaretAtEnd(textbox);
          start = getComposerSelectionOffset(textbox) ?? 0;
        }

        const prefix = position === 'leading' ? '' : '/\nInvestigate this bug ';
        const query = `/${name}`;
        const suffix = ' and retain these notes';
        start += prefix.length;
        placeComposerCaretAtEnd(textbox);
        textbox = insertComposerText(textbox, `${prefix}${query}${suffix}`);
        if (position === 'tokens') {
          textbox = insertComposerText(textbox, ' $last');
          fireEvent.mouseDown(await screen.findByText('Last Skill'));
          textbox = screen.getByRole('textbox');
        }
        const previousText = textbox.textContent ?? '';
        const tokenKeys = Array.from(
          textbox.querySelectorAll('[data-composer-capability-key]'),
          (token) => token.getAttribute('data-composer-capability-key'),
        );

        setComposerSelectionOffset(textbox, start + query.length);
        fireEvent.input(textbox);
        const palette = document.querySelector('[data-slot="slash-palette"]');
        if (!(palette instanceof HTMLElement))
          throw new Error('Missing slash menu');
        const option = within(palette).getByText(label);
        if (position === 'tokens') {
          fireEvent.keyDown(textbox, { key: 'Enter' });
        } else {
          fireEvent.mouseDown(option);
        }

        textbox = screen.getByRole('textbox');
        expect(textbox.textContent).toBe(previousText.replace(query, ''));
        expect(
          Array.from(
            textbox.querySelectorAll('[data-composer-capability-key]'),
            (token) => token.getAttribute('data-composer-capability-key'),
          ),
        ).toEqual(tokenKeys);
        if (position === 'tokens') {
          expect(tokenKeys).toHaveLength(2);
          expect(screen.getByTestId('selected-skills')).toHaveTextContent(
            'first,last',
          );
        }
        expect(
          document.querySelector('[data-slot="slash-palette"]'),
        ).toBeNull();
        await waitFor(() =>
          expect(getComposerSelectionOffset(textbox)).toBe(start),
        );
        expect(mocks.stream.submit).not.toHaveBeenCalled();
        if (name === 'plan') {
          expect(screen.getByTestId('plan-mode-toggle')).toHaveTextContent(
            'plan-on',
          );
        } else if (name === 'pet') {
          expect(readPetLocalSettings()?.enabled).toBe(true);
        } else {
          expect(screen.getByTestId('goal-command')).toHaveTextContent(
            'goal-on',
          );
        }
      },
    );
  });
});
