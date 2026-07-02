import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { RuntimeCapabilityOption } from '../../lib/runtime-capabilities';
import { HumanRuntimeCapabilityChips } from './runtime-capabilities';

describe('HumanRuntimeCapabilityChips', () => {
  it('does not tint skill chips with their configured color', () => {
    render(
      <HumanRuntimeCapabilityChips
        options={[
          {
            type: 'skill',
            id: 'skill-documents',
            label: 'documents',
            color: '#2563EB',
            capability: {
              id: 'skill-documents',
              workspaceId: 'workspace-1',
              label: 'documents',
              meta: {
                color: '#2563EB',
              },
            },
          } satisfies RuntimeCapabilityOption,
        ]}
      />,
    );

    expect(screen.getByText('documents').parentElement).not.toHaveStyle({
      color: '#2563EB',
    });
  });

  it('keeps configured colors for non-skill chips', () => {
    render(
      <HumanRuntimeCapabilityChips
        options={[
          {
            type: 'plugin',
            id: 'plugin-sandbox',
            label: 'sandbox',
            color: '#F97316',
            capability: {
              nodeKey: 'plugin-sandbox',
              provider: 'sandbox',
              label: 'sandbox',
              meta: {
                color: '#F97316',
              },
            },
          } satisfies RuntimeCapabilityOption,
        ]}
      />,
    );

    expect(screen.getByText('sandbox').parentElement).toHaveStyle({
      color: '#F97316',
    });
  });
});
