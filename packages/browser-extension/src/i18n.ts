import type { ConfigValidationIssue } from './types';

export type ExtensionLocale = 'en' | 'zh-Hans';

const MESSAGES = {
  en: {
    appTitle: 'Xpert ChatKit',
    extensionTitle: 'Xpert ChatKit Extension',
    optionsSubtitle: 'Configure the Chrome side panel and page overlay.',
    popupReadySubtitle: 'Choose where to open ChatKit.',
    ready: 'Ready.',
    openOptions: 'Open options',
    openSidePanel: 'Open side panel',
    togglePageOverlay: 'Toggle page overlay',
    sidePanelOpened: 'Side panel opened.',
    pageOverlayToggled: 'Page overlay toggled.',
    sidePanelOpenError: 'Could not open side panel.',
    pageOverlayToggleError: 'Could not toggle page overlay.',
    setupPrompt:
      'ChatKit will show a configuration prompt until setup is complete.',
    disabledTitle: 'ChatKit is disabled here',
    disabledBody:
      'Enable this surface in the extension options to use ChatKit here.',
    configureTitle: 'Configure ChatKit',
    connection: 'Connection',
    credentials: 'Credentials',
    appearance: 'Appearance',
    surfaces: 'Surfaces',
    overlay: 'Overlay',
    hostAutomation: 'Host automation',
    frameUrl: 'ChatKit frame URL',
    apiUrl: 'Xpert API URL',
    xpertId: 'Xpert ID',
    clientSecret: 'Client Secret / API Key',
    clientSecretHelp:
      'Stored in chrome.storage.local and returned from getClientSecret.',
    locale: 'Locale',
    browserDefault: 'Browser default',
    english: 'English',
    simplifiedChinese: 'Simplified Chinese',
    launchMode: 'Launch mode',
    petLauncher: 'Pet launcher',
    chatPanel: 'Chat panel',
    colorScheme: 'Color scheme',
    light: 'Light',
    dark: 'Dark',
    enableSidePanel: 'Enable Chrome side panel',
    enablePageOverlay: 'Enable page overlay',
    autoPagePet: 'Auto launch page pet on new HTTP(S) tabs',
    enableHostAutomation: 'Allow agents to operate the host page',
    width: 'Width',
    height: 'Height',
    position: 'Position',
    bottomRight: 'Bottom Right',
    bottomLeft: 'Bottom Left',
    topRight: 'Top Right',
    topLeft: 'Top Left',
    save: 'Save',
    resetDefaults: 'Reset defaults',
    optionsSaved: 'Options saved.',
    optionsSavedIncomplete:
      'Options saved. Complete the required fields before opening ChatKit.',
    defaultsRestored: 'Default options restored.',
    missingFrameUrl: 'ChatKit frame URL is required.',
    missingApiUrl: 'Xpert API URL is required.',
    missingClientSecret: 'Client Secret / API Key is required.',
  },
  'zh-Hans': {
    appTitle: 'Xpert ChatKit',
    extensionTitle: 'Xpert ChatKit 扩展',
    optionsSubtitle: '配置 Chrome 侧边栏和网页浮窗。',
    popupReadySubtitle: '选择 ChatKit 的打开方式。',
    ready: '已就绪。',
    openOptions: '打开设置',
    openSidePanel: '打开侧边栏',
    togglePageOverlay: '切换网页浮窗',
    sidePanelOpened: '侧边栏已打开。',
    pageOverlayToggled: '网页浮窗已切换。',
    sidePanelOpenError: '无法打开侧边栏。',
    pageOverlayToggleError: '无法切换网页浮窗。',
    setupPrompt: '完成设置前，ChatKit 会显示配置提示。',
    disabledTitle: '这里已禁用 ChatKit',
    disabledBody: '请在扩展设置中启用此入口后再使用 ChatKit。',
    configureTitle: '配置 ChatKit',
    connection: '连接',
    credentials: '凭证',
    appearance: '外观',
    surfaces: '入口',
    overlay: '浮窗',
    hostAutomation: '宿主页面自动化',
    frameUrl: 'ChatKit frame URL',
    apiUrl: 'Xpert API URL',
    xpertId: 'Xpert ID',
    clientSecret: 'Client Secret / API Key',
    clientSecretHelp:
      '保存在 chrome.storage.local 中，并由 getClientSecret 返回。',
    locale: '语言',
    browserDefault: '跟随浏览器',
    english: '英文',
    simplifiedChinese: '简体中文',
    launchMode: '启动模式',
    petLauncher: '宠物启动器',
    chatPanel: '聊天面板',
    colorScheme: '配色',
    light: '浅色',
    dark: '深色',
    enableSidePanel: '启用 Chrome 侧边栏',
    enablePageOverlay: '启用网页浮窗',
    autoPagePet: '在新的 HTTP(S) 标签页自动加载页面宠物',
    enableHostAutomation: '允许智能体操作宿主页面',
    width: '宽度',
    height: '高度',
    position: '位置',
    bottomRight: '右下',
    bottomLeft: '左下',
    topRight: '右上',
    topLeft: '左上',
    save: '保存',
    resetDefaults: '恢复默认',
    optionsSaved: '设置已保存。',
    optionsSavedIncomplete: '设置已保存。请补全必填项后再打开 ChatKit。',
    defaultsRestored: '默认设置已恢复。',
    missingFrameUrl: '请填写 ChatKit frame URL。',
    missingApiUrl: '请填写 Xpert API URL。',
    missingClientSecret: '请填写 Client Secret / API Key。',
  },
} as const;

export type I18nKey = keyof (typeof MESSAGES)['en'];

export type I18n = {
  locale: ExtensionLocale;
  t: (key: I18nKey) => string;
};

function resolveLocaleCandidate(
  value: string | undefined,
): ExtensionLocale | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace('_', '-').toLowerCase();
  if (normalized === 'zh-hans' || normalized === 'zh-cn') {
    return 'zh-Hans';
  }

  if (normalized.startsWith('zh')) {
    return 'zh-Hans';
  }

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }

  return null;
}

export function resolveExtensionLocale(
  preferredLocale?: string | null,
): ExtensionLocale {
  const preferred = resolveLocaleCandidate(preferredLocale ?? undefined);
  if (preferred) {
    return preferred;
  }

  const browserLanguages =
    typeof navigator !== 'undefined'
      ? [navigator.language, ...(navigator.languages ?? [])]
      : [];

  for (const language of browserLanguages) {
    const resolved = resolveLocaleCandidate(language);
    if (resolved) {
      return resolved;
    }
  }

  return 'en';
}

export function createI18n(preferredLocale?: string | null): I18n {
  const locale = resolveExtensionLocale(preferredLocale);
  const messages = MESSAGES[locale];

  return {
    locale,
    t(key) {
      return messages[key];
    },
  };
}

export function getConfigIssueMessage(
  issue: ConfigValidationIssue,
  i18n: I18n,
): string {
  switch (issue.field) {
    case 'frameUrl':
      return i18n.t('missingFrameUrl');
    case 'apiUrl':
      return i18n.t('missingApiUrl');
    case 'clientSecret':
      return i18n.t('missingClientSecret');
  }
}

export function formatConfigIssues(
  issues: ConfigValidationIssue[],
  i18n: I18n,
): string {
  return issues.map((issue) => getConfigIssueMessage(issue, i18n)).join(' ');
}
