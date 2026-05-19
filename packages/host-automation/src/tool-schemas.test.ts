import { describe, expect, it } from 'vitest';

import {
  HOST_PAGE_AUTOMATION_TOOL_NAMES,
  HOST_PAGE_AUTOMATION_TOOL_SCHEMAS,
} from './index';

describe('host page automation tool schemas', () => {
  it('defines schemas for every host automation tool', () => {
    expect(Object.keys(HOST_PAGE_AUTOMATION_TOOL_SCHEMAS).sort()).toEqual(
      [...HOST_PAGE_AUTOMATION_TOOL_NAMES].sort(),
    );
  });

  it('exposes safe pointer coordinate parameters', () => {
    const pointerSchema = HOST_PAGE_AUTOMATION_TOOL_SCHEMAS.host_page_pointer;

    expect(pointerSchema.properties).toMatchObject({
      coordinateSpace: {
        enum: ['viewport-css-px', 'viewport_normalized'],
      },
      targetText: {
        type: 'string',
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
  });
});
