import { fireEvent, screen, waitFor } from '@testing-library/react';
import { type ChatkitMessage } from '@xpert-ai/chatkit-types';
import { describe, expect, it } from 'vitest';
import {
  chatkitLanguage,
  createContextCompressionComponent,
  createToolComponent,
  renderAssistant,
  writeTextMock,
  type AssistantChatkitMessage,
} from './ai.test-fixture';
import { AssistantMessage } from './ai';

describe('AssistantMessage tool components', () => {
  it('shows copied MCP results without reconnecting to the original app instance', () => {
    const { container } = renderAssistant(
      [
        {
          type: 'component',
          data: {
            type: 'McpApp',
            appInstanceId: 'source-instance',
            resourceUri: 'ui://source',
            toolName: 'lookup',
            toolResult: {
              content: [{ type: 'text', text: 'Saved tool result' }],
            },
          },
        },
      ],
      { historical: true },
    );
    expect(screen.getByText('message.historicalAppResult')).toBeVisible();
    expect(screen.getByText(/Saved tool result/)).toBeVisible();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('renders context compression components as standalone status rows', () => {
    renderAssistant([
      createContextCompressionComponent(),
      createToolComponent('read-file'),
    ]);

    expect(
      screen.getByText('Context automatically compressed'),
    ).toBeInTheDocument();
    expect(screen.getByText('Processed 1 tool')).toBeInTheDocument();
    expect(screen.queryByText('Processed 2 tools')).not.toBeInTheDocument();
  });

  it('renders skipped context compression as a no-op status row', () => {
    renderAssistant([
      createContextCompressionComponent({
        reason: 'no_unprotected_history',
        message:
          'No unprotected history available to compress. Recent user turns were preserved.',
      }),
    ]);

    expect(screen.getByText('Context not compressed')).toBeInTheDocument();
  });

  it('adds a shimmer text effect to running context compression status rows', () => {
    renderAssistant([
      createContextCompressionComponent({
        status: 'running',
        message: 'Generating context summary...',
        end_date: undefined,
      }),
    ]);

    expect(screen.getByText('Automatically compressing context')).toHaveClass(
      'ck-tool-call-running-text',
    );
  });

  it.each([
    'no_token_gain',
    'no_unprotected_history',
    'summary_invalid',
    'summary_constraints_lost',
  ])('shows failed compression as failure for reason %s', (reason) => {
    renderAssistant([
      createContextCompressionComponent({ status: 'fail', reason }),
    ]);
    expect(screen.getByText('Context compression failed')).toBeInTheDocument();
    expect(
      screen.queryByText('Context not compressed'),
    ).not.toBeInTheDocument();
  });

  it('labels initial waiting as thinking instead of loading', () => {
    renderAssistant('', {}, { isStreaming: true, streamingStatus: 'loading' });
    expect(screen.getByText('message.thinking')).toBeInTheDocument();
    expect(screen.queryByText('message.loading')).toBeNull();
  });

  it('shows an inline pet next to assistant state controls only while streaming', () => {
    const content: ChatkitMessage['content'] = [
      { id: 'answer', type: 'text', text: 'Drafting the page.' },
    ];
    const reasoning = [
      {
        id: 'reasoning',
        type: 'reasoning' as const,
        text: 'Need layout first.',
      },
    ];

    const { rerender } = renderAssistant(
      content,
      { reasoning, status: 'answering' },
      { isStreaming: true, streamingStatus: 'answering', pet: true },
    );

    expect(screen.getByTestId('chatkit-inline-pet-status')).toHaveAttribute(
      'data-pet-state',
      'review',
    );

    rerender(
      <AssistantMessage
        message={
          {
            id: 'assistant-1',
            type: 'assistant',
            content,
            reasoning,
          } as ChatkitMessage & { type: 'assistant' }
        }
        isStreaming={false}
        pet
      />,
    );

    expect(screen.queryByTestId('chatkit-inline-pet-status')).toBeNull();
  });

  it('uses the running inline pet state before the assistant starts answering', () => {
    renderAssistant(
      '',
      {},
      {
        isStreaming: true,
        streamingStatus: 'loading',
        pet: true,
      },
    );

    expect(screen.getByTestId('chatkit-inline-pet-status')).toHaveAttribute(
      'data-pet-state',
      'running',
    );
  });

  it('does not show an inline pet while streaming when pet is disabled', () => {
    renderAssistant(
      '',
      {},
      {
        isStreaming: true,
        streamingStatus: 'loading',
      },
    );

    expect(screen.queryByTestId('chatkit-inline-pet-status')).toBeNull();
  });

  it('expands the latest completed tool group by default', () => {
    renderAssistant([
      createToolComponent('read-file', {
        type: 'files',
        message: 'Read package.json',
      }),
      createToolComponent('search-docs', {
        type: 'web_search',
        message: 'Searched docs',
      }),
    ]);

    const toggle = screen.getByRole('button', {
      name: /Processed 1 file, 1 search/,
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Read package.json')).toBeInTheDocument();
    expect(screen.getByText('Searched docs')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('read-file')).not.toBeInTheDocument();
  });

  it('expands the latest grouped tool components by default', () => {
    renderAssistant([
      createToolComponent('run-tests', {
        type: 'program',
        message: 'Ran pnpm test',
        status: 'running',
      }),
      createToolComponent('read-file', {
        type: 'files',
        message: 'Read ai.tsx',
      }),
    ]);

    const toggle = screen.getByRole('button', {
      name: /Processed 1 file, 1 command/,
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.queryByRole('button', { name: /Processing/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Ran pnpm test')).toBeInTheDocument();
    expect(screen.getByText('Read ai.tsx')).toBeInTheDocument();
  });

  it('uses text content to break consecutive tool component groups', () => {
    renderAssistant([
      createToolComponent('first-tool'),
      createToolComponent('second-tool'),
      { type: 'text', text: 'The assistant answered between tools.' },
      createToolComponent('third-tool'),
      createToolComponent('fourth-tool'),
    ]);

    expect(
      screen.getAllByRole('button', { name: /Processed 2 tools/ }),
    ).toHaveLength(2);
    const toggles = screen.getAllByRole('button', {
      name: /Processed 2 tools/,
    });
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText('The assistant answered between tools.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('first-tool')).not.toBeInTheDocument();
    expect(screen.getByText('third-tool')).toBeInTheDocument();
  });

  it('collapses a tool group when a later non-group item appears', () => {
    renderAssistant([
      createToolComponent('first-tool'),
      createToolComponent('second-tool'),
      { type: 'text', text: 'Tools are done for now.' },
    ]);

    const toggle = screen.getByRole('button', { name: /Processed 2 tools/ });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('first-tool')).not.toBeInTheDocument();
    expect(screen.getByText('Tools are done for now.')).toBeInTheDocument();
  });

  it('ignores empty text and reasoning items between consecutive tool components', () => {
    renderAssistant([
      createToolComponent('first-tool'),
      { type: 'text', text: '   ' },
      { type: 'reasoning', text: '' },
      createToolComponent('second-tool'),
    ]);

    expect(
      screen.getByRole('button', { name: /Processed 2 tools/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('first-tool')).toBeInTheDocument();
    expect(screen.getByText('second-tool')).toBeInTheDocument();
  });

  it('keeps each grouped tool component expandable with input and output details', () => {
    renderAssistant([
      createToolComponent('read_file', {
        input: {
          path: 'packages/chatkit-ui/src/components/thread/messages/ai.tsx',
        },
        output: 'file contents',
      }),
      createToolComponent('run_command'),
    ]);

    const toolToggle = screen.getByRole('button', { name: /read_file/ });
    expect(toolToggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toolToggle);

    expect(toolToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText(/JSON · Object\(1\)/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /packages\/chatkit-ui\/src\/components\/thread\/messages\/ai.tsx/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('file contents')).toBeInTheDocument();
  });

  it('keeps tool text output while hiding model-facing image artifacts', () => {
    renderAssistant([
      createToolComponent('knowledge_document_view_images', {
        output: {
          message: 'The image will be attached to the next model step.',
        },
        artifact: {
          type: 'xpert.tool-output',
          version: 1,
          attachments: [
            {
              type: 'image',
              artifactId: 'artifact-1',
              artifactVersionId: 'version-1',
              sha256: 'a'.repeat(64),
              mimeType: 'image/png',
              title: 'Picture 1 on page 75',
              source: 'knowledge-document',
              modelDetail: 'high',
            },
          ],
        },
      }),
    ]);

    fireEvent.click(
      screen.getByRole('button', { name: /knowledge_document_view_images/ }),
    );

    expect(screen.queryByTestId('tool-output-attachments')).toBeNull();
    expect(
      screen.getByText(/The image will be attached to the next model step/),
    ).toBeInTheDocument();
  });

  it('shows the stable tool name before the input label when the row uses a summary title', () => {
    renderAssistant([
      createToolComponent('bom_lifecycle_save_observation', {
        title: 'Completed technical agreement extraction',
        input: {
          caseId: 'case-1',
          changeSummary: 'Saved three observations',
        },
      }),
    ]);

    fireEvent.click(
      screen.getByRole('button', {
        name: /Completed technical agreement extraction/,
      }),
    );

    expect(screen.getByText('Input').parentElement).toHaveTextContent(
      'bom_lifecycle_save_observation·Input',
    );
  });

  it('preserves expanded tool row state when appending to the same group', () => {
    const firstTool = createToolComponent('read_file', {
      input: {
        path: 'packages/chatkit-ui/src/components/thread/messages/ai.tsx',
      },
      output: 'file contents',
    });
    const secondTool = createToolComponent('run_command');
    const { rerender } = renderAssistant([firstTool]);

    fireEvent.click(screen.getByRole('button', { name: /read_file/ }));

    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('file contents')).toBeInTheDocument();

    rerender(
      <AssistantMessage
        message={
          {
            id: 'assistant-1',
            type: 'assistant',
            content: [{ ...firstTool }, secondTool],
          } as AssistantChatkitMessage
        }
      />,
    );

    expect(
      screen.getByRole('button', { name: /Processed 2 tools/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('file contents')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /run_command/ }).closest('li'),
    ).toHaveClass('ck-tool-call-row-enter');
  });

  it('does not treat tool message text as output details', () => {
    renderAssistant([
      createToolComponent('updateProjectTasks', {
        title: 'Update project tasks',
        message: 'Updating project tasks',
        status: 'running',
      }),
      createToolComponent('dispatchRunnableTasks'),
    ]);

    const toolToggle = screen.getByRole('button', {
      name: /Updating project tasks/,
    });

    expect(toolToggle).toBeDisabled();
    expect(toolToggle).not.toHaveAttribute('aria-expanded');
    expect(screen.queryByText('Output')).not.toBeInTheDocument();
  });

  it('copies grouped tool input and output values', async () => {
    renderAssistant([
      createToolComponent('updateProjectTasks', {
        input: { tasks: [{ id: 'task-1' }] },
        output: [{ id: 'task-1', status: 'done' }],
      }),
      createToolComponent('dispatchRunnableTasks'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /updateProjectTasks/ }));

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        JSON.stringify({ tasks: [{ id: 'task-1' }] }, null, 2),
      );
    });

    fireEvent.click(copyButtons[1]);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        JSON.stringify([{ id: 'task-1', status: 'done' }], null, 2),
      );
    });
  });

  it('uses localized message before title for running tool labels', () => {
    chatkitLanguage.value = 'zh-CN';

    renderAssistant([
      createToolComponent('updateProjectTasks', {
        title: { en_US: 'Update project tasks', zh_Hans: '更新项目任务' },
        message: {
          en_US: 'Updating project tasks',
          zh_Hans: '正在更新项目任务',
        },
        status: 'running',
      }),
      createToolComponent('dispatchRunnableTasks'),
    ]);

    expect(screen.getByText('正在更新项目任务')).toBeInTheDocument();
    expect(screen.queryByText('更新项目任务')).not.toBeInTheDocument();
  });

  it('uses localized title before message for completed tool labels', () => {
    chatkitLanguage.value = 'zh-CN';

    renderAssistant([
      createToolComponent('updateProjectTasks', {
        title: { en_US: 'Update project tasks', zh_Hans: '更新项目任务' },
        message: {
          en_US: 'Updating project tasks',
          zh_Hans: '正在更新项目任务',
        },
        status: 'success',
      }),
      createToolComponent('dispatchRunnableTasks'),
    ]);

    expect(screen.getByText('更新项目任务')).toBeInTheDocument();
    expect(screen.queryByText('正在更新项目任务')).not.toBeInTheDocument();
  });

  it('uses message before generated tool-name titles for completed tool labels', () => {
    renderAssistant([
      createToolComponent('host_page_click', {
        message: 'Click the bottom Execute button',
        status: 'success',
      }),
      createToolComponent('dispatchRunnableTasks'),
    ]);

    expect(
      screen.getByText('Click the bottom Execute button'),
    ).toBeInTheDocument();
    expect(screen.queryByText('host_page_click')).not.toBeInTheDocument();
  });

  it('renders json string outputs with tree and raw views', () => {
    renderAssistant([
      createToolComponent('read_json', {
        output: '{"status":"ok","items":[{"id":1}]}',
      }),
      createToolComponent('run_command'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /read_json/ }));

    expect(screen.getByText(/JSON · Object\(2\)/)).toBeInTheDocument();
    expect(screen.getByText('status:')).toBeInTheDocument();
    expect(screen.getByText('"ok"')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Raw' }));

    expect(screen.getByText(/"items": \[/)).toBeInTheDocument();
  });

  it('labels grouped tool errors before rendering the error details', () => {
    renderAssistant([
      createToolComponent('read_file', {
        error: 'Permission denied',
        status: 'fail',
      }),
      createToolComponent('run_command'),
    ]);

    expect(
      screen.getByRole('button', { name: /Processed 2 tools/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Processing failed 2 tools/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /read_file/ }));

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Permission denied')).toBeInTheDocument();
  });

  it('renders a single tool component with the grouped tool UI', () => {
    renderAssistant([
      createToolComponent('read_file', {
        type: 'files',
        title: 'Read file',
      }),
    ]);

    const toggle = screen.getByRole('button', { name: /Processed 1 file/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Read file')).toBeInTheDocument();
  });
});
