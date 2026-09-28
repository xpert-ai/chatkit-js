import { describe, expect, it, vi } from 'vitest';
import { collectToolAfterInterrupts, readAppContinuation, resumeAfterTool } from './tool-after';

const operation = { tasks: [{ interrupts: [{ id: 'checkpoint-1', value: {
  type: 'tool_after', toolName: 'configure', toolCallId: 'call-1', app: true,
} }] }] };
function fixture(value: unknown = operation) {
  const get = vi.fn().mockResolvedValue({ operation: value, status: 'interrupted' });
  const submit = vi.fn().mockImplementation(async (_input, options) => { options.onRunAccepted(); });
  const stream = { client: { threads: { get } }, submit, threadId: 'thread-1', conversationId: 'conversation-1' };
  return { get, submit, stream: stream as unknown as Parameters<typeof resumeAfterTool>[0] };
}

describe('post-tool App continuation', () => {
  it('only recognizes the dedicated interrupt contract', () => {
    expect(collectToolAfterInterrupts(operation)).toEqual([{ id: 'checkpoint-1', toolName: 'configure', toolCallId: 'call-1', app: true }]);
    expect(collectToolAfterInterrupts({ tasks: [{ interrupts: [{ value: { type: 'hitl', toolCallId: 'call-1' } }] }] })).toEqual([]);
    expect(readAppContinuation({ result: { continuation: { type: 'tool_after', toolCallId: 'call-1', executionId: 'run-1' } } })).toEqual({ toolCallId: 'call-1', executionId: 'run-1' });
    expect(readAppContinuation({ error: 'denied' })).toBeNull();
  });
  it('resumes the matching checkpoint with an explicit execution target', async () => {
    const f = fixture();
    await resumeAfterTool(f.stream, 'call-1', 'run-1', 'Settings saved');
    expect(f.submit).toHaveBeenCalledWith({ action: 'resume', conversationId: 'conversation-1', target: { executionId: 'run-1' },
      decision: { type: 'confirm', payload: { 'checkpoint-1': { toolCallId: 'call-1', message: 'Settings saved' } } } }, expect.any(Object));
  });
  it('cannot continue another or an already completed tool', async () => {
    const f = fixture();
    await expect(resumeAfterTool(f.stream, 'other')).rejects.toThrow('no longer waiting');
    expect(f.submit).not.toHaveBeenCalled();
  });
  it('acknowledges dispatch without waiting for a long Agent run', async () => {
    const f = fixture();
    f.submit.mockImplementation((_input, options) => {
      options.onRunAccepted();
      return new Promise(() => {});
    });
    await expect(resumeAfterTool(f.stream, 'call-1')).resolves.toBeUndefined();
  });
  it('waits for a checkpoint still being sealed', async () => {
    const f = fixture();
    f.get.mockResolvedValueOnce({ operation: null, status: 'busy' });
    await resumeAfterTool(f.stream, 'call-1');
    expect(f.get).toHaveBeenCalledTimes(2);
    expect(f.submit).toHaveBeenCalledTimes(1);
  });
  it('does not acknowledge thread resolution or a rejected resume request', async () => {
    const f = fixture();
    f.submit.mockImplementation(async (_input, options) => {
      options.onThreadResolved?.('thread-1', 'conversation-1');
      throw new Error('HTTP 409 resume rejected');
    });
    await expect(resumeAfterTool(f.stream, 'call-1')).rejects.toThrow('HTTP 409');
  });
  it('rejects an unacknowledged stream rather than claiming success', async () => {
    const f = fixture();
    f.submit.mockResolvedValue(undefined);
    await expect(resumeAfterTool(f.stream, 'call-1')).rejects.toThrow('did not acknowledge');
  });
  it('preserves inline attachments in the checkpoint answer', async () => {
    const f = fixture();
    const files = [{ name: 'plan.png', mimeType: 'image/png', fileUrl: 'data:image/png;base64,aW1hZ2U=' }];
    await resumeAfterTool(f.stream, 'call-1', 'run-1', '', files);
    expect(f.submit.mock.calls[0][0].decision.payload['checkpoint-1']).toEqual({ toolCallId: 'call-1', files });
  });
});
