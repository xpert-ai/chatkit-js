import { describe, expect, it } from 'vitest';

import {
  HOST_PAGE_AUTOMATION_TOOL_NAMES,
  HOST_PAGE_AUTOMATION_TOOL_SCHEMAS,
  type BrowserActionResult,
} from './index';

const targetlessActionResult: BrowserActionResult = {
  dispatched: true,
  outcome: 'executed_unverified',
  requiresFreshSnapshot: true,
};

describe('host page automation tool schemas', () => {
  it('allows action results without resolution when the action has no target', () => {
    expect(targetlessActionResult).not.toHaveProperty('resolution');
  });
  it('defines schemas for every host automation tool', () => {
    expect(Object.keys(HOST_PAGE_AUTOMATION_TOOL_SCHEMAS).sort()).toEqual(
      [...HOST_PAGE_AUTOMATION_TOOL_NAMES].sort(),
    );
  });

  it('keeps internal action approval tokens out of model-visible schemas', () => {
    for (const schema of Object.values(HOST_PAGE_AUTOMATION_TOOL_SCHEMAS)) {
      expect(schema.properties).not.toHaveProperty('actionToken');
    }
  });

  it('exposes safe pointer coordinate parameters', () => {
    const pointerSchema = HOST_PAGE_AUTOMATION_TOOL_SCHEMAS.host_page_pointer;

    expect(pointerSchema.properties).toMatchObject({
      pageStateId: { type: 'string' },
      documentRef: { type: 'string' },
      x: { type: 'number' },
      y: { type: 'number' },
      coordinateSpace: {
        enum: ['viewport-css-px', 'viewport_normalized'],
      },
      targetText: {
        type: 'string',
      },
      targetRole: { type: 'string' },
      targetContext: { type: 'string' },
      expectation: {
        properties: {
          type: {
            enum: [
              'field_contains',
              'checked_equals',
              'element_visible',
              'element_hidden',
              'url_matches',
              'text_visible',
            ],
          },
        },
      },
      expectedAfterClick: {
        properties: {
          type: {
            const: 'field_contains',
          },
          field: {
            type: 'string',
          },
          value: {
            type: 'string',
          },
        },
        required: ['type', 'field', 'value'],
      },
    });
  });

  it('does not expose pointer-only coordinate space on generic target tools', () => {
    expect(
      HOST_PAGE_AUTOMATION_TOOL_SCHEMAS.host_page_click.properties,
    ).not.toHaveProperty('coordinateSpace');
    expect(
      HOST_PAGE_AUTOMATION_TOOL_SCHEMAS.host_page_fill.properties,
    ).not.toHaveProperty('coordinateSpace');
    expect(
      HOST_PAGE_AUTOMATION_TOOL_SCHEMAS.host_page_click.properties,
    ).not.toHaveProperty('x');
    expect(
      HOST_PAGE_AUTOMATION_TOOL_SCHEMAS.host_page_click.properties,
    ).not.toHaveProperty('y');
    expect(
      HOST_PAGE_AUTOMATION_TOOL_SCHEMAS.host_page_click.properties,
    ).toMatchObject({
      pageStateId: { type: 'string' },
      documentRef: { type: 'string' },
      expectation: expect.any(Object),
    });
  });

  it('accepts pageStateId for cached snapshot pagination', () => {
    expect(
      HOST_PAGE_AUTOMATION_TOOL_SCHEMAS.host_page_snapshot.properties,
    ).toMatchObject({ pageStateId: { type: 'string' } });
  });

  it('exposes paginated readable content parameters', () => {
    const readSchema = HOST_PAGE_AUTOMATION_TOOL_SCHEMAS.host_page_read;

    expect(readSchema.properties).not.toHaveProperty('snapshotId');
    expect(readSchema.properties).toMatchObject({
      blockId: {
        type: 'string',
      },
      query: {
        type: 'string',
      },
      scope: {
        enum: ['visible'],
      },
      page: {
        type: 'number',
        minimum: 1,
      },
      pageSize: {
        type: 'number',
        maximum: 100,
      },
      maxChars: {
        type: 'number',
        maximum: 12000,
      },
    });
  });
});
