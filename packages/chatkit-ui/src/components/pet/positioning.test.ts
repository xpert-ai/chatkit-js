import { describe, expect, it } from 'vitest';
import {
  clampPetPosition,
  getPinnedPetPosition,
  normalizeBoundsPadding,
} from './positioning';

describe('pet positioning', () => {
  it('uses viewport edges as the default bounds', () => {
    expect(normalizeBoundsPadding()).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(
      getPinnedPetPosition(
        'bottom-right',
        { width: 96, height: 104 },
        { width: 400, height: 300 },
        normalizeBoundsPadding(),
      ),
    ).toEqual({ x: 304, y: 196 });
  });

  it('pins pets to the configured viewport edge', () => {
    expect(
      getPinnedPetPosition(
        'bottom-right',
        { width: 96, height: 104 },
        { width: 400, height: 300 },
        normalizeBoundsPadding(16),
      ),
    ).toEqual({ x: 288, y: 180 });
  });

  it('clamps dragged positions within bounds', () => {
    expect(
      clampPetPosition(
        { x: 999, y: -40 },
        { width: 96, height: 104 },
        { width: 400, height: 300 },
        normalizeBoundsPadding({ top: 10, right: 20, bottom: 30, left: 40 }),
      ),
    ).toEqual({ x: 284, y: 10 });
  });
});
