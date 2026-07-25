import { describe, expect, it } from 'vitest';
import {
  REMOTE_COMPONENT_CHANNEL,
  parseActionRequest,
  parseRemoteComponentMessage,
  parseRemoteFile,
  parseViewQuery,
} from './protocol';

describe('remote component protocol parsing', () => {
  it('accepts only the declared channel and protocol version', () => {
    expect(
      parseRemoteComponentMessage({
        channel: REMOTE_COMPONENT_CHANNEL,
        protocolVersion: 1,
        instanceId: 'view:1',
        type: 'requestData',
        requestId: 'request-1',
      }),
    ).toMatchObject({
      instanceId: 'view:1',
      type: 'requestData',
      requestId: 'request-1',
    });
    expect(
      parseRemoteComponentMessage({
        channel: 'other',
        protocolVersion: 1,
        type: 'requestData',
      }),
    ).toBeNull();
    expect(
      parseRemoteComponentMessage({
        channel: REMOTE_COMPONENT_CHANNEL,
        protocolVersion: 2,
        type: 'requestData',
      }),
    ).toBeNull();
  });

  it('normalizes supported query fields and drops malformed values', () => {
    expect(
      parseViewQuery({
        page: 2.9,
        pageSize: -1,
        sortDirection: 'desc',
        filters: [
          { key: 'status', operator: 'eq', value: ['ready', 'pending'] },
          { key: '', value: 'ignored' },
        ],
        parameters: {
          table: 'documents',
          enabled: true,
          nested: { ignored: true },
        },
      }),
    ).toEqual({
      page: 2,
      sortDirection: 'desc',
      filters: [{ key: 'status', operator: 'eq', value: ['ready', 'pending'] }],
      parameters: {
        table: 'documents',
        enabled: true,
      },
    });
  });

  it('normalizes action and transferable file payloads', () => {
    const message = parseRemoteComponentMessage({
      channel: REMOTE_COMPONENT_CHANNEL,
      protocolVersion: 1,
      type: 'executeFileAction',
      targetId: 'doc-1',
      input: { replace: true },
      parameters: { source: 'review' },
      file: {
        name: 'report.pdf',
        type: 'application/pdf',
        buffer: new Uint8Array([1, 2]).buffer,
      },
    });
    expect(message).not.toBeNull();
    if (!message) return;

    expect(parseActionRequest(message)).toEqual({
      targetId: 'doc-1',
      input: { replace: true },
      parameters: { source: 'review' },
    });
    expect(parseRemoteFile(message.file)).toMatchObject({
      name: 'report.pdf',
      type: 'application/pdf',
    });
  });
});
