import type {
  ChatKitOptions,
  ChatKitPetAnimationName,
  ChatKitPetBoundsPadding,
  ChatKitPetCharacter,
  ChatKitPetFrameAnimation,
  ChatKitPetOptions,
  ChatKitPetPin,
  ChatKitPetSpriteAtlas,
} from './options.js';

export type PetFrameAnimationDefinition = {
  row: number;
  frames: number;
  frameDurations: readonly number[];
};

export type PetSpriteAtlasDefinition = {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  animations: Record<ChatKitPetAnimationName, PetFrameAnimationDefinition>;
};

export type NormalizedPetOptions = {
  character: ChatKitPetCharacter;
  position: Required<
    Pick<
      NonNullable<ChatKitPetOptions['position']>,
      'draggable' | 'persist' | 'scale' | 'zIndex'
    >
  > &
    Pick<NonNullable<ChatKitPetOptions['position']>, 'pin' | 'boundsPadding'>;
  behavior: NonNullable<ChatKitPetOptions['behavior']>;
  ariaLabel: string;
  imageRendering: NonNullable<ChatKitPetOptions['imageRendering']>;
};

export type ResolvedPetCharacter =
  {
    kind: 'atlas';
    src: string;
    atlas: PetSpriteAtlasDefinition;
  };

export type PetPosition = {
  x: number;
  y: number;
};

export type PetSize = {
  width: number;
  height: number;
};

export type PetViewport = {
  width: number;
  height: number;
};

export const PET_ANIMATION_NAMES = [
  'idle',
  'running-right',
  'running-left',
  'waving',
  'jumping',
  'failed',
  'waiting',
  'running',
  'review',
] as const satisfies readonly ChatKitPetAnimationName[];

export const petSpriteAtlas = {
  columns: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208,
  animations: {
    idle: {
      row: 0,
      frames: 6,
      frameDurations: [280, 110, 110, 140, 140, 320],
    },
    'running-right': {
      row: 1,
      frames: 8,
      frameDurations: [120, 120, 120, 120, 120, 120, 120, 220],
    },
    'running-left': {
      row: 2,
      frames: 8,
      frameDurations: [120, 120, 120, 120, 120, 120, 120, 220],
    },
    waving: {
      row: 3,
      frames: 4,
      frameDurations: [140, 140, 140, 280],
    },
    jumping: {
      row: 4,
      frames: 5,
      frameDurations: [140, 140, 140, 140, 280],
    },
    failed: {
      row: 5,
      frames: 8,
      frameDurations: [140, 140, 140, 140, 140, 140, 140, 240],
    },
    waiting: {
      row: 6,
      frames: 6,
      frameDurations: [150, 150, 150, 150, 150, 260],
    },
    running: {
      row: 7,
      frames: 6,
      frameDurations: [120, 120, 120, 120, 120, 220],
    },
    review: {
      row: 8,
      frames: 6,
      frameDurations: [150, 150, 150, 150, 150, 280],
    },
  },
} as const satisfies PetSpriteAtlasDefinition;

export const DEFAULT_PET_SIZE = {
  width: petSpriteAtlas.cellWidth,
  height: petSpriteAtlas.cellHeight,
};

export const DEFAULT_PET_BOUNDS_PADDING: ChatKitPetBoundsPadding = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export const DEFAULT_PET_STORAGE_KEY = 'chatkit:pet:position:v1';

export const DEFAULT_PET_SPRITESHEET_URL = '/pets/boba/spritesheet.webp';

const DEFAULT_PET_CHARACTER = {
  type: 'sprite-atlas',
  src: DEFAULT_PET_SPRITESHEET_URL,
} as const satisfies ChatKitPetCharacter;

const DEFAULT_POSITION = {
  pin: 'bottom-right',
  draggable: true,
  scale: 0.25,
  persist: true,
  zIndex: 40,
} as const satisfies NormalizedPetOptions['position'];

function mergeFrameAnimation(
  base: PetFrameAnimationDefinition,
  override?: ChatKitPetFrameAnimation,
): PetFrameAnimationDefinition {
  return {
    row: override?.row ?? base.row,
    frames: override?.frames ?? base.frames,
    frameDurations:
      override?.frameDurations && override.frameDurations.length > 0
        ? override.frameDurations
        : base.frameDurations,
  };
}

export function mergePetSpriteAtlas(
  override?: ChatKitPetSpriteAtlas,
): PetSpriteAtlasDefinition {
  const animations = {} as Record<
    ChatKitPetAnimationName,
    PetFrameAnimationDefinition
  >;

  for (const name of PET_ANIMATION_NAMES) {
    animations[name] = mergeFrameAnimation(
      petSpriteAtlas.animations[name],
      override?.animations?.[name],
    );
  }

  return {
    columns: override?.columns ?? petSpriteAtlas.columns,
    rows: override?.rows ?? petSpriteAtlas.rows,
    cellWidth: override?.cellWidth ?? petSpriteAtlas.cellWidth,
    cellHeight: override?.cellHeight ?? petSpriteAtlas.cellHeight,
    animations,
  };
}

function normalizeCharacter(
  character: ChatKitPetCharacter | undefined,
): ChatKitPetCharacter {
  if (!character) {
    return DEFAULT_PET_CHARACTER;
  }

  if (character.src) {
    return character;
  }

  return DEFAULT_PET_CHARACTER;
}

export function normalizePetOptions(
  pet: ChatKitOptions['pet'] | null,
): NormalizedPetOptions | null {
  if (!pet) {
    return null;
  }

  if (pet === true) {
    return {
      character: DEFAULT_PET_CHARACTER,
      position: DEFAULT_POSITION,
      behavior: 'auto',
      ariaLabel: 'Animated pet',
      imageRendering: 'auto',
    };
  }

  if (pet.enabled === false) {
    return null;
  }

  return {
    character: normalizeCharacter(pet.character),
    position: {
      ...DEFAULT_POSITION,
      ...pet.position,
    },
    behavior: pet.behavior ?? 'auto',
    ariaLabel: pet.ariaLabel ?? 'Animated pet',
    imageRendering: pet.imageRendering ?? 'auto',
  };
}

export function resolvePetCharacter(
  character: ChatKitPetCharacter,
): ResolvedPetCharacter | null {
  if (!character.src) {
    return null;
  }

  return {
    kind: 'atlas',
    src: character.src,
    atlas: mergePetSpriteAtlas(character.atlas),
  };
}

export function normalizeBoundsPadding(
  value?: number | Partial<ChatKitPetBoundsPadding>,
): ChatKitPetBoundsPadding {
  if (typeof value === 'number') {
    return {
      top: value,
      right: value,
      bottom: value,
      left: value,
    };
  }

  return {
    top: value?.top ?? DEFAULT_PET_BOUNDS_PADDING.top,
    right: value?.right ?? DEFAULT_PET_BOUNDS_PADDING.right,
    bottom: value?.bottom ?? DEFAULT_PET_BOUNDS_PADDING.bottom,
    left: value?.left ?? DEFAULT_PET_BOUNDS_PADDING.left,
  };
}

export function clampPetPosition(
  position: PetPosition,
  size: PetSize,
  viewport: PetViewport,
  padding: ChatKitPetBoundsPadding,
): PetPosition {
  const minX = padding.left;
  const minY = padding.top;
  const maxX = Math.max(minX, viewport.width - size.width - padding.right);
  const maxY = Math.max(minY, viewport.height - size.height - padding.bottom);

  return {
    x: Math.min(maxX, Math.max(minX, position.x)),
    y: Math.min(maxY, Math.max(minY, position.y)),
  };
}

export function getPinnedPetPosition(
  pin: ChatKitPetPin,
  size: PetSize,
  viewport: PetViewport,
  padding: ChatKitPetBoundsPadding,
): PetPosition {
  const horizontalCenter = (viewport.width - size.width) / 2;
  const verticalCenter = (viewport.height - size.height) / 2;
  const right = viewport.width - size.width - padding.right;
  const bottom = viewport.height - size.height - padding.bottom;

  switch (pin) {
    case 'top-left':
      return clampPetPosition(
        { x: padding.left, y: padding.top },
        size,
        viewport,
        padding,
      );
    case 'top':
      return clampPetPosition(
        { x: horizontalCenter, y: padding.top },
        size,
        viewport,
        padding,
      );
    case 'top-right':
      return clampPetPosition(
        { x: right, y: padding.top },
        size,
        viewport,
        padding,
      );
    case 'left':
      return clampPetPosition(
        { x: padding.left, y: verticalCenter },
        size,
        viewport,
        padding,
      );
    case 'center':
      return clampPetPosition(
        { x: horizontalCenter, y: verticalCenter },
        size,
        viewport,
        padding,
      );
    case 'right':
      return clampPetPosition(
        { x: right, y: verticalCenter },
        size,
        viewport,
        padding,
      );
    case 'bottom-left':
      return clampPetPosition(
        { x: padding.left, y: bottom },
        size,
        viewport,
        padding,
      );
    case 'bottom':
      return clampPetPosition(
        { x: horizontalCenter, y: bottom },
        size,
        viewport,
        padding,
      );
    case 'bottom-right':
    default:
      return clampPetPosition({ x: right, y: bottom }, size, viewport, padding);
  }
}
