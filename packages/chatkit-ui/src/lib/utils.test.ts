import { describe, expect, it } from 'vitest';

import { getMenuItemRoundedClass, getPanelRoundedClass } from './utils';

describe('theme utility classes', () => {
  it('uses radius-sized panel rounding without turning pill panels into capsules', () => {
    expect(getPanelRoundedClass('pill')).toBe('rounded-3xl');
    expect(getPanelRoundedClass('round')).toBe('rounded-xl');
    expect(getPanelRoundedClass('soft')).toBe('rounded-lg');
    expect(getPanelRoundedClass('sharp')).toBe('rounded-none');
    expect(getPanelRoundedClass(undefined)).toBe('rounded-lg');
  });

  it('uses smaller radius steps for menu items inside panels', () => {
    expect(getMenuItemRoundedClass('pill')).toBe('rounded-xl');
    expect(getMenuItemRoundedClass('round')).toBe('rounded-lg');
    expect(getMenuItemRoundedClass('soft')).toBe('rounded-md');
    expect(getMenuItemRoundedClass('sharp')).toBe('rounded-none');
    expect(getMenuItemRoundedClass(undefined)).toBe('rounded-md');
  });
});
