import { defaultTheme, type Theme } from '@xpert-ai/a2ui-react';

/** Host tokens style standard A2UI primitives without inspecting producer names or data. */
export const widgetTheme: Theme = {
  ...defaultTheme,
  components: {
    ...defaultTheme.components,
    Column: {
      flex: true,
      'flex-col': true,
      'min-w-0': true,
      'gap-[var(--density-gap,0.5rem)]': true,
    },
    // Each column retains a readable measure width and naturally stacks in narrow chat panels.
    Row: {
      flex: true,
      'flex-wrap': true,
      'gap-[var(--density-padding,1rem)]': true,
      '[&>div]:flex-1': true,
      '[&>div]:min-w-[min(100%,14rem)]': true,
    },
    Text: {
      all: { 'min-w-0': true, 'break-words': true, '[&_p]:m-0': true },
      h1: {
        'text-3xl': true,
        'font-semibold': true,
        'text-foreground': true,
        'tabular-nums': true,
        'tracking-tight': true,
      },
      h2: {
        'text-2xl': true,
        'font-semibold': true,
        'text-foreground': true,
        'tabular-nums': true,
        'tracking-tight': true,
      },
      h3: { 'text-base': true, 'font-semibold': true, 'text-foreground': true },
      h4: { 'text-base': true, 'font-medium': true, 'text-foreground': true },
      h5: { 'text-sm': true, 'font-medium': true, 'text-foreground': true },
      caption: { 'text-xs': true, 'text-muted-foreground': true },
      body: {
        'text-sm': true,
        'text-foreground': true,
        'leading-relaxed': true,
      },
    },
    Card: {
      'rounded-chat-panel': true,
      border: true,
      'border-border': true,
      'bg-background': true,
      'p-[var(--density-padding,1rem)]': true,
    },
  },
};
