/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import React, { createContext, useContext, type ReactNode } from "react";
import { Types } from "@a2ui/lit/0.8";

const ThemeContext = createContext<Types.Theme | null>(null);

/**
 * Default theme with Tailwind CSS classes for ShadCN-style components.
 */
export const defaultTheme: Types.Theme = {
  components: {
    AudioPlayer: {},
    Button: {},
    Card: {},
    Column: { flex: true, "flex-col": true, "min-w-0": true, "gap-[var(--density-gap,0.5rem)]": true },
    CheckBox: { container: {}, element: {}, label: {} },
    DateTimeInput: { container: {}, element: {}, label: {} },
    Divider: {
      "shrink-0": true,
      "bg-border": true,
    },
    Image: {
      all: { "max-w-full": true, "h-auto": true },
      icon: { "w-5": true, "h-5": true },
      avatar: { "w-24": true, "h-24": true, "rounded-full": true, "object-cover": true, "mx-auto": true },
      smallFeature: { "w-24": true, "h-auto": true, "rounded-md": true },
      mediumFeature: { "w-48": true, "h-auto": true, "rounded-md": true },
      largeFeature: { "w-96": true, "h-auto": true, "rounded-md": true },
      header: { "w-full": true, "h-auto": true, "rounded-md": true },
    },
    Icon: {
      container: {
        flex: true,
        "items-center": true,
        "justify-center": true,
        "w-10": true,
        "h-10": true,
        "rounded-lg": true,
        "bg-muted": true,
        "shrink-0": true,
      },
      element: {
        "w-5": true,
        "h-5": true,
        "text-muted-foreground": true,
      },
    } as unknown as Record<string, boolean>,
    List: {
      flex: true,
      "overflow-auto": true,
    },
    Modal: { backdrop: {}, element: {} },
    MultipleChoice: { container: {}, element: {}, label: {} },
    Row: {
      flex: true,
      "flex-row": true,
      "gap-2": true,
    },
    Slider: { container: {}, element: {}, label: {} },
    Tabs: { container: {}, element: {}, controls: { all: {}, selected: {} } },
    Text: {
      all: { "leading-normal": true },
      h1: { "text-2xl": true, "font-semibold": true, "tracking-tight": true, "text-foreground": true },
      h2: { "text-xl": true, "font-semibold": true, "tracking-tight": true, "text-foreground": true },
      h3: { "text-lg": true, "font-semibold": true, "tracking-tight": true, "text-foreground": true },
      h4: { "text-base": true, "font-medium": true, "text-foreground": true },
      h5: { "text-sm": true, "font-medium": true, "text-muted-foreground": true },
      caption: { "text-xs": true, "text-muted-foreground": true },
      body: { "text-sm": true, "leading-normal": true, "text-foreground": true },
    },
    TextField: { container: {}, element: {}, label: {} },
    Video: {
      "w-full": true,
      "rounded-md": true,
    },
  },
  elements: {
    a: { "text-primary": true, underline: true, "underline-offset-4": true },
    audio: { "w-full": true },
    body: {},
    button: {},
    h1: { "text-4xl": true, "font-extrabold": true },
    h2: { "text-3xl": true, "font-semibold": true },
    h3: { "text-2xl": true, "font-semibold": true },
    h4: { "text-xl": true, "font-semibold": true },
    h5: { "text-lg": true, "font-semibold": true },
    iframe: { "w-full": true, border: true, "rounded-md": true },
    input: {},
    p: { "leading-7": true },
    pre: { "bg-muted": true, "p-4": true, "rounded-lg": true, "overflow-x-auto": true },
    textarea: {},
    video: { "w-full": true, "rounded-md": true },
  },
  markdown: {
    p: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    ul: [],
    ol: [],
    li: [],
    a: [],
    strong: [],
    em: [],
  },
};

export interface ThemeProviderProps {
  children: ReactNode;
  theme?: Types.Theme;
}

/**
 * Theme Provider for A2UI components.
 * Provides CSS class mappings for all components.
 */
export function ThemeProvider({
  children,
  theme = defaultTheme,
}: ThemeProviderProps) {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

/**
 * Hook to access the theme context.
 * Returns the default theme if no provider is found.
 */
export function useTheme(): Types.Theme {
  const context = useContext(ThemeContext);
  return context ?? defaultTheme;
}
