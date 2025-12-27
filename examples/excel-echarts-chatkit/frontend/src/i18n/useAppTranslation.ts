import { useTranslation } from 'react-i18next';

import { initI18n } from './index';

export function useAppTranslation() {
  initI18n();
  return useTranslation();
}
