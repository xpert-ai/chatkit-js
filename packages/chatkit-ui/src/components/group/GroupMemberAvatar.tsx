import { AssistantCharacter } from '../chat/header/AssistantCharacter';
import {
  ChatkitAvatar,
  normalizeChatkitAvatar,
  type ChatkitAvatarProps,
} from '../ui/chatkit-avatar';
import { cn, getRoundedClass } from '../../lib/utils';
import { useTheme } from '../../providers/Theme';

/** Use the same character/pet appearance as an Assistant's ordinary chat header. */
export function GroupMemberAvatar({
  avatar,
  className,
  label,
  ...props
}: ChatkitAvatarProps) {
  const { theme } = useTheme();
  const resolved = normalizeChatkitAvatar(avatar);
  if (
    resolved?.appearance?.kind === 'character' ||
    resolved?.appearance?.kind === 'pet'
  ) {
    return (
      <span
        className={cn(
          'relative inline-flex size-10 shrink-0 overflow-hidden',
          getRoundedClass(theme.radius),
          className,
        )}
      >
        <AssistantCharacter
          avatar={resolved}
          name={label}
          state="idle"
          size="100%"
          reducedMotion
        />
      </span>
    );
  }
  return (
    <ChatkitAvatar
      avatar={resolved}
      className={className}
      label={label}
      {...props}
    />
  );
}
