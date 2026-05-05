import { describe, expect, it } from 'vitest';
import {
  normalizePetOptions,
  resolvePetCharacter,
} from './pet-resolver';

describe('pet resolver', () => {
  it('uses the default file-backed pet for pet: true', () => {
    const options = normalizePetOptions(true);

    expect(options?.character).toEqual({
      type: 'sprite-atlas',
      src: '/pets/boba/spritesheet.webp',
    });
    expect(options?.position.draggable).toBe(true);
    expect(options?.position.pin).toBe('bottom-right');
    expect(options?.position.persist).toBe(true);
  });

  it('resolves direct spritesheet characters', () => {
    expect(
      resolvePetCharacter({
        type: 'sprite-atlas',
        src: '/pets/boba/spritesheet.webp',
      }),
    ).toMatchObject({
      kind: 'atlas',
      src: '/pets/boba/spritesheet.webp',
    });
  });
});
