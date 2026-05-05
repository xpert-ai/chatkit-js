import { describe, expect, it } from 'vitest';

import { createHostPageAutomationClientToolHandler } from './handler';

function readContent(content: unknown) {
  return typeof content === 'string' ? JSON.parse(content) : content;
}

describe('createHostPageAutomationClientToolHandler', () => {
  it('returns successful client tool messages', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const handler = createHostPageAutomationClientToolHandler();

    const response = await handler({
      name: 'host_page_snapshot',
      params: {},
      id: 'call-1',
    });

    expect(response).toMatchObject({
      tool_call_id: 'call-1',
      name: 'host_page_snapshot',
      status: 'success',
    });
    expect(readContent(response.content)).toMatchObject({
      ok: true,
      result: { title: document.title },
    });
  });

  it('returns tool errors for unknown tools', async () => {
    const handler = createHostPageAutomationClientToolHandler();

    const response = await handler({
      name: 'unknown_tool',
      params: {},
      id: 'call-2',
    });

    expect(response.status).toBe('error');
    expect(readContent(response.content)).toMatchObject({
      ok: false,
    });
  });

  it('converts execution errors into tool error messages', async () => {
    const handler = createHostPageAutomationClientToolHandler();

    const response = await handler({
      name: 'host_page_click',
      params: { ref: 'missing' },
      tool_call_id: 'tool-call-1',
    });

    expect(response).toMatchObject({
      tool_call_id: 'tool-call-1',
      status: 'error',
    });
    expect(readContent(response.content).error).toContain(
      'Unknown element ref',
    );
  });
});
