import { Brain, Plug } from 'lucide-react';

import type { RuntimeCapabilityOption } from '../lib/runtime-capabilities';
import { ChatkitAvatar, normalizeChatkitAvatar } from './ui/chatkit-avatar';
import { IconDefinitionRenderer } from './ui/icon-definition';

export function RuntimeCapabilityIcon({
  option,
  variant,
}: {
  option: RuntimeCapabilityOption;
  variant: 'chip' | 'list';
}) {
  const iconSize = variant === 'chip' ? 12 : 16;

  if (option.type === 'skill') {
    return (
      <IconDefinitionRenderer
        icon={option.capability.meta?.icon}
        size={iconSize}
        dataSlot="runtime-capability-meta-icon"
        fallback={<Brain size={iconSize} />}
      />
    );
  }

  if (option.type === 'plugin') {
    return (
      <IconDefinitionRenderer
        icon={option.capability.meta?.icon}
        size={iconSize}
        dataSlot="runtime-capability-meta-icon"
        fallback={<Plug size={iconSize} />}
      />
    );
  }

  return (
    <ChatkitAvatar
      avatar={normalizeChatkitAvatar(option.capability.avatar)}
      label={option.label}
      className={variant === 'chip' ? 'h-4 w-4' : 'h-6 w-6'}
      fallbackClassName={variant === 'chip' ? 'text-[9px]' : 'text-[10px]'}
      imageClassName="object-cover"
      data-slot="runtime-sub-agent-avatar"
    />
  );
}
