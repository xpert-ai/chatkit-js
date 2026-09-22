import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RuntimeResourceCatalogItem } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../providers/Theme';
import { ResourceIcon } from './RuntimeResourceRow';

const expert: RuntimeResourceCatalogItem = {
  bindingId: 'expert',
  version: '1',
  title: 'Expert',
  kind: 'external_xpert',
  status: 'ready',
  components: [],
  diagnostics: [],
};

describe('resource icons', () => {
  it('renders the configured expert emoji instead of a generic bot, also in the selected stack', () => {
    const { container } = render(
      <ThemeProvider>
        <ResourceIcon
          item={{
            ...expert,
            avatar: { emoji: { id: 'rocket', unified: '1f680' } },
          }}
          small
        />
      </ThemeProvider>,
    );
    expect(screen.getByText('\u{1f680}')).toBeInTheDocument();
    expect(container.querySelector('.lucide-bot')).toBeNull();
  });

  it('renders the middleware SVG configuration without an avatar frame', () => {
    const { container } = render(
      <ThemeProvider>
        <ResourceIcon
          item={{
            ...expert,
            kind: 'middleware',
            iconDefinition: {
              type: 'svg',
              value:
                '<svg viewBox="0 0 24 24"><path d="M1 1h20v20H1z" /></svg>',
            },
          }}
        />
      </ThemeProvider>,
    );
    expect(
      container.querySelector('[data-slot="runtime-resource-icon"] svg path'),
    ).toBeInTheDocument();
    expect(container.querySelector('.ring-1')).toBeNull();
    expect(container.querySelector('.lucide-layers')).toBeNull();
  });

  it('keeps local middleware images and uses kind defaults when there is no configuration', () => {
    const { container, rerender } = render(
      <ThemeProvider>
        <ResourceIcon
          item={{
            ...expert,
            kind: 'middleware',
            iconDefinition: { type: 'image', value: '/assets/middleware.svg' },
          }}
        />
      </ThemeProvider>,
    );
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/middleware.svg',
    );
    rerender(
      <ThemeProvider>
        <ResourceIcon item={expert} />
      </ThemeProvider>,
    );
    expect(container.querySelector('.lucide-bot')).toBeInTheDocument();
    rerender(
      <ThemeProvider>
        <ResourceIcon item={{ ...expert, kind: 'middleware' }} />
      </ThemeProvider>,
    );
    expect(container.querySelector('.lucide-layers')).toBeInTheDocument();
  });
});
