/** Versioned input collection. Non-blocking delivery is reserved, not enabled. */
export type UserInputMode = 'blocking' | 'non_blocking';
export type UserInputRequestStatus =
  | 'pending'
  | 'answered'
  | 'cancelled'
  | 'superseded'
  | 'expired';
export type UserInputAnswerDeliveryStatus = 'queued' | 'applied' | 'failed';
export type UserInputValue =
  | string
  | number
  | boolean
  | string[]
  | { start: string; end: string };
export type UserInputValues = { [fieldId: string]: UserInputValue };

export interface UserInputField {
  id: string;
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'select'
    | 'multiselect'
    | 'boolean'
    | 'date'
    | 'date_range';
  label: string;
  description?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

export interface RequestUserInputForm {
  schemaVersion: 1;
  mode: UserInputMode;
  purpose: 'clarification';
  title: string;
  description?: string;
  fields: UserInputField[];
  questions?: never;
}

/** Future async replies are human messages, never a second tool result. */
export interface UserInputResponseMetadata {
  kind: 'user_input_response';
  requestId: string;
  schemaVersion: 1;
  answers: UserInputValues;
}

export const USER_INPUT_SUPPORTED_MODES: readonly UserInputMode[] = [
  'blocking',
];

export const USER_INPUT_FORM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'mode', 'purpose', 'title', 'fields'],
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    mode: { type: 'string', enum: ['blocking'] },
    purpose: { type: 'string', const: 'clarification' },
    title: { type: 'string', minLength: 1, maxLength: 160 },
    description: { type: 'string', maxLength: 2000 },
    fields: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'label'],
        properties: {
          id: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_]{0,63}$' },
          type: {
            type: 'string',
            enum: [
              'text',
              'textarea',
              'number',
              'select',
              'multiselect',
              'boolean',
              'date',
              'date_range',
            ],
          },
          label: { type: 'string', minLength: 1, maxLength: 160 },
          description: { type: 'string', maxLength: 2000 },
          required: { type: 'boolean' },
          options: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['value', 'label'],
              properties: {
                value: { type: 'string', minLength: 1, maxLength: 160 },
                label: { type: 'string', minLength: 1, maxLength: 160 },
              },
            },
          },
          min: { type: 'number' },
          max: { type: 'number' },
          minLength: { type: 'integer', minimum: 0, maximum: 100000 },
          maxLength: { type: 'integer', minimum: 0, maximum: 100000 },
          minItems: { type: 'integer', minimum: 0, maximum: 100 },
          maxItems: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
    },
  },
} as const;

function boundedText(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= max
  );
}

function isOption(value: unknown): value is { value: string; label: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    boundedText(value.value, 160) &&
    'label' in value &&
    boundedText(value.label, 160) &&
    Object.keys(value).every((key) => key === 'value' || key === 'label')
  );
}

function isField(value: unknown): value is UserInputField {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(value.id) ||
    ['constructor', 'prototype', '__proto__'].includes(value.id) ||
    !('type' in value) ||
    typeof value.type !== 'string' ||
    ![
      'text',
      'textarea',
      'number',
      'select',
      'multiselect',
      'boolean',
      'date',
      'date_range',
    ].includes(value.type) ||
    !('label' in value) ||
    !boundedText(value.label, 160)
  )
    return false;
  if (
    Object.keys(value).some(
      (key) =>
        !Object.hasOwn(
          USER_INPUT_FORM_SCHEMA.properties.fields.items.properties,
          key,
        ),
    )
  )
    return false;
  if (
    'description' in value &&
    (typeof value.description !== 'string' || value.description.length > 2000)
  )
    return false;
  if ('required' in value && typeof value.required !== 'boolean') return false;
  if (
    'options' in value &&
    (!Array.isArray(value.options) ||
      value.options.length < 1 ||
      value.options.length > 100 ||
      !value.options.every(isOption) ||
      new Set(value.options.map((option) => option.value)).size !==
        value.options.length)
  )
    return false;
  if (
    (value.type === 'select' || value.type === 'multiselect') !==
    'options' in value
  )
    return false;
  for (const [key, limit] of [
    ['minLength', 100000],
    ['maxLength', 100000],
    ['minItems', 100],
    ['maxItems', 100],
  ] as const) {
    if (key in value) {
      const bound = Reflect.get(value, key);
      if (
        typeof bound !== 'number' ||
        !Number.isInteger(bound) ||
        bound < 0 ||
        bound > limit
      )
        return false;
      if (
        key === 'minItems' || key === 'maxItems'
          ? value.type !== 'multiselect'
          : !['text', 'textarea'].includes(value.type)
      )
        return false;
    }
  }
  for (const key of ['min', 'max'] as const) {
    if (
      key in value &&
      (value.type !== 'number' ||
        typeof Reflect.get(value, key) !== 'number' ||
        !Number.isFinite(Reflect.get(value, key)))
    )
      return false;
  }
  for (const [min, max] of [
    ['min', 'max'],
    ['minLength', 'maxLength'],
    ['minItems', 'maxItems'],
  ] as const) {
    if (
      min in value &&
      max in value &&
      Reflect.get(value, min) > Reflect.get(value, max)
    )
      return false;
  }
  return true;
}

export function isRequestUserInputForm(
  value: unknown,
): value is RequestUserInputForm {
  return (
    !!value &&
    typeof value === 'object' &&
    'schemaVersion' in value &&
    value.schemaVersion === 1 &&
    'mode' in value &&
    (value.mode === 'blocking' || value.mode === 'non_blocking') &&
    'purpose' in value &&
    value.purpose === 'clarification' &&
    'title' in value &&
    boundedText(value.title, 160) &&
    (!('description' in value) ||
      (typeof value.description === 'string' &&
        value.description.length <= 2000)) &&
    'fields' in value &&
    Array.isArray(value.fields) &&
    value.fields.length > 0 &&
    value.fields.length <= 12 &&
    value.fields.every(isField) &&
    new Set(value.fields.map((field) => field.id)).size ===
      value.fields.length &&
    Object.keys(value).every((key) =>
      Object.hasOwn(USER_INPUT_FORM_SCHEMA.properties, key),
    )
  );
}

export type UserInputValidationError =
  | 'required'
  | 'type'
  | 'range'
  | 'choice'
  | 'length'
  | 'date'
  | 'unknown';
export type UserInputValidation =
  | { valid: true; values: UserInputValues }
  | { valid: false; errors: { [fieldId: string]: UserInputValidationError } };

export function isInputDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function validateField(
  field: UserInputField,
  value: unknown,
): UserInputValidationError | null {
  if (value === undefined || value === '')
    return field.required ? 'required' : null;
  if (Array.isArray(value) && value.length === 0 && field.required)
    return 'required';
  switch (field.type) {
    case 'text':
    case 'textarea':
      if (typeof value !== 'string') return 'type';
      if (field.required && !value.trim()) return 'required';
      return value.length < (field.minLength ?? 0) ||
        value.length > (field.maxLength ?? 100000)
        ? 'length'
        : null;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'type';
      return value < (field.min ?? -Infinity) || value > (field.max ?? Infinity)
        ? 'range'
        : null;
    case 'boolean':
      return typeof value === 'boolean' ? null : 'type';
    case 'select':
      return typeof value === 'string' &&
        field.options?.some((option) => option.value === value)
        ? null
        : 'choice';
    case 'multiselect':
      if (
        !Array.isArray(value) ||
        value.some(
          (item) =>
            typeof item !== 'string' ||
            !field.options?.some((option) => option.value === item),
        ) ||
        new Set(value).size !== value.length
      )
        return 'choice';
      return value.length < (field.minItems ?? 0) ||
        value.length > (field.maxItems ?? 100)
        ? 'length'
        : null;
    case 'date':
      return isInputDate(value) ? null : 'date';
    case 'date_range':
      if (
        !value ||
        typeof value !== 'object' ||
        !('start' in value) ||
        !('end' in value) ||
        !isInputDate(value.start) ||
        !isInputDate(value.end) ||
        Object.keys(value).some((key) => key !== 'start' && key !== 'end')
      )
        return 'date';
      return value.start <= value.end ? null : 'range';
  }
}

export function validateUserInputValues(
  form: RequestUserInputForm,
  input: unknown,
): UserInputValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { valid: false, errors: { _form: 'type' } };
  const errors: { [fieldId: string]: UserInputValidationError } = {};
  const values: UserInputValues = {};
  for (const key of Object.keys(input)) {
    if (!form.fields.some((field) => field.id === key))
      return { valid: false, errors: { _form: 'unknown' } };
  }
  for (const field of form.fields) {
    const value: unknown = Object.hasOwn(input, field.id)
      ? Reflect.get(input, field.id)
      : undefined;
    const error = validateField(field, value);
    if (error) errors[field.id] = error;
    else if (value !== undefined && value !== '')
      values[field.id] = value as UserInputValue;
  }
  return Object.keys(errors).length
    ? { valid: false, errors }
    : { valid: true, values };
}
