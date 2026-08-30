import { describe, expect, it } from 'vitest';

import {
  normalizeModelOptions,
  resolveSelectedModelId,
} from './assistant-models';

describe('assistant models', () => {
  const models = [
    { id: 'mdl_primary', label: 'Primary', default: true },
    { id: 'mdl_fast', label: 'Fast' },
    { id: 'mdl_disabled', label: 'Disabled', disabled: true },
  ];

  it('keeps an enabled requested model', () => {
    expect(resolveSelectedModelId(models, 'mdl_fast')).toBe('mdl_fast');
  });

  it('falls back to the enabled default for an invalid or disabled model', () => {
    expect(resolveSelectedModelId(models, 'mdl_missing')).toBe('mdl_primary');
    expect(resolveSelectedModelId(models, 'mdl_disabled')).toBe('mdl_primary');
  });

  it('removes invalid and duplicate custom model options', () => {
    expect(
      normalizeModelOptions([
        ...models,
        { id: 'mdl_fast', label: 'Duplicate' },
        { id: '', label: 'Missing id' },
        { id: 'mdl_missing_label', label: '' },
      ]),
    ).toEqual(models);
  });
});
