import * as React from 'react';

import {
  normalizePetOptions,
  resolvePetCharacter,
  petLookFrame,
  type ChatKitOptions,
  type ChatKitPetAnimationName,
} from '@xpert-ai/chatkit-types';

import { cn } from '../../lib/utils';

export type InlinePetStatusProps = {
  pet: ChatKitOptions['pet'] | null | undefined;
  state: ChatKitPetAnimationName;
  className?: string;
  size?: number | string;
  reducedMotion?: boolean;
};

const INLINE_PET_ANIMATION_SLOWDOWN = 1.5;

function escapeCssUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

export function InlinePetStatus({
  pet,
  state,
  className,
  size,
  reducedMotion,
}: InlinePetStatusProps) {
  const options = React.useMemo(() => normalizePetOptions(pet ?? null), [pet]);
  const character = React.useMemo(
    () => (options ? resolvePetCharacter(options.character) : null),
    [options],
  );
  const container = React.useRef<HTMLSpanElement>(null);
  const [look, setLook] = React.useState<ReturnType<typeof petLookFrame>>(null);
  const canLook =
    options?.character.spriteVersionNumber === 2 &&
    state === 'idle' &&
    !reducedMotion;
  const pose = canLook ? look : null;
  React.useEffect(() => {
    setLook(null);
    if (!canLook || !character) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const rect = container.current?.getBoundingClientRect();
      if (!rect) return;
      const next = petLookFrame(
        event.clientX - rect.left - rect.width / 2,
        event.clientY - rect.top - rect.height / 2,
        rect.height * 0.15,
      );
      setLook((current) =>
        current?.row === next?.row && current?.column === next?.column
          ? current
          : next,
      );
    };
    const reset = () => setLook(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('blur', reset);
    document.documentElement.addEventListener('pointerleave', reset);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', reset);
      document.documentElement.removeEventListener('pointerleave', reset);
    };
  }, [canLook, character?.src]);

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
  const relativeSize = typeof size === 'string';
  const scale = typeof size === 'number' ? size / height : 0.145;
  // Relative-sized pets use their container's font size as one frame height.
  // All atlas offsets use the same unit, so rem changes never crop or misalign frames.
  const spriteLength = (pixels: number) =>
    relativeSize ? `${pixels / height}em` : `${pixels}px`;
  const spriteStyle = {
    width: spriteLength(width),
    height: spriteLength(height),
    transform: relativeSize
      ? 'translate(-50%, -50%)'
      : `translate(-50%, -50%) scale(${scale})`,
    transformOrigin: 'center',
    backgroundImage: `url("${escapeCssUrl(src)}")`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${spriteLength(atlas.columns * width)} ${spriteLength(atlas.rows * height)}`,
    backgroundPositionY: spriteLength(-(pose?.row ?? animation.row) * height),
    backgroundPositionX: spriteLength(-(pose?.column ?? 0) * width),
    imageRendering: options.imageRendering,
    '--chatkit-inline-pet-duration': `${duration}ms`,
    '--chatkit-inline-pet-frames': String(animation.frames),
    '--chatkit-inline-pet-x-end': spriteLength(-animation.frames * width),
    animation: pose || reducedMotion ? 'none' : undefined,
  } as React.CSSProperties;

  return (
    <span
      ref={container}
      aria-hidden="true"
      className={cn(
        'relative inline-flex h-9 w-7 shrink-0 items-center justify-center overflow-hidden',
        className,
      )}
      data-chatkit-inline-pet-status=""
      data-pet-state={state}
      data-sprite-version={options.character.spriteVersionNumber ?? 1}
      data-testid="chatkit-inline-pet-status"
      style={
        size
          ? {
              width: size,
              height: size,
              fontSize: relativeSize ? size : undefined,
            }
          : undefined
      }
    >
      <span
        className="chatkit-inline-pet-status__sprite absolute left-1/2 top-1/2 block"
        style={spriteStyle}
      />
    </span>
  );
}
