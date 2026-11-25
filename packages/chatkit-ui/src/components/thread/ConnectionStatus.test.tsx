import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ConnectionStatus } from './ConnectionStatus';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));

it('offers an explicit reconnect action only when unavailable', () => {
  const reconnect = vi.fn();
  const submit = vi.fn();
  const view = render(
    <form onSubmit={submit}>
      <ConnectionStatus state="unavailable" onReconnect={reconnect} />
    </form>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'connection.retry' }));
  expect(reconnect).toHaveBeenCalledOnce();
  expect(submit).not.toHaveBeenCalled();
  view.rerender(<ConnectionStatus state="reconnecting" onReconnect={reconnect} />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('connection.reconnecting');
  view.rerender(<ConnectionStatus state="connected" onReconnect={reconnect} />);
  expect(screen.queryByRole('status')).toBeNull();
});
