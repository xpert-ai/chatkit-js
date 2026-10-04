export type AssistantCharacterConfig = {
  shape:
    | 'round'
    | 'pebble'
    | 'pill'
    | 'drop'
    | 'flame'
    | 'triangle'
    | 'square'
    | 'bag'
    | 'star'
    | 'heart'
    | 'cloud'
    | 'clover';
  eyes:
    | 'oval'
    | 'toon'
    | 'pill'
    | 'dot'
    | 'ring'
    | 'happy'
    | 'sleepy'
    | 'wink'
    | 'plus'
    | 'slash'
    | 'squint';
  mouth: 'none' | 'smile' | 'open' | 'neutral' | 'o';
  motion: 'float' | 'bounce' | 'sway' | 'none';
  eyeSize: number;
  eyeSpacing: number;
  brows?: 'none' | 'flat' | 'angry' | 'worried' | 'raised';
  ink?: 'auto' | 'dark' | 'light';
  tilt?: number;
  speed?: number;
  blink?: boolean;
};

/** IDs are resource identifiers, not a closed list of bundled presets. */
export type AssistantAppearance =
  | { version: 1; kind: 'image' }
  | {
      version: 1;
      kind: 'character';
      id: string;
      color: string;
      config?: AssistantCharacterConfig;
    }
  | {
      version: 1;
      kind: 'pet';
      id: string;
      /** Sprite layout version; omitted by legacy v1 avatars. */
      spriteVersionNumber?: 1 | 2;
      asset?: { type: 'sprite-atlas' | 'animated-image'; url: string };
    };

export const CHATKIT_ASSISTANT_CUSTOMIZE_EFFECT = 'assistant.customize';
export type AssistantCustomizeEffect = { assistantId: string };

export function parseAssistantAppearance(
  value: unknown,
): AssistantAppearance | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('kind' in value)
  )
    return;
  if (value.kind === 'image') return { version: 1, kind: 'image' };
  if (
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value.id)
  )
    return;
  if (
    value.kind === 'character' &&
    'color' in value &&
    typeof value.color === 'string' &&
    /^#[0-9a-f]{6}$/i.test(value.color)
  ) {
    if (
      'config' in value &&
      value.config !== undefined &&
      !isCharacterConfig(value.config)
    )
      return;
    return value as Extract<AssistantAppearance, { kind: 'character' }>;
  }
  if (value.kind === 'pet') {
    if (
      'spriteVersionNumber' in value &&
      value.spriteVersionNumber !== undefined &&
      value.spriteVersionNumber !== 1 &&
      value.spriteVersionNumber !== 2
    ) return;
    if ('asset' in value && value.asset !== undefined) {
      const asset = value.asset;
      if (
        !asset ||
        typeof asset !== 'object' ||
        !('type' in asset) ||
        !['sprite-atlas', 'animated-image'].includes(String(asset.type)) ||
        !('url' in asset) ||
        typeof asset.url !== 'string' ||
        asset.url.length > 4096 ||
        !/^(https?:\/\/|\/(?!\/))/.test(asset.url)
      )
        return;
    }
    return value as Extract<AssistantAppearance, { kind: 'pet' }>;
  }
}

function isCharacterConfig(value: unknown): value is AssistantCharacterConfig {
  return (
    !!value &&
    typeof value === 'object' &&
    'shape' in value &&
    [
      'round',
      'pebble',
      'pill',
      'drop',
      'flame',
      'triangle',
      'square',
      'bag',
      'star',
      'heart',
      'cloud',
      'clover',
    ].includes(String(value.shape)) &&
    'eyes' in value &&
    [
      'oval',
      'toon',
      'pill',
      'dot',
      'ring',
      'happy',
      'sleepy',
      'wink',
      'plus',
      'slash',
      'squint',
    ].includes(String(value.eyes)) &&
    'mouth' in value &&
    ['none', 'smile', 'open', 'neutral', 'o'].includes(String(value.mouth)) &&
    'motion' in value &&
    ['float', 'bounce', 'sway', 'none'].includes(String(value.motion)) &&
    'eyeSize' in value &&
    typeof value.eyeSize === 'number' &&
    Number.isFinite(value.eyeSize) &&
    value.eyeSize >= 0.6 &&
    value.eyeSize <= 1.5 &&
    'eyeSpacing' in value &&
    typeof value.eyeSpacing === 'number' &&
    Number.isFinite(value.eyeSpacing) &&
    value.eyeSpacing >= 0.55 &&
    value.eyeSpacing <= 1.6 &&
    (!('brows' in value) ||
      value.brows === undefined ||
      ['none', 'flat', 'angry', 'worried', 'raised'].includes(
        String(value.brows),
      )) &&
    (!('ink' in value) ||
      value.ink === undefined ||
      ['auto', 'dark', 'light'].includes(String(value.ink))) &&
    (!('tilt' in value) ||
      value.tilt === undefined ||
      (typeof value.tilt === 'number' &&
        Number.isFinite(value.tilt) &&
        value.tilt >= -15 &&
        value.tilt <= 15)) &&
    (!('speed' in value) ||
      value.speed === undefined ||
      (typeof value.speed === 'number' &&
        Number.isFinite(value.speed) &&
        value.speed >= 0.5 &&
        value.speed <= 2)) &&
    (!('blink' in value) ||
      value.blink === undefined ||
      typeof value.blink === 'boolean')
  );
}
