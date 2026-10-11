import { describe, expect, it } from 'vitest';

import {
  cn,
  getComposerInputRoundedClass,
  getMenuItemRoundedClass,
  getPanelRoundedClass,
} from './utils';

describe('theme utility classes', () => {
  it('lets component radius overrides replace semantic defaults', () => {
    const smallButtonRadius =
      'rounded-[min(var(--chat-item-radius,var(--radius-md)),8px)]';

    expect(cn('rounded-chat-item', smallButtonRadius)).toBe(smallButtonRadius);
    expect(cn('rounded-md', 'rounded-chat-item')).toBe('rounded-chat-item');
    expect(cn('rounded-chat-panel', 'rounded-none')).toBe('rounded-none');
    expect(cn('rounded-chat-item', 'rounded-chat-panel')).toBe(
      'rounded-chat-panel',
    );
  });

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

  it('uses bounded rounding for the composer input shell', () => {
    expect(getComposerInputRoundedClass('pill')).toBe('rounded-3xl');
    expect(getComposerInputRoundedClass('round')).toBe('rounded-xl');
    expect(getComposerInputRoundedClass('soft')).toBe('rounded-lg');
    expect(getComposerInputRoundedClass('sharp')).toBe('rounded-none');
    expect(getComposerInputRoundedClass(undefined)).toBe('rounded-xl');
  });

  it('keeps an empty pill composer input capsule-shaped while inline', () => {
    expect(
      getComposerInputRoundedClass('pill', {
        isEmpty: true,
        isStacked: false,
      }),
    ).toBe('rounded-full');
    expect(
      getComposerInputRoundedClass('pill', {
        isEmpty: true,
        isStacked: true,
      }),
    ).toBe('rounded-3xl');
    expect(
      getComposerInputRoundedClass('pill', {
        isEmpty: false,
        isStacked: false,
      }),
    ).toBe('rounded-3xl');
  });
});
