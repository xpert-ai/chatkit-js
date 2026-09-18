import { describe, expect, it } from 'vitest';
import {
  createPromptDraft,
  updatePromptDraft,
  fillPromptDraft,
} from './prompt-draft';

describe('editable prompt scenarios', () => {
  it('inserts the complete template and replaces scenarios instead of stacking them', () => {
    const draft = createPromptDraft(
      'Create slides.\nUse my language.\n\n{{args}}',
    );
    expect(draft.text.trim()).toBe('Create slides.\nUse my language.');
    const first = fillPromptDraft(draft, 'AI trends');
    expect(fillPromptDraft(first, 'Annual report').text).toBe(
      'Create slides.\nUse my language.\n\nAnnual report',
    );
  });
  it('preserves body edits and tracks manually edited arguments and trailing text', () => {
    let draft = createPromptDraft('Create {{args}}. Finish.', 'slides');
    draft = updatePromptDraft(draft, 'Please create slides. Finish.');
    draft = updatePromptDraft(draft, 'Please create 10 slides. Finish.');
    expect(fillPromptDraft(draft, 'a report').text).toBe(
      'Please create a report. Finish.',
    );
  });
  it('keeps a draft as arguments, supports repeated placeholders and templates without placeholders', () => {
    expect(createPromptDraft('Base', 'My draft').text).toBe('Base\n\nMy draft');
    const draft = createPromptDraft('{{ args }} / {{args}}', 'a');
    expect(fillPromptDraft(draft, 'b').text).toBe('b / b');
  });
  it('never replaces edited body text after a user rewrites the whole draft', () => {
    const draft = updatePromptDraft(
      createPromptDraft('Base {{args}} tail', 'A'),
      'Entirely edited',
    );
    expect(fillPromptDraft(draft, 'Report').text).toBe(
      'Entirely edited\n\nReport',
    );
  });
});
