
// ============================================================================
// XpertChatkitOptions - Configuration options for Xpert ChatKit
// Based on OpenAI ChatKit options structure
// ============================================================================

/**
 * Configuration options for initializing Xpert ChatKit.
 */
export type ChatKitOptions = {
  /**
   * Locale override for ChatKit UI. If not provided, the browser's locale
   * will be used. If the locale is not supported, will fall back to English.
   *
   * @see {@link XpertSupportedLocale}
   * @default navigator.language
   */
  locale?: XpertSupportedLocale;

  /**
   * Visual appearance configuration options for ChatKit.
   *
   * @see {@link XpertColorScheme}
   * @see {@link XpertThemeOption}
   * @default "light"
   */
  theme?: XpertColorScheme | XpertThemeOption;

  /**
   * The ID of the thread to show when ChatKit is mounted or opened for the first time.
   * Passing `null` will show the new thread view.
   *
   * @default null
   */
  initialThread?: null | string;

  /**
   * Configuration for the header.
   *
   * @see {@link XpertHeaderOption}
   */
  header?: XpertHeaderOption;

  /**
   * Configuration for the history panel.
   *
   * @see {@link XpertHistoryOption}
   */
  history?: XpertHistoryOption;

  /**
   * Configuration for the start screen.
   *
   * @see {@link XpertStartScreenOption}
   */
  startScreen?: XpertStartScreenOption;

  /**
   * Configuration for the thread item actions.
   *
   * @see {@link XpertThreadItemActionsOption}
   */
  threadItemActions?: XpertThreadItemActionsOption;

  /**
   * Configuration for the composer.
   *
   * @see {@link XpertComposerOption}
   */
  composer?: XpertComposerOption;

  /**
   * Configuration for disclaimer text.
   *
   * @see {@link XpertDisclaimerOption}
   */
  disclaimer?: XpertDisclaimerOption;
};

/** The color scheme to use for the ChatKit UI. */
export type XpertColorScheme = 'light' | 'dark';

/** Visual appearance configuration options for ChatKit. */
export type XpertThemeOption = {
  /**
   * The color scheme to use for the ChatKit UI.
   *
   * @see {@link XpertColorScheme}
   * @default "light"
   */
  colorScheme?: XpertColorScheme;

  /**
   * Typography customization options.
   *
   * @see {@link XpertTypographyOption}
   */
  typography?: XpertTypographyOption;

  /**
   * Determines the overall roundness of the ChatKit UI.
   *
   * @default "pill"
   */
  radius?: 'pill' | 'round' | 'soft' | 'sharp';

  /**
   * Determines the overall spacing of the ChatKit UI.
   *
   * @default "normal"
   */
  density?: 'compact' | 'normal' | 'spacious';

  /**
   * Color customization options.
   *
   * @see {@link XpertColorOption}
   */
  color?: XpertColorOption;
};

export type XpertTypographyOption = {
  /** Base font size in pixels. */
  baseSize?: 14 | 15 | 16 | 17 | 18;
  /**
   * @see {@link XpertFontObject}
   */
  fontSources?: XpertFontObject[];
  fontFamily?: string;
  fontFamilyMono?: string;
};

/**
 * A webfont source used by ChatKit typography.
 */
export type XpertFontObject = {
  /** CSS font-family name. */
  family: string;
  /** URL of the font file. */
  src: string;
  /** Font weight. */
  weight?: string | number;
  /** Font style. */
  style?: 'normal' | 'italic' | 'oblique';
  /** Font rendering behavior. */
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  /** Optional unicode range descriptor. */
  unicodeRange?: string;
};

export type XpertColorOption = {
  /**
   * @see {@link XpertGrayscaleOptions}
   */
  grayscale?: XpertGrayscaleOptions;
  /**
   * @see {@link XpertAccentColor}
   */
  accent?: XpertAccentColor;
  /**
   * @see {@link XpertSurfaceColors}
   */
  surface?: XpertSurfaceColors;
};

/**
 * Controls the grayscale palette derived from the given hue.
 */
export type XpertGrayscaleOptions = {
  /** Hue in degrees (0–360). */
  hue: number;
  /** Tint step applied to the grayscale palette. */
  tint: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** Optional shade adjustment applied to the palette. */
  shade?: -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4;
};

/**
 * Primary accent color used throughout the UI.
 */
export type XpertAccentColor = {
  /** Hex, rgb(a), hsl(a), etc. */
  primary: string;
  /** Intensity level for the accent palette. */
  level: 0 | 1 | 2 | 3;
};

/**
 * Colors for container backgrounds and foreground content.
 */
export type XpertSurfaceColors = {
  /** Background color for surfaces. */
  background: string;
  /** Foreground color (text/icon) for surfaces. */
  foreground: string;
};

export type XpertHeaderOption = {
  /**
   * Enables or disables the header UI.
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * Configuration for header title display, which defaults to showing thread titles.
   */
  title?: {
    /**
     * @default true
     */
    enabled?: boolean;
    /**
     * Static text to show in the header title area. When not provided, the
     * title of the current thread will be shown instead.
     */
    text?: string;
  };
};

export type XpertHistoryOption = {
  /** Enables the history panel. */
  enabled?: boolean;
  /** Shows the delete action for threads. */
  showDelete?: boolean;
  /** Shows the rename action for threads. */
  showRename?: boolean;
};

export type XpertStartScreenOption = {
  /**
   * The greeting text in the new thread view.
   *
   * @default "What can I help with today?"
   */
  greeting?: string;

  /**
   * A list of starter prompts to show above the composer input when in the new thread view.
   *
   * @see {@link XpertStartScreenPrompt}
   */
  prompts?: XpertStartScreenPrompt[];
};

export type XpertStartScreenPrompt = {
  /** Human-readable label shown for the prompt. */
  label: string;
  /**
   * Preset message content submitted as a user message when selected.
   */
  prompt: string;
  /**
   * Optional icon displayed with the prompt.
   *
   * @see {@link XpertIcon}
   */
  icon?: XpertIcon;
};

/**
 * Built-in icon names used by ChatKit for buttons and UI affordances.
 */
export type XpertIcon =
  | 'agent'
  | 'analytics'
  | 'atom'
  | 'batch'
  | 'bolt'
  | 'book-open'
  | 'book-closed'
  | 'book-clock'
  | 'bug'
  | 'calendar'
  | 'chart'
  | 'check'
  | 'check-circle'
  | 'check-circle-filled'
  | 'chevron-left'
  | 'chevron-right'
  | 'circle-question'
  | 'clock'
  | 'compass'
  | 'confetti'
  | 'cube'
  | 'desktop'
  | 'document'
  | 'dots-horizontal'
  | 'dots-vertical'
  | 'empty-circle'
  | 'external-link'
  | 'globe'
  | 'keys'
  | 'lab'
  | 'images'
  | 'info'
  | 'lifesaver'
  | 'lightbulb'
  | 'mail'
  | 'map-pin'
  | 'maps'
  | 'mobile'
  | 'name'
  | 'notebook'
  | 'notebook-pencil'
  | 'page-blank'
  | 'phone'
  | 'play'
  | 'plus'
  | 'profile'
  | 'profile-card'
  | 'reload'
  | 'star'
  | 'star-filled'
  | 'search'
  | 'sparkle'
  | 'sparkle-double'
  | 'square-code'
  | 'square-image'
  | 'square-text'
  | 'suitcase'
  | 'settings-slider'
  | 'user'
  | 'wreath'
  | 'write'
  | 'write-alt'
  | 'write-alt2';

export type XpertThreadItemActionsOption = {
  /**
   * Whether or not to show the response feedback buttons (thumbs up / thumbs
   * down) in the response view.
   * @default false
   */
  feedback?: boolean;
  /**
   * Whether or not to show the retry button in the response view.
   * @default false
   */
  retry?: boolean;
};

export type XpertComposerOption = {
  /**
   * The placeholder text to show in the composer input.
   * @default "Message the AI"
   */
  placeholder?: string;

  /**
   * Configuration for file attachments in the composer.
   */
  attachments?: {
    /**
     * Whether file attachments are enabled in the composer.
     *
     * @default false
     */
    enabled: boolean;
    /**
     * The maximum size of an attachment in bytes.
     *
     * @default 100 * 1024 * 1024 (100MB)
     */
    maxSize?: number;
    /**
     * The maximum number of attachments that can be sent in a single message.
     *
     * @default 10
     */
    maxCount?: number;
    /**
     * The MIME types and extensions that are accepted for file uploads.
     */
    accept?: Record<string, string[]>;
  };

  /**
   * When provided a list of tool options, the user will be able to select a tool
   * from a menu in the composer.
   *
   * @see {@link XpertToolOption}
   */
  tools?: XpertToolOption[];

  /**
   * A list of models that users can choose from before sending a message.
   *
   * @see {@link XpertModelOption}
   */
  models?: XpertModelOption[];
};

/**
 * Describes a selectable tool shown in the composer.
 */
export type XpertToolOption = {
  id: string;

  /** Label displayed in the tool menu */
  label: string;

  /**
   * Icon displayed next to the tool in the menu.
   *
   * @see {@link XpertIcon}
   */
  icon: XpertIcon;

  /** Optional label displayed in the button when the tool is selected. */
  shortLabel?: string;

  /** Optional placeholder text to show in the composer input when the tool is selected. */
  placeholderOverride?: string;

  /**
   * Whether the tool is pinned to the composer outside of the tool menu.
   *
   * @default false
   */
  pinned?: boolean;

  /**
   * Whether the tool continues to be selected after the user submits a message.
   *
   * @default false
   */
  persistent?: boolean;
};

/** Selectable model option shown to end users. */
export type XpertModelOption = {
  /** Identifier used when submitting a message. */
  id: string;

  /** Label displayed in the model picker. */
  label: string;

  /** Optional helper text shown with the option. */
  description?: string;

  /** When true the option is visible but cannot be selected. */
  disabled?: boolean;

  /** Determines if the model should be the default selected option. */
  default?: boolean;
};

export type XpertDisclaimerOption = {
  /** Markdown text displayed below the composer. */
  text: string;
  /** When true, increases contrast for the disclaimer text. */
  highContrast?: boolean;
};

/**
 * Supported locales for ChatKit UI.
 */
export type XpertSupportedLocale =
  | 'en'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja-JP'
  | 'ko-KR'
  | 'de-DE'
  | 'fr-FR'
  | 'es-ES'
  | 'pt-BR'
  | 'ru-RU'
  | 'ar'
  | 'hi-IN'
  | 'th-TH'
  | 'vi-VN'
  | 'id-ID'
  | 'ms-MY'
  | 'it-IT'
  | 'nl-NL'
  | 'pl-PL'
  | 'tr-TR'
  | 'uk-UA'
  | 'cs-CZ'
  | 'sv-SE'
  | 'da-DK'
  | 'fi-FI'
  | 'nb-NO'
  | 'el-GR'
  | 'he'
  | 'hu-HU'
  | 'ro-RO'
  | 'sk-SK'
  | 'bg-BG'
  | 'hr-HR'
  | 'sl-SI'
  | 'sr-RS'
  | 'ca-ES'
  | 'et-EE'
  | 'lv-LV'
  | 'lt';