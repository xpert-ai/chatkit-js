import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IconDefinitionRenderer } from './icon-definition';

describe('IconDefinitionRenderer', () => {
  it('inherits row color for explicitly monochrome isolated SVGs without inlining SVG markup', () => {
    const { container } = render(
      <IconDefinitionRenderer
        icon={{
          type: 'svg',
          color: 'currentColor',
          value:
            '<svg viewBox="0 0 24 24"><path stroke="currentColor" d="M2 2l20 20" /></svg>',
          alt: 'Read skill file',
        }}
        svgAsImage
        decorative={false}
        className="text-muted-foreground"
      />,
    );
    const icon = screen.getByRole('img', { name: 'Read skill file' });
    expect(icon.style.backgroundColor).toBe('currentcolor');
    expect(icon.style.maskSize).toBe('contain');
    expect(icon.style.maskImage).toContain('data:image/svg+xml');
    expect(decodeURIComponent(icon.style.maskImage)).toContain(
      'xmlns="http://www.w3.org/2000/svg"',
    );
    expect(icon).toHaveClass('text-muted-foreground');
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('preserves multicolor SVG images without an explicit currentColor declaration', () => {
    render(
      <IconDefinitionRenderer
        icon={{
          type: 'svg',
          value:
            '<svg viewBox="0 0 24 24"><path fill="red" d="M2 2h8v8H2z" /><path fill="blue" d="M14 14h8v8h-8z" /></svg>',
          alt: 'Plugin logo',
        }}
        svgAsImage
        decorative={false}
      />,
    );
    const icon = screen.getByRole('img', { name: 'Plugin logo' });
    expect(icon.tagName).toBe('IMG');
    expect(decodeURIComponent(icon.getAttribute('src') ?? '')).toContain(
      'fill="blue"',
    );
    expect(icon.style.maskImage).toBe('');
  });

  it('renders inline svg icon definitions', () => {
    const { container } = render(
      <IconDefinitionRenderer
        icon={{
          type: 'svg',
          value:
            '<?xml version="1.0"?><svg viewBox="0 0 16 16"><path d="M2 2h12v12H2z" /></svg>',
        }}
        dataSlot="test-icon"
      />,
    );

    expect(
      container.querySelector('[data-slot="test-icon"] svg'),
    ).toBeInTheDocument();
  });

  it('renders accessible emoji icons when requested', () => {
    render(
      <IconDefinitionRenderer
        icon={{ type: 'emoji', value: '*', alt: 'Star' }}
        decorative={false}
      />,
    );

    expect(screen.getByRole('img', { name: 'Star' })).toHaveTextContent('*');
  });

  it('falls back for unsupported lottie rendering', () => {
    render(
      <IconDefinitionRenderer
        icon={{ type: 'lottie', value: 'https://example.com/icon.json' }}
        fallback={<span>Fallback</span>}
      />,
    );

    expect(screen.getByText('Fallback')).toBeInTheDocument();
  });
});
