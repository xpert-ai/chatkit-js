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
const officeSaved = vi.fn();
vi.mock('../office/presentation/PptxEditor', () => ({
  default: React.forwardRef(function MockOffice(
    { onDirty }: { onDirty: () => void },
    ref,
  ) {
    React.useImperativeHandle(ref, () => ({
      exportFile: async () => new Blob(['edited office']),
      markSaved: officeSaved,
    }));
    return <button onClick={() => onDirty()}>Edit office</button>;
  }),
}));
function setup(path = 'note.md') {
  const client = new Client({ apiUrl: 'http://example.test/api/ai' });
  const download = vi
    .spyOn(client.workbench, 'downloadFile')
    .mockResolvedValue(new Blob(['original']));
  const save = vi
    .spyOn(client.workbench, 'saveFile')
    .mockResolvedValue({ filePath: 'note.md' });
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
      'note.md',
      'edited',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(register.mock.calls.at(-1)?.[1].dirty).toBe(false);
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

it('acknowledges Office edits only after the server accepts the exported bytes', async () => {
  officeSaved.mockClear();
  const { client, register, download } = setup('slides.pptx');
  const persist = vi
    .spyOn(client.workbench, 'saveBinaryFile')
    .mockRejectedValueOnce(new Error('Save failed'))
    .mockResolvedValue({ filePath: 'slides.pptx' });
  fireEvent.click(await screen.findByText('Edit office'));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Save failed');
  expect(officeSaved).not.toHaveBeenCalled();
  expect(register.mock.calls.at(-1)?.[1].dirty).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(officeSaved).toHaveBeenCalledOnce());
  expect(officeSaved).toHaveBeenCalledWith(persist.mock.calls[1][2]);
  expect(register.mock.calls.at(-1)?.[1].dirty).toBe(false);
  // The next conflict check compares against the successfully saved file.
  download.mockResolvedValue(new Blob(['edited office']));
  fireEvent.click(screen.getByText('Edit office'));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(officeSaved).toHaveBeenCalledTimes(2));
});
