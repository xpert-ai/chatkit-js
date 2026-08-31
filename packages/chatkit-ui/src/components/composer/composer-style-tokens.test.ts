import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(resolve(process.cwd(), 'src/index.css'), {
  encoding: 'utf8',
});

describe('Composer style tokens', () => {
  it('uses the approved 2px shell inset and soft shadow', () => {
    const normalizedStylesheet = stylesheet.replace(/\s+/g, ' ');

    expect(stylesheet).toContain('--spacing-composer-inset: 2px;');
    expect(normalizedStylesheet).toContain(
      '--shadow-composer-shell: 0px 12px 24px -8px rgba(0, 0, 0, 0.02), 0px 2px 4px -4px rgba(0, 0, 0, 0.02);',
    );
  });
});
