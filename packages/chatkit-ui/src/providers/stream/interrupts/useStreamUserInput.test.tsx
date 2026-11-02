import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStreamUserInput } from './useStreamUserInput';
import type { RequestUserInputForm } from '@xpert-ai/chatkit-types';

const form: RequestUserInputForm = {
  schemaVersion: 1,
  mode: 'blocking',
  purpose: 'clarification',
  title: 'Test',
  fields: [
    {
      id: 'implement_plan',
      type: 'boolean',
      label: 'Include refunds?',
      required: true,
    },
  ],
};
const call = { name: 'request_user_input', id: 'call-1', args: form };
describe('user input lifecycle', () => {
  it('returns typed clarification once and accepts a later clarification round', async () => {
    const { result } = renderHook(useStreamUserInput);
    let promise!: ReturnType<typeof result.current.waitForRequestUserInput>;
    act(() => {
      promise = result.current.waitForRequestUserInput(call, form);
    });
    act(() => result.current.submitRequestUserInput({ implement_plan: false }));
    expect(await promise).toMatchObject({
      tool_call_id: 'call-1',
      content: {
        purpose: 'clarification',
        status: 'submitted',
        values: { implement_plan: false },
      },
    });
    act(() => result.current.submitRequestUserInput({ implement_plan: true }));
    expect(result.current.pendingRequestUserInput).toBeNull();
    act(() => {
      promise = result.current.waitForRequestUserInput(
        { ...call, id: 'call-2' },
        form,
      );
    });
    expect(result.current.pendingRequestUserInput?.id).toBe('call-2');
    act(() => result.current.submitRequestUserInput([], 'cancelled'));
    expect(await promise).toMatchObject({
      content: { status: 'cancelled', answers: [], purpose: 'clarification' },
    });
  });
  it('does not resolve invalid values and rejects unsupported non-blocking requests', async () => {
    const { result } = renderHook(useStreamUserInput);
    expect(() =>
      result.current.waitForRequestUserInput(call, {
        ...form,
        mode: 'non_blocking',
      }),
    ).toThrow('Non-blocking');
    let promise!: ReturnType<typeof result.current.waitForRequestUserInput>;
    act(() => {
      promise = result.current.waitForRequestUserInput(call, form);
    });
    act(() => result.current.submitRequestUserInput({}));
    expect(result.current.pendingRequestUserInput).not.toBeNull();
    act(() => result.current.submitRequestUserInput([], 'cancelled'));
    expect((await promise).content).not.toHaveProperty('values');
  });
});
