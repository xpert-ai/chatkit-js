export type JsonSchema = {
  type?: string | string[];
  enum?: readonly unknown[];
  const?: unknown;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
};

const targetProperties = {
  ref: {
    type: ['string', 'number'],
    description: 'Element ref from host_page_snapshot.',
  },
  axRef: {
    type: ['string', 'number'],
    description: 'Accessibility ref from host_page_snapshot.',
  },
  selector: {
    type: 'string',
    description: 'CSS selector for the target element.',
  },
  testId: {
    type: 'string',
    description: 'data-testid, data-test-id, or data-qa value.',
  },
  role: {
    type: 'string',
    description: 'Accessible role to match.',
  },
  name: {
    type: 'string',
    description: 'Accessible name to match.',
  },
  text: {
    type: 'string',
    description: 'Visible text to match.',
  },
  x: {
    type: 'number',
    description: 'Viewport x coordinate.',
  },
  y: {
    type: 'number',
    description: 'Viewport y coordinate.',
  },
} satisfies Record<string, JsonSchema>;

const pointerCoordinateProperties = {
  coordinateSpace: {
    type: 'string',
    enum: ['viewport-css-px', 'viewport_normalized'],
    description:
      'Coordinate space for x/y. Use viewport_normalized for screenshot-derived points.',
  },
} satisfies Record<string, JsonSchema>;

const expectedAfterClickSchema = {
  type: 'object',
  properties: {
    type: {
      const: 'field_contains',
      description: 'Currently supported post-click expectation type.',
    },
    field: {
      type: 'string',
      description: 'Field label/name expected to change after clicking.',
    },
    value: {
      type: 'string',
      description: 'Expected substring in the field value after clicking.',
    },
  },
  required: ['type', 'field', 'value'],
  additionalProperties: false,
} satisfies JsonSchema;

export const HOST_PAGE_AUTOMATION_TOOL_SCHEMAS = {
  host_page_snapshot: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  host_page_click: {
    type: 'object',
    properties: {
      ...targetProperties,
    },
    additionalProperties: false,
  },
  host_page_fill: {
    type: 'object',
    properties: {
      ...targetProperties,
      value: {
        type: 'string',
        description: 'Text value to set on the target field.',
      },
    },
    required: ['value'],
    additionalProperties: false,
  },
  host_page_press: {
    type: 'object',
    properties: {
      ...targetProperties,
      key: {
        type: 'string',
        description: 'Keyboard key to press.',
      },
    },
    required: ['key'],
    additionalProperties: false,
  },
  host_page_select: {
    type: 'object',
    properties: {
      ...targetProperties,
      value: {
        type: ['string', 'array'],
        description: 'Select option value or values.',
        items: { type: 'string' },
      },
      values: {
        type: ['string', 'array'],
        description: 'Select option values.',
        items: { type: 'string' },
      },
    },
    additionalProperties: false,
  },
  host_page_scroll: {
    type: 'object',
    properties: {
      ...targetProperties,
      deltaX: {
        type: 'number',
        description: 'Horizontal scroll delta.',
      },
      deltaY: {
        type: 'number',
        description: 'Vertical scroll delta.',
      },
    },
    additionalProperties: false,
  },
  host_page_navigate: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'HTTP(S) URL to navigate to.',
      },
    },
    required: ['url'],
    additionalProperties: false,
  },
  host_page_hover: {
    type: 'object',
    properties: {
      ...targetProperties,
    },
    additionalProperties: false,
  },
  host_page_focus: {
    type: 'object',
    properties: {
      ...targetProperties,
    },
    additionalProperties: false,
  },
  host_page_pointer: {
    type: 'object',
    properties: {
      ...targetProperties,
      ...pointerCoordinateProperties,
      action: {
        type: 'string',
        enum: ['move', 'down', 'up', 'click'],
        description: 'Pointer action. Defaults to click.',
      },
      button: {
        type: ['string', 'number'],
        description: 'Mouse button.',
      },
      clickCount: {
        type: 'number',
        description: 'Number of clicks for CDP mouse click.',
      },
      targetText: {
        type: 'string',
        description:
          'Required for explicit coordinate clicks. The actual hit target or near ancestor must contain this text.',
      },
      expectedAfterClick: expectedAfterClickSchema,
    },
    additionalProperties: false,
  },
  host_page_screenshot: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['jpeg', 'png'],
        description: 'Screenshot image format.',
      },
      quality: {
        type: 'number',
        description: 'JPEG quality from 1 to 100.',
      },
    },
    additionalProperties: false,
  },
  host_page_wait_for: {
    type: 'object',
    properties: {
      ...targetProperties,
      state: {
        type: 'string',
        enum: ['attached', 'visible', 'hidden', 'detached'],
        description: 'Target state to wait for. Defaults to visible.',
      },
      timeoutSeconds: {
        type: 'number',
        description: 'Maximum wait time in seconds.',
      },
    },
    additionalProperties: false,
  },
} as const satisfies Record<string, JsonSchema>;
