import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import { describe, expect, it } from 'vitest';

import {
  normalizeCallToolResult,
  normalizeMcpAppResourceResponse,
} from './mcp-app';

const mcpAppData: TMessageComponentMcpAppData = {
  type: 'McpApp',
  appInstanceId: 'app-1',
  resourceUri: 'ui://wiki-explorer/mcp-app.html',
  toolName: 'get-first-degree-links',
  toolCallId: 'call-1',
  toolsetId: 'toolset-1',
  serverName: 'wiki-explorer',
  title: 'Wiki Explorer',
};

describe('MCP App normalization', () => {
  it('normalizes resource responses into stable toolInfo and tool result shapes', () => {
    const normalized = normalizeMcpAppResourceResponse(
      {
        uri: 'ui://wiki-explorer/mcp-app.html',
        text: '<html></html>',
        toolInfo: {
          name: 'wiki-explorer__get-first-degree-links',
          originalName: 'get-first-degree-links',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string' },
            },
          },
        },
        toolInput: {
          url: 'https://en.wikipedia.org/wiki/Model_Context_Protocol',
        },
        toolResult: [
          '{"ok":true}',
          {
            structuredContent: {
              page: {
                url: 'https://en.wikipedia.org/wiki/Model_Context_Protocol',
                title: 'Model Context Protocol',
              },
              links: [],
              error: null,
            },
          },
        ],
      },
      mcpAppData,
    );

    expect(normalized.html).toBe('<html></html>');
    expect(normalized.toolInfo.tool).toMatchObject({
      name: 'get-first-degree-links',
      title: 'Wiki Explorer',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
        },
      },
    });
    expect(normalized.toolInput).toEqual({
      url: 'https://en.wikipedia.org/wiki/Model_Context_Protocol',
    });
    expect(normalized.hasToolResult).toBe(true);
    expect(normalized.toolResult.structuredContent).toMatchObject({
      page: {
        title: 'Model Context Protocol',
      },
    });
  });

  it('normalizes standard MCP CallToolResult payloads', () => {
    expect(
      normalizeCallToolResult({
        content: [{ type: 'text', text: 'ok' }],
        structuredContent: { ok: true },
        _meta: { source: 'mcp' },
      }),
    ).toEqual({
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: { ok: true },
      _meta: { source: 'mcp' },
    });
  });

  it('falls back to persisted component input and result for revived history resources', () => {
    const normalized = normalizeMcpAppResourceResponse(
      {
        uri: 'ui://wiki-explorer/mcp-app.html',
        text: '<html></html>',
        toolInput: {},
      },
      {
        ...mcpAppData,
        toolInput: {
          page: 'Luke P. Blackburn',
        },
        toolResult: {
          content: [{ type: 'text', text: 'links' }],
          structuredContent: {
            page: {
              title: 'Luke P. Blackburn',
            },
            links: [{ title: 'Kentucky' }],
          },
        },
      },
    );

    expect(normalized.toolInput).toEqual({
      page: 'Luke P. Blackburn',
    });
    expect(normalized.hasToolResult).toBe(true);
    expect(normalized.toolResult).toMatchObject({
      content: [{ type: 'text', text: 'links' }],
      structuredContent: {
        page: {
          title: 'Luke P. Blackburn',
        },
      },
    });
  });

  it('does not invent an empty tool-result notification payload for old history items', () => {
    const normalized = normalizeMcpAppResourceResponse(
      {
        uri: 'ui://wiki-explorer/mcp-app.html',
        text: '<html></html>',
        toolInput: {},
      },
      {
        ...mcpAppData,
        toolInput: {
          page: 'Luke P. Blackburn',
        },
      },
    );

    expect(normalized.toolInput).toEqual({
      page: 'Luke P. Blackburn',
    });
    expect(normalized.hasToolResult).toBe(false);
    expect(normalized.toolResult).toEqual({
      content: [],
    });
  });

  it('normalizes LangChain tuple payloads with structured artifacts', () => {
    expect(
      normalizeCallToolResult([
        '{"ok":true}',
        {
          structuredContent: { ok: true },
        },
      ]),
    ).toEqual({
      content: [{ type: 'text', text: '{"ok":true}' }],
      structuredContent: { ok: true },
    });
  });

  it('normalizes tuple payloads without mixing structuredContent into _meta', () => {
    expect(
      normalizeCallToolResult([
        '{"ok":true}',
        {
          structuredContent: { ok: true },
          _meta: { 'xpertai/visualization': { type: 'chart' } },
        },
      ]),
    ).toEqual({
      content: [{ type: 'text', text: '{"ok":true}' }],
      structuredContent: { ok: true },
      _meta: { 'xpertai/visualization': { type: 'chart' } },
    });
  });

  it('keeps legacy artifact objects as _meta when they are not structured result artifacts', () => {
    expect(
      normalizeCallToolResult([
        '{"ok":true}',
        {
          'xpertai/visualization': { type: 'chart' },
        },
      ]),
    ).toEqual({
      content: [{ type: 'text', text: '{"ok":true}' }],
      _meta: {
        'xpertai/visualization': { type: 'chart' },
      },
    });
  });
});
