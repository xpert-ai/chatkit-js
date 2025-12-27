import type { ChatKitOptions, ChatKitTheme, ColorScheme } from './options';

/**
 * Playground 配置白名单 - 只允许这些配置项从 playground 复制过来生效
 * 过滤掉: locale, initialThread, header, history, threadItemActions, disclaimer, entities, widgets, onClientTool
 */

/**
 * 允许从 Playground 配置的选项类型
 */
export type PlaygroundAllowedOptions = {
  api?: ChatKitOptions['api'];
  theme?: ColorScheme | ChatKitTheme;
  composer?: ChatKitOptions['composer'];
  startScreen?: ChatKitOptions['startScreen'];
};

/**
 * 白名单配置项 key 列表
 */
const ALLOWED_KEYS: (keyof PlaygroundAllowedOptions)[] = [
  'api',
  'theme',
  'composer',
  'startScreen',
];

/**
 * 从 Playground 复制的配置中过滤出允许的配置项
 *
 * @param options - 从 playground 复制的完整配置
 * @returns 只包含白名单配置项的对象
 *
 * @example
 * ```ts
 * // 从 playground 复制的配置
 * const playgroundConfig = {
 *   theme: { colorScheme: 'light', radius: 'pill' },
 *   threadItemActions: { feedback: true }, // 会被过滤掉
 *   startScreen: { greeting: 'Hello!' },
 * };
 *
 * const filtered = filterPlaygroundOptions(playgroundConfig);
 * // 结果: { theme: { colorScheme: 'light', radius: 'pill' }, startScreen: { greeting: 'Hello!' } }
 * ```
 */
export function filterPlaygroundOptions<T extends Partial<ChatKitOptions>>(
  options: T
): PlaygroundAllowedOptions {
  const filtered: PlaygroundAllowedOptions = {};

  for (const key of ALLOWED_KEYS) {
    if (key in options && options[key] !== undefined) {
      // @ts-expect-error - 动态赋值
      filtered[key] = options[key];
    }
  }

  return filtered;
}

/**
 * 合并 Playground 配置与本地配置
 * Playground 配置会覆盖本地配置中的对应项（只限白名单内的配置）
 *
 * @param localOptions - 本地项目中的基础配置（可包含 onClientTool, header 等）
 * @param playgroundOptions - 从 playground 复制的配置
 * @returns 合并后的配置
 *
 * @example
 * ```ts
 * const localConfig = {
 *   api: { getClientSecret: async () => '...' },
 *   onClientTool: async () => { ... },  // 保留
 *   header: { enabled: true },           // 保留
 * };
 *
 * const playgroundConfig = {
 *   theme: { colorScheme: 'dark' },
 *   threadItemActions: { feedback: true }, // 被过滤
 * };
 *
 * const merged = mergeWithPlaygroundOptions(localConfig, playgroundConfig);
 * // 结果: { api, onClientTool, header, theme }
 * ```
 */
export function mergeWithPlaygroundOptions<T extends Partial<ChatKitOptions>>(
  localOptions: T,
  playgroundOptions: Partial<ChatKitOptions>
): T & PlaygroundAllowedOptions {
  const filteredPlayground = filterPlaygroundOptions(playgroundOptions);

  return {
    ...localOptions,
    ...filteredPlayground,
  };
}
