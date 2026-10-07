import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TAgentExecutionOutcome } from '@xpert-ai/chatkit-types';
import { setLanguage } from '../../../i18n';
import {
  mergeAgentRunInfo,
  normalizeAgentRunInfo,
} from '../../../lib/agent-runs';
import { AgentRunStatus } from './external-assistant-run-row';

beforeEach(() => setLanguage('zh-CN'));

describe('business result in execution rows', () => {
  it.each<[TAgentExecutionOutcome['status'], string]>([
    ['accepted', '已验收'],
    ['already_completed', '已完成，无需重复'],
    ['not_claimed', '未领取'],
    ['blocked', '受阻'],
    ['failed', '任务失败'],
    ['incomplete', '未验收'],
  ])(
    'shows %s for a normally ended model execution in both live and history records',
    (status, label) => {
      const outcome: TAgentExecutionOutcome = {
        status,
        subjectId: 'task',
        accepted: status === 'accepted' || status === 'already_completed',
      };
      const live = normalizeAgentRunInfo({
        id: 'child',
        status: 'success',
        metadata: { businessOutcome: outcome },
      });
      const history = normalizeAgentRunInfo({
        id: 'child',
        status: 'success',
        businessOutcome: outcome,
      });
      expect(live?.businessOutcome).toEqual(history?.businessOutcome);
      if (!live || !history) throw Error('Missing normalized execution');
      const { rerender } = render(<AgentRunStatus info={live} />);
      expect(screen.getByRole('status')).toHaveTextContent(label);
      rerender(
        <AgentRunStatus
          info={mergeAgentRunInfo(history, { id: 'child', elapsedTime: 200 })}
        />,
      );
      expect(screen.getByRole('status')).toHaveTextContent(label);
    },
  );

  it('keeps runtime errors and running status visible, and ignores contradictory outcomes', () => {
    const businessOutcome: TAgentExecutionOutcome = {
      status: 'accepted',
      subjectId: 'task',
      accepted: true,
    };
    const { rerender } = render(
      <AgentRunStatus
        info={{ id: 'child', status: 'running', businessOutcome }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('运行中');
    rerender(
      <AgentRunStatus
        info={{ id: 'child', status: 'error', businessOutcome }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('错误');
    expect(
      normalizeAgentRunInfo({
        id: 'child',
        businessOutcome: { ...businessOutcome, accepted: false },
      })?.businessOutcome,
    ).toBeUndefined();
  });
});
