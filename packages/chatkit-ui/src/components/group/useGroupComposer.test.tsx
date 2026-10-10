import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client, type ChatGroupParticipant } from '@xpert-ai/xpert-sdk';
import { useGroupComposer } from './useGroupComposer';

vi.mock('../../i18n/useChatkitTranslation', () => ({ useChatkitTranslation: () => ({ t: (key: string) => key }) }));
const member = (id: string): ChatGroupParticipant => ({ id, subjectId: `assistant-${id}`, kind: 'assistant', role: 'member', name: id, active: true });
function setup() {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  const scoped = new Client({ apiUrl: 'https://example.test/api/ai/groups/g/members/c/composer' });
  vi.spyOn(client, 'forGroupComposer').mockReturnValue(scoped);
  vi.spyOn(client.groups, 'composerContext').mockResolvedValue({ projectId: null, locked: false, busy: false });
  vi.spyOn(scoped.assistants, 'getRuntimeCapabilities').mockResolvedValue({ skills: [], plugins: [] });
  const validate = vi.spyOn(scoped.assistants, 'validateResources').mockImplementation(async (_id, selection) => selection);
  return { client, scoped, validate };
}
afterEach(() => vi.restoreAllMocks());
describe('group Composer context', () => {
  it('passes selected project, workspace files and validated plugins to the addressed Assistant', async () => {
    const { client, validate } = setup();
    const { result, rerender } = renderHook(({ target }) => useGroupComposer({ client, groupId: 'g', member: target, activityKey: '' }), { initialProps: { target: member('c') as ChatGroupParticipant | undefined } });
    await waitFor(() => expect(result.current.blocked).toBe(false));
    act(() => result.current.controls.context?.project?.onProjectChange?.('project'));
    await waitFor(() => expect(result.current.input?.projectId).toBe('project'));
    await waitFor(() => expect(result.current.blocked).toBe(false));
    act(() => result.current.controls.context?.files?.onSelect({ filePath: 'notes.md', fullPath: 'docs/notes.md', fileType: 'md' }));
    await act(async () => { await result.current.controls.context?.resources?.onToggle({ bindingId: 'plugin', version: 'v1' }); });
    expect(validate).toHaveBeenCalledWith('assistant-c', { revision: 0, resources: [{ bindingId: 'plugin', version: 'v1' }] }, 'project');
    expect(result.current.input).toMatchObject({ participantId: 'c', projectId: 'project', files: [{ filePath: 'docs/notes.md', workspacePath: 'docs/notes.md', purpose: 'workspace' }], runtimeResources: { resources: [{ bindingId: 'plugin', version: 'v1' }] } });
    rerender({ target: member('e') });
    await waitFor(() => expect(result.current.blocked).toBe(false));
    expect(result.current.input).toMatchObject({ participantId: 'e', runtimeResources: { resources: [] } });
    expect(result.current.input).not.toHaveProperty('projectId');
    expect(result.current.input).not.toHaveProperty('files');
    rerender({ target: undefined });
    expect(result.current.input).toBeUndefined();
    expect(result.current.blocked).toBe(false);
  });
  it('retains server project locking and blocks submission if the scope cannot be authorized', async () => {
    const { client } = setup();
    vi.mocked(client.groups.composerContext).mockResolvedValue({ projectId: 'locked-project', locked: true, busy: false });
    const { result, rerender } = renderHook(({ activityKey }) => useGroupComposer({ client, groupId: 'g', member: member('c'), activityKey }), { initialProps: { activityKey: '' } });
    await waitFor(() => expect(result.current.input?.projectId).toBe('locked-project'));
    expect(result.current.controls.context?.project?.locked).toBe(true);
    vi.mocked(client.groups.composerContext).mockRejectedValue(new Error('revoked'));
    rerender({ activityKey: 'changed' });
    await waitFor(() => expect(result.current.blocked).toBe(true));
    expect(result.current.input).toBeUndefined();
  });
});
