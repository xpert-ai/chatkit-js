import { useReducedMotion } from 'framer-motion';
import {
  customCharacterSvg,
  type ChatKitPetAnimationName,
} from '@xpert-ai/chatkit-types';
import { InlinePetStatus } from '../../pet/InlinePetStatus';
import { getIncludedPetOption } from '../../pet/builtinPets';
import { ChatkitAvatar, type ChatkitAvatarData } from '../../ui/chatkit-avatar';

export function AssistantCharacter({
  avatar,
  name,
  state,
  size = 80,
  reducedMotion = false,
}: {
  avatar: ChatkitAvatarData | null;
  name: string;
  state: ChatKitPetAnimationName;
  size?: number | string;
  reducedMotion?: boolean;
}) {
  const systemReducedMotion = useReducedMotion();
  const still = reducedMotion || !!systemReducedMotion;
  const appearance = avatar?.appearance;
  if (appearance?.kind === 'character' && appearance.config) {
    return (
      <img
        alt={name}
        src={customCharacterSvg(appearance, state, !still)}
        width={typeof size === 'number' ? size : undefined}
        height={typeof size === 'number' ? size : undefined}
        className="object-contain"
        style={{ width: size, height: size }}
        data-character-state={state}
      />
    );
  }
  if (appearance?.kind === 'pet') {
    if (appearance.asset?.type === 'animated-image')
      return (
        <img
          alt={name}
          src={still ? avatar?.url : appearance.asset.url}
          width={typeof size === 'number' ? size : undefined}
          height={typeof size === 'number' ? size : undefined}
          className="object-contain"
          style={{ width: size, height: size }}
          data-character-state={state}
        />
      );
    return (
      <InlinePetStatus
        size={size}
        state={state}
        reducedMotion={still}
        pet={{
          character: {
            type: 'sprite-atlas',
            spriteVersionNumber:
              appearance.spriteVersionNumber ??
              (!appearance.asset
                ? getIncludedPetOption(appearance.id)?.character
                    .spriteVersionNumber
                : undefined),
            src:
              appearance.asset?.url ??
              `/pets/${appearance.id}/spritesheet.webp`,
          },
        }}
      />
    );
  }
  const animated = !still && (!avatar || appearance?.kind === 'character');
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      data-character-state={state}
    >
      <span
        className={
          animated && state !== 'failed' && state !== 'waiting'
            ? 'chatkit-assistant-character-motion block size-full'
            : 'block size-full'
        }
      >
        {(avatar?.url || avatar?.emoji) &&
        !(appearance?.kind === 'character' && appearance.id === 'bosi') ? (
          <ChatkitAvatar
            avatar={avatar}
            label={name}
            className="size-full overflow-visible bg-transparent"
            imageClassName="object-contain"
            fallbackClassName="bg-transparent"
          />
        ) : (
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={name}
            className="size-full text-primary"
            style={
              appearance?.kind === 'character'
                ? { color: appearance.color }
                : undefined
            }
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d={
                  state === 'running' || state === 'review'
                    ? 'M23 39 L39 46 L23 53'
                    : 'M23 31 L39 46 L23 60'
                }
                strokeWidth="7.5"
              />
              <path
                d={
                  state === 'waiting'
                    ? 'M64 47 Q71 41 78 47'
                    : 'M78 35 L64 46 L78 59'
                }
                strokeWidth="3.3"
              />
              <path
                d={
                  state === 'failed'
                    ? 'M39 78 Q50 63 61 78'
                    : 'M39 70 Q50 78 61 70'
                }
                strokeWidth="4.4"
              />
            </g>
          </svg>
        )}
      </span>
    </span>
  );
}
