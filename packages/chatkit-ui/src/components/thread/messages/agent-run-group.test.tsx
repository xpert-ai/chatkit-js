import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { setLanguage } from '../../../i18n';
import { buildAssistantRenderTree } from '../../../lib/agent-run-render-tree';
import {
  normalizeAgentRunInfo,
  upsertAgentRun,
  type AgentRunInfo,
} from '../../../lib/agent-runs';
import { AgentEventRow, AgentRunGroup } from './agent-run-group';

function runGroup(info: AgentRunInfo) {
  const tree = buildAssistantRenderTree({
    id: 'message',
    type: 'assistant',
    status: info.status,
    executionId: 'root',
    agentRuns: [{ parentId: 'root', title: 'Evidence agent', ...info }],
    content: [],
  });
  const unit = tree.units.find((item) => item.type === 'agent');
  if (unit?.type !== 'agent') throw new Error('Expected the child agent');
  return (
    <AgentRunGroup
      node={unit.node}
      hasFollowingItem={false}
      depth={0}
      renderUnits={() => null}
    />
  );
}

beforeEach(() => {
  setLanguage('en-US');
});

describe('AgentRunGroup', () => {
  describe.each(['running', 'success'])('%s agent', (status) => {
    it.each([null, undefined, '', '   '])(
      'does not show an empty error (%j)',
      (error) => {
        const { container } = render(runGroup({ id: 'child', status, error }));
        expect(screen.getByText('Evidence agent')).toBeInTheDocument();
        expect(container.querySelector('pre')).not.toBeInTheDocument();
        expect(screen.queryByText('null')).not.toBeInTheDocument();
      },
    );
  });

  it.each([
    'Permission denied',
    { message: 'Permission denied', code: 'forbidden' },
  ])('preserves real failure details (%j)', (error) => {
    const { container } = render(
      runGroup({ id: 'child', status: 'failed', error }),
    );
    expect(container.querySelector('pre')).toHaveTextContent(
      'Permission denied',
    );
  });

  it('keeps the failed status when no error details were supplied', () => {
    const { container } = render(
      runGroup({ id: 'child', status: 'failed', error: null }),
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(container.querySelector('pre')).not.toBeInTheDocument();
  });

  it('clears a previous error only when a later run update explicitly clears it', () => {
    const initial = {
      id: 'child',
      status: 'running',
      error: 'Temporary failure',
    };
    const { container, rerender } = render(runGroup(initial));
    expect(container.querySelector('pre')).toHaveTextContent(
      'Temporary failure',
    );

    const partial = normalizeAgentRunInfo({ id: 'child', elapsedTime: 1000 });
    if (!partial) throw new Error('Expected the progress update');
    const pending = upsertAgentRun([initial], partial);
    rerender(runGroup(pending[0]));
    expect(container.querySelector('pre')).toHaveTextContent(
      'Temporary failure',
    );

    const complete = normalizeAgentRunInfo({
      id: 'child',
      status: 'success',
      error: null,
    });
    if (!complete) throw new Error('Expected the completion update');
    rerender(runGroup(upsertAgentRun(pending, complete)[0]));
    expect(container.querySelector('pre')).not.toBeInTheDocument();
  });
});

describe.each(['progress', 'middleware_event'])(
  'AgentEventRow (%s)',
  (event) => {
    it.each([null, undefined, '', '   '])(
      'does not style an empty error as failure (%j)',
      (error) => {
        const { container } = render(
          <AgentEventRow
            content={{
              type: 'agent_event',
              event,
              title: 'Reading evidence',
              status: 'success',
              error,
            }}
          />,
        );
        expect(screen.getByText('Reading evidence')).toBeInTheDocument();
        expect(container.firstElementChild).not.toHaveClass('text-destructive');
        expect(container.querySelector('pre')).not.toBeInTheDocument();
      },
    );

    it('still indicates a failed event without error details', () => {
      const { container } = render(
        <AgentEventRow
          content={{
            type: 'agent_event',
            event,
            title: 'Reading evidence',
            status: 'failed',
            error: null,
          }}
        />,
      );
      expect(container.firstElementChild).toHaveClass('text-destructive');
      expect(container.querySelector('pre')).not.toBeInTheDocument();
    });

    it('preserves error styling when the event contains a real error', () => {
      const { container } = render(
        <AgentEventRow
          content={{
            type: 'agent_event',
            event,
            title: 'Reading evidence',
            error: 'Permission denied',
          }}
        />,
      );
      expect(container.firstElementChild).toHaveClass('text-destructive');
      if (event === 'progress')
        expect(container.querySelector('pre')).toHaveTextContent(
          'Permission denied',
        );
    });
  },
);
