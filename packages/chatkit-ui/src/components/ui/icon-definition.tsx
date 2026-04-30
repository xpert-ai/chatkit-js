import * as React from 'react';
import type { IconDefinition } from '@xpert-ai/xpert-sdk';

import { cn } from '../../lib/utils';

export type IconDefinitionRendererProps = {
  icon?: IconDefinition | null;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
  decorative?: boolean;
  dataSlot?: string;
};

function getIconStyle(
  icon: IconDefinition,
  size?: number,
): React.CSSProperties | undefined {
  const style: React.CSSProperties = {
    ...icon.style,
  };
  const resolvedSize = size ?? icon.size;

  if (icon.color) {
    style.color = icon.color;
  }

  if (resolvedSize) {
    style.width = resolvedSize;
    style.height = resolvedSize;
    if (icon.type === 'emoji' || icon.type === 'font') {
      style.fontSize = resolvedSize;
    }
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function getInlineSvgMarkup(value: string): string | null {
  const markup = value.trim().replace(/^<\?xml[\s\S]*?\?>\s*/i, '');
  if (!/^<svg[\s>]/i.test(markup)) {
    return null;
  }

  return markup
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

function getAccessibilityProps(icon: IconDefinition, decorative: boolean) {
  if (decorative) {
    return { 'aria-hidden': true };
  }

  return {
    role: 'img',
    'aria-label': icon.alt,
  };
}

export function IconDefinitionRenderer({
  icon,
  size,
  className,
  fallback = null,
  decorative = true,
  dataSlot = 'icon-definition',
}: IconDefinitionRendererProps) {
  if (!icon) {
    return fallback;
  }

  const style = getIconStyle(icon, size);
  const accessibilityProps = getAccessibilityProps(icon, decorative);

  if (icon.type === 'emoji') {
    return (
      <span
        {...accessibilityProps}
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center align-middle text-base leading-none',
          className,
        )}
        data-slot={dataSlot}
        style={style}
      >
        {icon.value}
      </span>
    );
  }

  if (icon.type === 'font') {
    return (
      <i
        {...accessibilityProps}
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center align-middle text-base leading-none',
          icon.value,
          className,
        )}
        data-slot={dataSlot}
        style={style}
      />
    );
  }

  if (icon.type === 'image') {
    return (
      <img
        alt={decorative ? '' : (icon.alt ?? '')}
        aria-hidden={decorative ? true : undefined}
        className={cn(
          'h-4 w-4 shrink-0 object-contain align-middle',
          className,
        )}
        data-slot={dataSlot}
        src={icon.value}
        style={style}
      />
    );
  }

  if (icon.type === 'svg') {
    const svgMarkup = getInlineSvgMarkup(icon.value);
    if (svgMarkup) {
      return (
        <span
          {...accessibilityProps}
          className={cn(
            'inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden align-middle [&_svg]:h-full! [&_svg]:w-full! [&_svg]:shrink-0',
            className,
          )}
          data-slot={dataSlot}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
          style={style}
        />
      );
    }

    return (
      <img
        alt={decorative ? '' : (icon.alt ?? '')}
        aria-hidden={decorative ? true : undefined}
        className={cn(
          'h-4 w-4 shrink-0 object-contain align-middle',
          className,
        )}
        data-slot={dataSlot}
        src={icon.value}
        style={style}
      />
    );
  }

  return fallback;
}
