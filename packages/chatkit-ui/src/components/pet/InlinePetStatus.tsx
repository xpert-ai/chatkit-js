import * as React from 'react';

import {
  normalizePetOptions,
  resolvePetCharacter,
  type ChatKitOptions,
  type ChatKitPetAnimationName,
} from '@xpert-ai/chatkit-types';

import { cn } from '../../lib/utils';

export type InlinePetStatusProps = {
  pet: ChatKitOptions['pet'] | null | undefined;
  state: ChatKitPetAnimationName;
  className?: string;
};

const INLINE_PET_ANIMATION_SLOWDOWN = 1.5;

function escapeCssUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

export function InlinePetStatus({
  pet,
  state,
  className,
}: InlinePetStatusProps) {
  const options = React.useMemo(() => normalizePetOptions(pet ?? null), [pet]);
  const character = React.useMemo(
    () => (options ? resolvePetCharacter(options.character) : null),
    [options],
  );

  if (!options || !character) {
    return null;
  }

  const { atlas, src } = character;
  const animation = atlas.animations[state];
  const width = atlas.cellWidth;
  const height = atlas.cellHeight;
  const duration =
    animation.frameDurations.reduce(
      (total, frameDuration) => total + frameDuration,
      0,
    ) * INLINE_PET_ANIMATION_SLOWDOWN;
  const scale = 0.145;
  const spriteStyle = {
    width,
    height,
    transform: `translate(-50%, -50%) scale(${scale})`,
    transformOrigin: 'center',
    backgroundImage: `url("${escapeCssUrl(src)}")`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${atlas.columns * width}px ${atlas.rows * height}px`,
    backgroundPositionY: `-${animation.row * height}px`,
    imageRendering: options.imageRendering,
    '--chatkit-inline-pet-duration': `${duration}ms`,
    '--chatkit-inline-pet-frames': String(animation.frames),
    '--chatkit-inline-pet-x-end': `-${animation.frames * width}px`,
  } as React.CSSProperties;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex h-9 w-7 shrink-0 items-center justify-center overflow-hidden',
        className,
      )}
      data-chatkit-inline-pet-status=""
      data-pet-state={state}
      data-testid="chatkit-inline-pet-status"
    >
      <span
        className="chatkit-inline-pet-status__sprite absolute left-1/2 top-1/2 block"
        style={spriteStyle}
      />
    </span>
  );
}
