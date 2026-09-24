import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FileTypeIcon, getFileIconType } from './FileTypeIcon';

describe('file type icons', () => {
  it('distinguishes common formats from their MIME metadata', () => {
    const formats = {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'word',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        'excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        'powerpoint',
      'application/pdf': 'pdf',
      'application/json; charset=utf-8': 'json',
      'Application/Problem+JSON': 'json',
      'text/csv': 'excel',
      'text/markdown': 'markdown',
      'text/plain': 'text',
      'text/javascript': 'code',
      'image/svg+xml': 'image',
      'audio/mpeg': 'audio',
      'video/mp4': 'video',
      'application/zip': 'archive',
    };
    for (const [mimeType, icon] of Object.entries(formats)) {
      expect(getFileIconType({ mimeType, kind: 'file' })).toBe(icon);
    }
  });

  it('uses precise MIME before a broad kind and safely handles legacy metadata', () => {
    expect(
      getFileIconType({ mimeType: 'application/pdf', kind: 'document' }),
    ).toBe('pdf');
    expect(getFileIconType({ kind: 'spreadsheet' })).toBe('excel');
    expect(getFileIconType({ kind: 'document' })).toBe('text');
    expect(
      getFileIconType({ mimeType: 'application/octet-stream', kind: 'file' }),
    ).toBe('file');
    expect(getFileIconType({ kind: 'url' })).toBe('web');
  });

  it('shares artwork between cards and summaries without extra accessible labels or requests', () => {
    const output = { kind: 'file' as const, mimeType: 'application/json' };
    const { container } = render(
      <>
        <FileTypeIcon output={output} variant="card" />
        <FileTypeIcon output={output} />
      </>,
    );
    const icons = container.querySelectorAll('[data-file-type="json"]');
    expect(icons).toHaveLength(2);
    expect(icons[0]).toHaveAttribute('aria-hidden', 'true');
    expect(icons[0]).toHaveClass('chatkit-file-type-tile');
    expect(icons[1]).not.toHaveClass('chatkit-file-type-tile');
    const images = container.querySelectorAll('img');
    expect(images[0].src).toBe(images[1].src);
    expect(images[0].src).toMatch(/^data:image\/svg\+xml,/);
    expect(images[0]).toHaveAttribute('alt', '');
  });
});
