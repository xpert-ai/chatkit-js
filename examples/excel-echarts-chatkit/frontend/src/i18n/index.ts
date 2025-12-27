import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from './locales/en-US.json';
import zhCN from './locales/zh-CN.json';
import { SupportedLocale } from '@xpert-ai/chatkit-types';

const localeStorageKey = 'excel-echarts-chatkit:locale';

export const supportedLocales = ['en-US', 'zh-CN'] as SupportedLocale[];

const defaultLocale = 'en-US' as SupportedLocale;

function normalizeLocale(locale?: string | null): SupportedLocale {
  if (!locale) return defaultLocale;
  const normalized = locale.trim();
  if (!normalized) return defaultLocale;
  if (normalized === 'zh-CN' || normalized.startsWith('zh')) return 'zh-CN' as SupportedLocale;
  if (normalized === 'en-US' || normalized.startsWith('en')) return 'en-US' as SupportedLocale;
  return defaultLocale;
}

function getStoredLocale(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(localeStorageKey);
  } catch {
    return null;
  }
}

function getBrowserLocale(): string | null {
  if (typeof navigator === 'undefined') return null;
  return navigator.language || null;
}

export function initI18n() {
  if (i18n.isInitialized) return i18n;

  const initialLocale = normalizeLocale(getStoredLocale() ?? getBrowserLocale());

  void i18n
    .use(initReactI18next)
    .init({
      resources: {
        'en-US': { translation: enUS },
        'zh-CN': { translation: zhCN },
      },
      lng: initialLocale,
      fallbackLng: defaultLocale,
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
      initImmediate: false,
    });

  return i18n;
}

export function setLanguage(locale?: string | null): SupportedLocale {
  const resolved = normalizeLocale(locale);
  initI18n();
  void i18n.changeLanguage(resolved);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(localeStorageKey, resolved);
    } catch {
      // ignore storage errors
    }
  }

  return resolved;
}

export function getLanguage(): SupportedLocale {
  if (i18n.isInitialized) {
    return normalizeLocale(i18n.language);
  }
  return normalizeLocale(getStoredLocale() ?? getBrowserLocale());
}

export { i18n };
