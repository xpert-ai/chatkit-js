import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Thread } from '@xpert-ai/xpert-sdk';
import { ThreadRunControls } from './ThreadRunControls';
vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));
function branch(
  status: Thread['status'],
  state: 'running' | 'pausing' | 'paused',
): Thread {
  return {
    thread_id: 'branch',
    status,
    values: {},
    interrupts: {},
    metadata: {},
    created_at: '',
    updated_at: '',
    runControl: { executionId: 'run', state, pauseId: 'pause' },
  };
}
it.each(['busy', 'pausing', 'paused'] as const)(
  'does not render a separate run toolbar for %s',
  (status) => {
    const current = branch(status, status === 'busy' ? 'running' : status);
    const { container } = render(
      <ThreadRunControls branches={[current]} current={current} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  },
);

it('keeps the existing branch selector when there are multiple branches', () => {
  const current = branch('paused', 'paused');
  render(
    <ThreadRunControls
      branches={[current, { ...current, thread_id: 'other-branch' }]}
      current={current}
      onSelect={vi.fn()}
    />,
  );
  expect(screen.getByRole('combobox', { name: 'threadControl.branch' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'threadControl.resume' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'threadControl.cancelRun' })).toBeNull();
});
