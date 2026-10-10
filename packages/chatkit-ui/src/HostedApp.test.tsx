import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { HostedApp } from './HostedApp';

vi.mock('./App', () => ({
  default: ({
    clientSecret,
    options,
  }: {
    clientSecret: string;
    options: ChatKitOptions;
  }) => {
    const [draft, setDraft] = React.useState('');
    return (
      <>
        <input
          aria-label="Draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <output>{clientSecret}</output>
        <span>{options.api.xpertId ?? options.group?.id}</span>
      </>
    );
  },
}));

afterEach(cleanup);

it('isolates drafts and credentials across Assistant/group navigation without remounting for presentation updates', async () => {
  const sendCommand = vi.fn().mockResolvedValue('cs-first');
  const parent = { isParentAvailable: true, sendCommand };
  let options: ChatKitOptions = {
    api: { apiUrl: '/api', xpertId: 'a', getClientSecret: vi.fn() },
  };
  const view = () => (
    <HostedApp
      options={options}
      parent={parent}
      initialClientSecret="cs-initial"
    />
  );
  const { rerender } = render(view());
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('cs-first'),
  );
  fireEvent.change(screen.getByLabelText('Draft'), {
    target: { value: 'private draft' },
  });
  const input = screen.getByLabelText('Draft');
  options = { ...options, locale: 'zh-CN', theme: { colorScheme: 'dark' } };
  rerender(view());
  expect(screen.getByLabelText('Draft')).toBe(input);
  expect(input).toHaveValue('private draft');
  expect(sendCommand).toHaveBeenCalledTimes(1);

  let resolveLate!: (value: string) => void;
  sendCommand.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        resolveLate = resolve;
      }),
  );
  options = { ...options, api: { ...options.api, xpertId: 'b' } };
  rerender(view());
  expect(screen.getByLabelText('Draft')).toHaveValue('');
  expect(screen.getByRole('status').textContent).toBe('');
  sendCommand.mockResolvedValue('gs-group');
  options = { ...options, group: { id: 'group-one' } };
  rerender(view());
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('gs-group'),
  );
  await act(async () => resolveLate('cs-stale'));
  expect(screen.getByRole('status').textContent).toBe('gs-group');

  fireEvent.change(screen.getByLabelText('Draft'), {
    target: { value: 'group draft' },
  });
  options = { ...options, sessionKey: 'new-navigation' };
  rerender(view());
  expect(screen.getByLabelText('Draft')).toHaveValue('');
  await waitFor(() => expect(sendCommand).toHaveBeenCalledTimes(4));
});
