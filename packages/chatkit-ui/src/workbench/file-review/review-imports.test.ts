import { describe, expect, it } from 'vitest';
import { importLineNumbers, importSelectors } from './review-imports';

describe('hide import contents', () => {
  it('selects complete static declarations and preserves comments and dynamic imports', () => {
    expect(
      importLineNumbers(
        `/*\nimport fake from 'fake';\n*/\nimport type {\n  Foo,\n  Bar\n} from 'module';\nconst result = import('dynamic');\nimport 'side-effect';\n`,
      ),
    ).toEqual([4, 5, 6, 7, 9]);
  });
  it('targets original line numbers on both split sides and on added/deleted files', () => {
    expect(importSelectors("import 'module';", 'additions', true)).toEqual([
      '[data-code][data-additions] [data-line="1"]',
    ]);
    expect(importSelectors("import 'module';", 'deletions', false)).toEqual([
      '[data-code] [data-line="1"][data-line-type="deletion"]',
    ]);
  });
});
