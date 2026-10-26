import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import { useTheme } from '../../providers/Theme';

/** shadcn/Sonner surface, using the same theme tokens as the surrounding ChatKit. */
export function Toaster({ style, toastOptions, ...props }: ToasterProps) {
  const context = useTheme({ optional: true });
  return (
    <Sonner
      theme={context?.isDarkMode ? 'dark' : 'light'}
      className="toaster group"
      style={{
        ...(context && getSurfaceThemeStyle(context.theme)),
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)',
        '--border-radius': 'var(--chat-panel-radius, var(--radius))',
        ...style,
      } as CSSProperties}
      toastOptions={{
        ...toastOptions,
        style: {
          fontFamily: 'inherit',
          fontSize: '0.875rem',
          padding: 'calc(1rem * var(--chat-density-scale, 1))',
          gap: 'calc(0.5rem * var(--chat-density-scale, 1))',
          ...toastOptions?.style,
        },
      }}
      {...props}
    />
  );
}
