import { describe, expect, it, vi } from 'vitest';
import { createOfficeBridgeClientToolHandler } from './handler';
import type { OfficeHostAdapter } from './types';

describe('createOfficeBridgeClientToolHandler', () => {
  it('returns a client tool error for unknown tools', async () => {
    const handler = createOfficeBridgeClientToolHandler({
      registry: {
        supports: (_name): _name is never => false,
        execute: async () => {
          throw new Error('Should not execute unknown tools.');
        },
      },
    });

    const message = await handler({
      id: 'call-1',
      name: 'unknown_tool',
      params: {},
    });

    expect(message).toEqual({
      tool_call_id: 'call-1',
      name: 'unknown_tool',
      status: 'error',
      content: JSON.stringify({
        ok: false,
        error: 'Unknown Office tool: unknown_tool',
      }),
    });
  });

  it('routes supported tools through the adapter', async () => {
    const execute = vi.fn(async () => ({ slideIndex: 2 }));
    const adapter: OfficeHostAdapter<'office_powerpoint_select_slide'> = {
      host: 'PowerPoint',
      supports: (name): name is 'office_powerpoint_select_slide' =>
        name === 'office_powerpoint_select_slide',
      execute,
    };
    const handler = createOfficeBridgeClientToolHandler({ adapter });

    const message = await handler({
      tool_call_id: 'call-2',
      name: 'office_powerpoint_select_slide',
      params: {
        slideIndex: 2,
      },
    });

    expect(execute).toHaveBeenCalledWith('office_powerpoint_select_slide', {
      slideIndex: 2,
    });
    expect(message.status).toBe('success');
    expect(JSON.parse(message.content as string)).toEqual({
      ok: true,
      result: {
        slideIndex: 2,
      },
    });
  });

  it('serializes adapter failures as client tool errors', async () => {
    const adapter: OfficeHostAdapter<'office_powerpoint_select_slide'> = {
      host: 'PowerPoint',
      supports: (name): name is 'office_powerpoint_select_slide' =>
        name === 'office_powerpoint_select_slide',
      execute: async () => {
        throw new Error('Office failed');
      },
    };
    const handler = createOfficeBridgeClientToolHandler({ adapter });

    const message = await handler({
      id: 'call-3',
      name: 'office_powerpoint_select_slide',
      params: {
        slideIndex: 1,
      },
    });

    expect(message.status).toBe('error');
    expect(JSON.parse(message.content as string)).toEqual({
      ok: false,
      error: 'Office failed',
    });
  });
});
