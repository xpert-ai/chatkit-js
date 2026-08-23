export type JsonSchema = {
  type?: string | string[];
  enum?: readonly unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
};

const targetProperties = {
  pageStateId: {
    type: 'string',
    description: 'Opaque page state id from the latest v2 host_page_snapshot.',
  },
  documentRef: {
    type: 'string',
    description: 'Document scope from the latest v2 host_page_snapshot.',
  },
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
} satisfies Record<string, JsonSchema>;

const pointerCoordinateProperties = {
  x: {
    type: 'number',
    description: 'Viewport x coordinate.',
  },
  y: {
    type: 'number',
    description: 'Viewport y coordinate.',
  },
  coordinateSpace: {
    type: 'string',
    enum: ['viewport-css-px', 'viewport_normalized'],
    description:
      'Coordinate space for x/y. Use viewport_normalized for screenshot-derived points.',
  },
} satisfies Record<string, JsonSchema>;

const observationTargetSchema = {
  type: 'object',
  properties: {
    documentScope: {
      type: 'string',
      enum: ['same_document', 'current_top'],
    },
    documentRef: { type: 'string' },
    kind: {
      type: 'string',
      enum: ['test_id', 'selector', 'semantic'],
    },
    testId: { type: 'string' },
    selector: { type: 'string' },
    match: { const: 'exact' },
    identity: {
      type: 'object',
      properties: {
        role: { type: 'string' },
        name: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['role'],
      additionalProperties: false,
    },
  },
  required: ['documentScope', 'kind'],
  additionalProperties: false,
} satisfies JsonSchema;

const actionExpectationSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: [
        'field_contains',
        'checked_equals',
        'element_visible',
        'element_hidden',
        'url_matches',
        'text_visible',
      ],
    },
    target: observationTargetSchema,
    scope: {
      type: 'object',
      properties: {
        documentScope: {
          type: 'string',
          enum: ['same_document', 'current_top'],
        },
        documentRef: { type: 'string' },
      },
      required: ['documentScope'],
      additionalProperties: false,
    },
    mode: { type: 'string', enum: ['exact', 'prefix'] },
    value: { type: ['string', 'boolean'] },
  },
  required: ['type'],
  additionalProperties: false,
} satisfies JsonSchema;

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
    properties: {
      pageStateId: {
        type: 'string',
        description:
          'Reuse the cached snapshot state when reading another paginated page.',
      },
    },
    additionalProperties: false,
  },
  host_page_click: {
    type: 'object',
    properties: {
      ...targetProperties,
      expectation: actionExpectationSchema,
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
      expectation: actionExpectationSchema,
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
      expectation: actionExpectationSchema,
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
      expectation: actionExpectationSchema,
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
      x: {
        type: 'number',
        description: 'Absolute horizontal scroll position.',
      },
      y: {
        type: 'number',
        description: 'Absolute vertical scroll position.',
      },
      expectation: actionExpectationSchema,
    },
    additionalProperties: false,
  },
  host_page_navigate: {
    type: 'object',
    properties: {
      pageStateId: targetProperties.pageStateId,
      documentRef: targetProperties.documentRef,
      url: {
        type: 'string',
        description: 'HTTP(S) URL to navigate to.',
      },
      expectation: actionExpectationSchema,
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
          'Required for explicit coordinate clicks. Must exactly match the hit target or a finite actionable ancestor.',
      },
      targetRole: {
        type: 'string',
        description: 'Exact role used to disambiguate coordinate targets.',
      },
      targetContext: {
        type: 'string',
        description: 'Nearby exact context used to disambiguate coordinates.',
      },
      expectation: actionExpectationSchema,
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
  host_page_read: {
    type: 'object',
    properties: {
      blockId: {
        type: 'string',
        description: 'Readable content block id from host_page_snapshot.',
      },
      scope: {
        type: 'string',
        enum: ['visible'],
        description:
          'Visible content scope. Use blockId when a specific readable block is known.',
      },
      query: {
        type: 'string',
        description:
          'Optional text query for selecting relevant readable blocks.',
      },
      page: {
        type: 'number',
        minimum: 1,
        description: '1-based page for long block content.',
      },
      pageSize: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Items, fields, rows, or blocks to return per page.',
      },
      maxChars: {
        type: 'number',
        minimum: 500,
        maximum: 12000,
        description: 'Maximum characters to return.',
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
