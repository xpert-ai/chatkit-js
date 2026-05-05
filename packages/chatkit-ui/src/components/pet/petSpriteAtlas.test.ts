import { describe, expect, it } from 'vitest';
import { petSpriteAtlas } from './petSpriteAtlas';

describe('petSpriteAtlas', () => {
  it('matches the sprite atlas 8x9 contract', () => {
    expect(petSpriteAtlas.columns).toBe(8);
    expect(petSpriteAtlas.rows).toBe(9);
    expect(petSpriteAtlas.cellWidth).toBe(192);
    expect(petSpriteAtlas.cellHeight).toBe(208);
    expect(petSpriteAtlas.animations.idle).toMatchObject({
      row: 0,
      frames: 6,
    });
    expect(petSpriteAtlas.animations['running-right']).toMatchObject({
      row: 1,
      frames: 8,
    });
    expect(petSpriteAtlas.animations['running-left']).toMatchObject({
      row: 2,
      frames: 8,
    });
    expect(petSpriteAtlas.animations.waving).toMatchObject({
      row: 3,
      frames: 4,
    });
    expect(petSpriteAtlas.animations.jumping).toMatchObject({
      row: 4,
      frames: 5,
    });
    expect(petSpriteAtlas.animations.failed).toMatchObject({
      row: 5,
      frames: 8,
    });
    expect(petSpriteAtlas.animations.waiting).toMatchObject({
      row: 6,
      frames: 6,
    });
    expect(petSpriteAtlas.animations.running).toMatchObject({
      row: 7,
      frames: 6,
    });
    expect(petSpriteAtlas.animations.review).toMatchObject({
      row: 8,
      frames: 6,
    });
  });
});
