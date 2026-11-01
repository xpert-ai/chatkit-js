import { describe, expect, it } from 'vitest';
import {
  isRequestUserInputForm,
  validateUserInputValues,
  type RequestUserInputForm,
} from '@xpert-ai/chatkit-types';

export const form: RequestUserInputForm = {
  schemaVersion: 1,
  mode: 'blocking',
  purpose: 'clarification',
  title: 'Sales scope',
  fields: [
    {
      id: 'include_refunds',
      type: 'boolean',
      label: 'Refunds',
      required: true,
    },
    { id: 'minimum', type: 'number', label: 'Minimum', min: 0, required: true },
    {
      id: 'regions',
      type: 'multiselect',
      label: 'Regions',
      options: [
        { value: 'east', label: 'East' },
        { value: 'west', label: 'West' },
      ],
      required: true,
    },
    { id: 'period', type: 'date_range', label: 'Period', required: true },
    { id: 'notes', type: 'textarea', label: 'Notes', maxLength: 100 },
  ],
};
export const values = {
  include_refunds: false,
  minimum: 0,
  regions: ['east'],
  period: { start: '2026-01-01', end: '2026-03-31' },
};

describe('versioned user input validation', () => {
  it('preserves false, zero, arrays and dates without coercion', () => {
    expect(isRequestUserInputForm(form)).toBe(true);
    expect(validateUserInputValues(form, values)).toEqual({
      valid: true,
      values,
    });
  });
  it.each([
    { include_refunds: 'false' },
    { minimum: '0' },
    { minimum: -1 },
    { minimum: Infinity },
    { regions: ['unknown'] },
    { regions: ['east', 'east'] },
    { regions: [] },
    { period: { start: '2026-02-30', end: '2026-03-31' } },
    { period: { start: '2026-04-01', end: '2026-03-31' } },
    { period: { start: '2026-01-01' } },
    { surprise: 'extra' },
  ])('rejects invalid typed input %j', (override) => {
    expect(
      validateUserInputValues(form, { ...values, ...override }).valid,
    ).toBe(false);
  });
  it('rejects duplicate IDs, unsupported field definitions and forged purpose', () => {
    expect(
      isRequestUserInputForm({
        ...form,
        fields: [form.fields[0], form.fields[0]],
      }),
    ).toBe(false);
    expect(
      isRequestUserInputForm({
        ...form,
        purpose: 'implementation_confirmation',
      }),
    ).toBe(false);
    expect(
      isRequestUserInputForm({
        ...form,
        fields: [{ id: 'x', type: 'select', label: 'X' }],
      }),
    ).toBe(false);
    expect(
      isRequestUserInputForm({
        ...form,
        fields: [{ id: 'constructor', type: 'text', label: 'X' }],
      }),
    ).toBe(false);
  });
  it('represents future non-blocking requests without advertising support', () => {
    expect(isRequestUserInputForm({ ...form, mode: 'non_blocking' })).toBe(
      true,
    );
  });
});
