import { describe, expect, it, vi } from 'vitest';

import {
  HOST_AUTOMATION_DEFAULT_RESULT_DELAY_MS,
  shouldDelayHostAutomationResult,
  withDefaultHostAutomationResultDelay,
} from './host-automation-delay';

describe('host automation result delay', () => {
  it.each([
    'host_page_navigate',
    'host_page_press',
    'host_page_click',
    'host_page_scroll',
  ])('delays %s results by the default duration', async (name) => {
    const delay = vi.fn(async () => undefined);

    await expect(
      withDefaultHostAutomationResultDelay({ name }, () => 'ok', delay),
    ).resolves.toBe('ok');

    expect(delay).toHaveBeenCalledWith(HOST_AUTOMATION_DEFAULT_RESULT_DELAY_MS);
  });

  it.each(['host_page_snapshot', 'host_page_fill', 'host_page_select'])(
    'does not delay %s results',
    async (name) => {
      const delay = vi.fn(async () => undefined);

      expect(shouldDelayHostAutomationResult({ name })).toBe(false);
      await expect(
        withDefaultHostAutomationResultDelay({ name }, () => 'ok', delay),
      ).resolves.toBe('ok');

      expect(delay).not.toHaveBeenCalled();
    },
  );

  it('does not delay failed automation calls', async () => {
    const delay = vi.fn(async () => undefined);

    await expect(
      withDefaultHostAutomationResultDelay(
        { name: 'host_page_click' },
        () => {
          throw new Error('click failed');
        },
        delay,
      ),
    ).rejects.toThrow('click failed');

    expect(delay).not.toHaveBeenCalled();
  });
});
