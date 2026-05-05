import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PetBridge } from './PetBridge';

const mocks = vi.hoisted(() => ({
  sendEvent: vi.fn(),
}));

vi.mock('../../hooks/useParentMessenger', () => ({
  useParentMessenger: () => ({
    isParentAvailable: true,
    sendCommand: vi.fn(),
    sendEvent: mocks.sendEvent,
  }),
}));

describe('PetBridge', () => {
  beforeEach(() => {
    mocks.sendEvent.mockClear();
    vi.restoreAllMocks();
  });

  it('sends disabled pet options without sending state events', () => {
    render(<PetBridge pet={undefined} state="idle" />);

    expect(mocks.sendEvent).toHaveBeenCalledWith('pet_options_change', {
      pet: null,
    });
    expect(mocks.sendEvent).not.toHaveBeenCalledWith(
      'pet_state_change',
      expect.anything(),
    );
  });

  it('sends pet state changes when pet is enabled', () => {
    render(<PetBridge pet state="running" />);

    expect(mocks.sendEvent).toHaveBeenCalledWith('pet_options_change', {
      pet: true,
    });
    expect(mocks.sendEvent).toHaveBeenCalledWith('pet_state_change', {
      state: 'running',
    });
  });

  it('does not fetch pet resources from the frame', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');

    render(
      <PetBridge
        pet={{
          character: {
            type: 'sprite-atlas',
            src: '/pets/boba/spritesheet.webp',
          },
        }}
        state="idle"
      />,
    );

    expect(fetch).not.toHaveBeenCalled();
  });
});
