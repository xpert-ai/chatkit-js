import { useEffect, useState } from 'react';
import type { EmojiMartData } from '@emoji-mart/data';

function unicodeFromUnified(unified?: string): string | undefined {
  if (!unified?.trim()) return undefined;
  try {
    return unified
      .trim()
      .split('-')
      .map((hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .join('');
  } catch {
    return undefined;
  }
}

/** Older Cloud avatars contain Emoji Mart IDs/shortcodes without a Unicode value. */
export function useAvatarEmoji(emoji?: {
  unified?: string;
  id?: string;
  colons?: string;
}) {
  const native = unicodeFromUnified(emoji?.unified);
  const id = (emoji?.id || emoji?.colons || '').replace(/^:|:$/g, '');
  const [resolved, setResolved] = useState<{ id: string; native?: string }>();
  useEffect(() => {
    if (native || !id) return;
    let active = true;
    // Keep the emoji catalog outside the initial chat bundle.
    void import('@emoji-mart/data/sets/15/native.json')
      .then((module) => {
        const data: EmojiMartData = module.default;
        const item = data.emojis[data.aliases[id] ?? id];
        if (active) setResolved({ id, native: item?.skins[0]?.native });
      })
      .catch(() => {
        /* Retain the normal initials fallback if the catalog is unavailable. */
      });
    return () => {
      active = false;
    };
  }, [id, native]);
  return native || (resolved?.id === id ? resolved.native : undefined);
}
