import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChatkitAvatar } from './chatkit-avatar';
import { ThemeProvider } from '../../providers/Theme';

afterEach(cleanup);
describe('profile avatar emoji compatibility', () => {
  it('renders Cloud emoji IDs when no unified field is present', async () => {
    render(
      <ChatkitAvatar
        label="Story"
        avatar={{ emoji: { id: 'movie_camera' } }}
      />,
      { wrapper: ThemeProvider },
    );
    expect(await screen.findByText('🎥')).toBeVisible();
  });
  it('resolves legacy shortcodes and aliases', async () => {
    render(
      <ChatkitAvatar
        label="Writer"
        avatar={{ emoji: { colons: ':pencil:' } }}
      />,
      { wrapper: ThemeProvider },
    );
    expect(await screen.findByText('📝')).toBeVisible();
  });
  it('renders unified emoji immediately and does not retain it after the profile changes', () => {
    const { rerender } = render(
      <ChatkitAvatar label="Expert" avatar={{ emoji: { unified: '1f4a1' } }} />,
      { wrapper: ThemeProvider },
    );
    expect(screen.getByText('💡')).toBeVisible();
    rerender(<ChatkitAvatar label="Alice" avatar={null} />);
    expect(screen.queryByText('💡')).toBeNull();
    expect(screen.getByText('A')).toBeVisible();
  });
});
