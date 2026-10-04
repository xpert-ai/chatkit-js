import * as React from 'react';

import type { Assistant } from '@xpert-ai/xpert-sdk';
import { parseAssistantAppearance, type AssistantAppearance } from '@xpert-ai/chatkit-types';

import { cn, getRoundedClass } from '../../lib/utils';
import { useTheme } from '../../providers/Theme';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

export type ChatkitAvatarData = {
  appearance?: AssistantAppearance;
  background?: string;
  emoji?: {
    colons?: string;
    id?: string;
    unified?: string;
  };
  url?: string;
  useNotoColor?: boolean;
};

export type ChatkitAvatarProps = React.ComponentProps<typeof Avatar> & {
  avatar?: ChatkitAvatarData | null;
  fallback?: React.ReactNode;
  fallbackClassName?: string;
  imageClassName?: string;
  label: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function getNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function unicodeFromUnified(unified?: string): string | undefined {
  const normalized = getNonEmptyString(unified);
  if (!normalized) return undefined;

  try {
    return normalized
      .split('-')
      .map((hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .join('');
  } catch {
    return undefined;
  }
}

function getEmojiCharacter(avatar?: ChatkitAvatarData | null): string | undefined {
  return unicodeFromUnified(avatar?.emoji?.unified);
}

export function getAvatarFallback(label: string): string {
  return label.trim().charAt(0).toUpperCase() || 'A';
}

export function normalizeChatkitAvatar(rawAvatar: unknown): ChatkitAvatarData | null {
  if (typeof rawAvatar === 'string') {
    const url = getNonEmptyString(rawAvatar);
    return url ? { url } : null;
  }

  const avatarRecord = asRecord(rawAvatar);
  if (!avatarRecord) return null;

  const emojiRecord = asRecord(avatarRecord.emoji);
  const avatar: ChatkitAvatarData = {
    appearance: parseAssistantAppearance(avatarRecord.appearance),
    background: getNonEmptyString(avatarRecord.background),
    url: getNonEmptyString(avatarRecord.url),
    useNotoColor: Boolean(avatarRecord.useNotoColor),
  };

  if (emojiRecord) {
    avatar.emoji = {
      colons: getNonEmptyString(emojiRecord.colons),
      id: getNonEmptyString(emojiRecord.id),
      unified: getNonEmptyString(emojiRecord.unified),
    };
  }

  return avatar.appearance || avatar.url || avatar.background || avatar.emoji?.id || avatar.emoji?.unified ? avatar : null;
}

export function extractAssistantAvatar(assistant: Assistant): ChatkitAvatarData | null {
  const assistantRecord = asRecord(assistant);
  const metadata = asRecord(assistant.metadata);
  const rawAvatar = assistantRecord?.avatar ?? metadata?.avatar;

  const avatar = normalizeChatkitAvatar(rawAvatar);
  if (avatar) return avatar;

  const metadataAvatar =
    getNonEmptyString(metadata?.avatarUrl) ??
    getNonEmptyString(metadata?.avatar_url);

  return metadataAvatar ? { url: metadataAvatar } : null;
}

export function ChatkitAvatar({
  avatar,
  className,
  fallback,
  fallbackClassName,
  imageClassName,
  label,
  style,
  ...props
}: ChatkitAvatarProps) {
  const { theme } = useTheme();
  const emojiCharacter = getEmojiCharacter(avatar);
  const fallbackText = fallback || getAvatarFallback(label);
  const roundedClass = getRoundedClass(theme.radius);
  const emojiStyle = avatar?.useNotoColor
    ? { fontFamily: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif' }
    : undefined;
  return (
    <Avatar
      className={cn('[container-type:inline-size]', roundedClass, className)}
      style={{ background: avatar?.background, ...style }}
      {...props}
    >
      {avatar?.url ? (
        <AvatarImage className={imageClassName} src={avatar.url} alt={label} />
      ) : null}
      <AvatarFallback
        className={cn('rounded-[inherit] text-sm font-medium text-foreground', avatar?.background && 'bg-transparent', fallbackClassName)}
      >
        {emojiCharacter ? (
          <span className="text-[50cqi] leading-none" style={emojiStyle}>
            {emojiCharacter}
          </span>
        ) : (
          fallbackText
        )}
      </AvatarFallback>
    </Avatar>
  );
}
