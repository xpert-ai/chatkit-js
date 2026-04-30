import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IconDefinitionRenderer } from './icon-definition';

describe('IconDefinitionRenderer', () => {
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
