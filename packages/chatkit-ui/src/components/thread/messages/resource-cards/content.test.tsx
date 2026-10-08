import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createResourceCardContent } from '@xpert-ai/chatkit-types';
import { MessageResourceCards } from './index';
import {
  ResourceCardContext,
  unavailableResourceCardActions,
} from '../../../../resource-cards/context';

const file = {
  id: 'file',
  title: '施工报告',
  description: 'PDF 原件',
  file: { viewKey: 'bid', fileKey: 'report', targetId: 'p:v' },
};
const card = createResourceCardContent({
  resource: { namespace: 'bid', type: 'arbitrary-business-type', id: 'one' },
  title: '交付结果',
  open: { target: 'workbench.view', viewKey: 'bid' },
  content: [
    {
      kind: 'fields',
      title: '摘要',
      fields: [
        { label: '验收状态', value: '通过 <script>HTML stays text</script>' },
      ],
    },
    { kind: 'file-list', title: '附件', files: [file] },
  ],
});

describe('composable resource card', () => {
  it('renders ordered blocks and retains base navigation with unknown future blocks', () => {
    const download = vi.fn();
    const ui = render(
      <ResourceCardContext.Provider
        value={{
          ...unavailableResourceCardActions,

          downloadResourceCardFile: download,
          openResourceCard: vi.fn(),
        }}
      >
        <MessageResourceCards
          message={{
            id: 'reply',
            type: 'assistant',
            content: [
              {
                ...card,
                data: {
                  ...card.data,
                  content: [{ kind: 'future' }, ...card.data.content!],
                },
              },
            ],
          }}
        />
      </ResourceCardContext.Provider>,
    );
    expect(screen.getByText('交付结果')).toBeVisible();
    expect(
      [...ui.container.querySelectorAll('section')].map((section) =>
        section.getAttribute('aria-label'),
      ),
    ).toEqual(['摘要', '附件']);
    expect(
      screen.getByText('通过 <script>HTML stays text</script>'),
    ).toBeVisible();
    expect(ui.container.querySelector('script')).toBeNull();
    expect(screen.getByText('PDF 原件')).toBeVisible();
    expect(
      screen.getByRole('button', { name: /^(Open|打开) 交付结果$/ }),
    ).toBeEnabled();
    expect(download).not.toHaveBeenCalled();
  });
  it('deduplicates pending clicks and allows retry after failure', async () => {
    let reject!: (error: Error) => void;
    const download = vi.fn(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    render(
      <ResourceCardContext.Provider
        value={{
          ...unavailableResourceCardActions,

          downloadResourceCardFile: download,
        }}
      >
        <MessageResourceCards
          message={{ id: 'reply', type: 'assistant', content: [card] }}
        />
      </ResourceCardContext.Provider>,
    );
    const button = screen.getByRole('button', { name: /施工报告/ });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(download).toHaveBeenCalledExactlyOnceWith(file);
    expect(button).toBeDisabled();
    await act(async () => reject(new Error('expired')));
    expect(screen.getByRole('alert')).toBeVisible();
    download.mockResolvedValueOnce();
    await act(async () => fireEvent.click(button));
    expect(download).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
