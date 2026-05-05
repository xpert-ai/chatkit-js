import * as React from 'react';

import { cn } from '../../lib/utils';
import { petSpriteAtlas } from './petSpriteAtlas';

export type PetPreviewProps = {
  src: string;
  label: string;
  className?: string;
};

function escapeCssUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

export function PetPreview({ src, label, className }: PetPreviewProps) {
  const scale = 0.13;
  const width = petSpriteAtlas.cellWidth;
  const height = petSpriteAtlas.cellHeight;

  return (
    <span
      className={cn(
        'relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-muted/30',
        className,
      )}
      aria-hidden="true"
      title={label}
    >
      <span
        className="absolute left-1/2 top-1/2 block"
        style={{
          width,
          height,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center',
          backgroundImage: `url("${escapeCssUrl(src)}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${petSpriteAtlas.columns * width}px ${
            petSpriteAtlas.rows * height
          }px`,
          backgroundPosition: '0px 0px',
          imageRendering: 'auto',
        }}
      />
    </span>
  );
}
