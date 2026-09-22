import { describe, expect, it } from 'vitest';
import {
  resourceDescription,
  resourceDescriptionSearchText,
} from './resource-description';

const description = {
  en_US: 'Visual canvas assistant',
  zh_Hans: '可视化画布助手',
};

describe('localized resource descriptions', () => {
  it.each(['zh-Hans', 'zh_CN', 'zh-CN'])(
    'resolves the platform object for %s',
    (language) => {
      expect(resourceDescription(description, language)).toBe(
        description.zh_Hans,
      );
      expect(resourceDescription(JSON.stringify(description), language)).toBe(
        description.zh_Hans,
      );
    },
  );
  it('uses English and missing-translation fallbacks from the shared resolver', () => {
    expect(resourceDescription(description, 'en-US')).toBe(description.en_US);
    expect(resourceDescription({ en_US: 'Fallback' }, 'zh-Hans')).toBe(
      'Fallback',
    );
    expect(resourceDescription({ zh_Hans: '中文' }, 'en-US')).toBe('中文');
    expect(
      resourceDescription({ en_US: 'Fallback', zh_Hans: ' ' }, 'zh-Hans'),
    ).toBe('Fallback');
  });
  it.each([
    'Plain description',
    '{unfinished JSON',
    '{"count":2}',
    '{"en_US":{"nested":true}}',
  ])('preserves literal text: %s', (value) => {
    expect(resourceDescription(value, 'zh-Hans')).toBe(value);
  });
  it('does not render missing or empty descriptions', () => {
    expect(resourceDescription(undefined, 'zh-Hans')).toBeNull();
    expect(resourceDescription({}, 'en-US')).toBeNull();
    expect(resourceDescription('   ', 'en-US')).toBeNull();
  });
  it('makes translated content searchable without exposing locale keys as matches', () => {
    expect(resourceDescriptionSearchText(description)).toBe(
      'Visual canvas assistant 可视化画布助手',
    );
    expect(resourceDescriptionSearchText(JSON.stringify(description))).toBe(
      resourceDescriptionSearchText(description),
    );
  });
});
