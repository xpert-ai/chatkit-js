import * as React from 'react';
import { Blob as NodeBlob } from 'node:buffer';
import { Client } from '@xpert-ai/xpert-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ThemeProvider } from '../../../providers/Theme';
import { initI18n } from '../../../i18n';
import { WorkspaceFileEditor } from './WorkspaceFileEditor';
vi.mock('../../../components/code-editor/CodeEditor', () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="code"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
beforeEach(async () => {
  await initI18n().changeLanguage('en-US');
  vi.stubGlobal('Blob', NodeBlob);
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup(path = 'note.txt') {
  const client = new Client({ apiUrl: 'http://example.test/api/ai' });
  vi.spyOn(client.workbench, 'readFile').mockResolvedValue({
    filePath: path,
    capabilities: { canRead: true, canWrite: true },
  } as Awaited<ReturnType<typeof client.workbench.readFile>>);
  const download = vi
    .spyOn(client.workbench, 'downloadFile')
    .mockResolvedValue(new Blob(['original']));
  const save = vi
    .spyOn(client.workbench, 'saveFile')
    .mockResolvedValue({ filePath: 'note.txt' });
  const register = vi.fn();
  const saved = vi.fn();
  const view = render(
    <ThemeProvider>
      <WorkspaceFileEditor
        client={client}
        scope={{ kind: 'assistant', assistantId: 'a1' }}
        file={{ filePath: path }}
        tabKey="file"
        register={register}
        onSaved={saved}
      />
    </ThemeProvider>,
  );
  return { client, download, save, register, saved, ...view };
}
describe('workspace file saving', () => {
  it('saves text through the authorized scope and clears dirty state only on success', async () => {
    const { download, save, register, saved } = setup();
    await screen.findByLabelText('code');
    fireEvent.change(screen.getByLabelText('code'), {
      target: { value: 'edited' },
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(download).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith(
      { kind: 'assistant', assistantId: 'a1' },
      'note.txt',
      'edited',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    // The save receipt precedes React's effect publishing the clean editor handle.
    await waitFor(() =>
      expect(register.mock.calls.at(-1)?.[1]?.dirty).toBe(false),
    );
  });
  it('keeps edits and rejects an overwrite when server bytes changed', async () => {
    const { download, save } = setup();
    await screen.findByLabelText('code');
    download.mockResolvedValue(new Blob(['new server version']));
    fireEvent.change(screen.getByLabelText('code'), {
      target: { value: 'draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'changed elsewhere',
    );
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText('code')).toHaveValue('draft');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
  it('reports a save rejection without clearing the dirty buffer', async () => {
    const { save, register } = setup();
    await screen.findByLabelText('code');
    save.mockRejectedValue(new Error('Access denied'));
    fireEvent.change(screen.getByLabelText('code'), {
      target: { value: 'draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
    expect(register.mock.calls.at(-1)?.[1].dirty).toBe(true);
  });
});

it.each(['docx', 'xlsx', 'xls', 'csv', 'tsv'])(
  'requires the registered plugin for editable %s',
  async (extension) => {
    const { client } = setup(`document.${extension}`);
    const persist = vi.spyOn(client.workbench, 'saveBinaryFile');
    expect(await screen.findByText(/document editor plugin/i)).toBeVisible();
    expect(screen.queryByText('Edit office')).not.toBeInTheDocument();
    expect(persist).not.toHaveBeenCalled();
  },
);
