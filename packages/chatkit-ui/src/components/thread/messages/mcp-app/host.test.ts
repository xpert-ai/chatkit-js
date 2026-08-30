import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readMcpAppDisplayMode,
  readMcpAppPendingApproval,
  isMcpAppRpcSuccess,
  triggerMcpAppDownloads,
  withMcpAppApprovalId,
} from './host';

describe('MCP App host protocol', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('recognizes approval-required responses and redacts sensitive details', () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 'rpc-1',
      method: 'tools/call',
      params: {
        name: 'update_record',
        arguments: { title: 'Approved title', apiKey: 'secret-value' },
      },
    };

    const approval = readMcpAppPendingApproval(
      {
        jsonrpc: '2.0',
        id: 'rpc-1',
        error: {
          code: -32001,
          message: 'Approval required',
          data: {
            approvalId: 'approval-1',
            risk: 'write',
            expiresAt: Date.now() + 60_000,
          },
        },
      },
      request,
    );

    expect(approval).toMatchObject({
      approvalId: 'approval-1',
      risk: 'write',
      toolName: 'update_record',
      kind: 'tool',
    });
    expect(approval?.details).toContain('Approved title');
    expect(approval?.details).toContain('[Redacted]');
    expect(approval?.details).not.toContain('secret-value');
    expect(withMcpAppApprovalId(request, 'approval-1').params).toMatchObject({
      name: 'update_record',
      approvalId: 'approval-1',
    });
  });

  it('reads all supported display modes from host responses', () => {
    expect(readMcpAppDisplayMode({ result: { mode: 'pip' } })).toBe('pip');
    expect(
      readMcpAppDisplayMode({
        result: { mode: 'picture-in-picture' },
      }),
    ).toBe('pip');
    expect(readMcpAppDisplayMode({ result: { mode: 'unsupported' } })).toBe(
      undefined,
    );
  });

  it('requires an explicit JSON-RPC result before treating a response as successful', () => {
    expect(isMcpAppRpcSuccess({ result: {} })).toBe(true);
    expect(isMcpAppRpcSuccess({})).toBe(false);
    expect(isMcpAppRpcSuccess({ result: {}, error: {} })).toBe(false);
  });

  it('summarizes download approvals without exposing embedded file contents', () => {
    const approval = readMcpAppPendingApproval(
      {
        error: {
          code: -32001,
          data: {
            approvalId: 'download-approval',
            risk: 'write',
            expiresAt: Date.now() + 60_000,
          },
        },
      },
      {
        id: 'download-1',
        method: 'ui/download-file',
        params: {
          contents: [
            {
              type: 'resource',
              resource: {
                uri: 'ui://reports/private.csv',
                mimeType: 'text/csv',
                text: 'sensitive,file,contents',
              },
            },
          ],
        },
      },
    );

    expect(approval?.kind).toBe('download');
    expect(approval?.details).toContain('private.csv');
    expect(approval?.details).toContain('bytes');
    expect(approval?.details).not.toContain('sensitive,file,contents');
  });

  it('downloads approved embedded resources and HTTP resource links', () => {
    vi.useFakeTimers();
    const clicked: Array<{ href: string; filename: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function click(this: HTMLAnchorElement) {
        clicked.push({ href: this.href, filename: this.download });
      },
    );
    const createObjectUrl = vi.fn(() => 'blob:https://chat.example/download-1');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    });

    triggerMcpAppDownloads({
      contents: [
        {
          type: 'resource',
          resource: {
            uri: 'ui://reports/monthly.csv',
            mimeType: 'text/csv',
            text: 'month,value\nAugust,42',
          },
        },
        {
          type: 'resource_link',
          uri: 'https://files.example/report.pdf',
          name: 'report.pdf',
        },
      ],
    });

    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(clicked).toEqual([
      {
        href: 'blob:https://chat.example/download-1',
        filename: 'monthly.csv',
      },
      {
        href: 'https://files.example/report.pdf',
        filename: 'report.pdf',
      },
    ]);
    vi.runAllTimers();
    expect(revokeObjectUrl).toHaveBeenCalledWith(
      'blob:https://chat.example/download-1',
    );
  });
});
