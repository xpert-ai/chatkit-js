export type {
  ChatKitDisplayMode,
  ChatKitExtensionConfig,
  ConfigValidationIssue,
  ConfigValidationResult,
  OverlayPosition,
} from './types';
export type { ExtensionLocale, I18n, I18nKey } from './i18n';
export {
  DEFAULT_EXTENSION_CONFIG,
  EXTENSION_LOCALE_OPTIONS,
  STORAGE_KEY,
  getMissingConfigMessage,
  normalizeConfig,
  validateConfig,
} from './config';
export { createChatKitOptions } from './chatkit-options';
export {
  createI18n,
  formatConfigIssues,
  getConfigIssueMessage,
  resolveExtensionLocale,
} from './i18n';
