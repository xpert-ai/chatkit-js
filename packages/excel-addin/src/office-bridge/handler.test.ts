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
    const execute = vi.fn(async () => ({ updated: true }));
    const adapter: OfficeHostAdapter<'office_excel_set_range_values'> = {
      host: 'Excel',
      supports: (name): name is 'office_excel_set_range_values' =>
        name === 'office_excel_set_range_values',
      execute,
    };
    const handler = createOfficeBridgeClientToolHandler({ adapter });

    const message = await handler({
      tool_call_id: 'call-2',
      name: 'office_excel_set_range_values',
      params: {
        address: 'A1',
        values: [['Hello']],
      },
    });

    expect(execute).toHaveBeenCalledWith('office_excel_set_range_values', {
      address: 'A1',
      values: [['Hello']],
    });
    expect(message.status).toBe('success');
    expect(JSON.parse(message.content as string)).toEqual({
      ok: true,
      result: {
        updated: true,
      },
    });
  });

  it('serializes adapter failures as client tool errors', async () => {
    const adapter: OfficeHostAdapter<'office_excel_set_range_values'> = {
      host: 'Excel',
      supports: (name): name is 'office_excel_set_range_values' =>
        name === 'office_excel_set_range_values',
      execute: async () => {
        throw new Error('Office failed');
      },
    };
    const handler = createOfficeBridgeClientToolHandler({ adapter });

    const message = await handler({
      id: 'call-3',
      name: 'office_excel_set_range_values',
      params: {
        address: 'A1',
        values: [['Hello']],
      },
    });

    expect(message.status).toBe('error');
    expect(JSON.parse(message.content as string)).toEqual({
      ok: false,
      error: 'Office failed',
    });
  });
});
