import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n';
import { ThemeProvider } from '../../providers/Theme';
import { ImagePreview } from './ImagePreview';

beforeEach(async () => {
  await initI18n().changeLanguage('en-US');
});
function loadImage() {
  const image = screen.getByRole('img');
  Object.defineProperties(image, {
    naturalWidth: { value: 1000 },
    naturalHeight: { value: 500 },
  });
  fireEvent.load(image);
  return image;
}
describe('image preview controls', () => {
  it('zooms, rotates in both directions and resets without changing the image source', () => {
    render(<ImagePreview src="/image.png" title="Picture" />);
    const image = loadImage();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(image.style.transform).toContain('scale(1.25)');
    fireEvent.click(screen.getByRole('button', { name: 'Rotate right' }));
    expect(image.style.transform).toContain('rotate(90deg)');
    expect(image.parentElement).toHaveStyle({
      width: '625px',
      height: '1250px',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rotate left' }));
    expect(image.style.transform).toContain('rotate(0deg)');
    fireEvent.click(screen.getByRole('button', { name: 'Actual size (100%)' }));
    expect(image.style.transform).toContain('scale(1)');
    fireEvent.click(screen.getByRole('button', { name: 'Rotate left' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset and fit image' }),
    );
    expect(image.style.transform).toBe(
      'translate(-50%, -50%) rotate(0deg) scale(1)',
    );
    expect(image).toHaveAttribute('src', '/image.png');
  });

  it('bounds zoom and clears transforms when another image is opened', () => {
    const onError = vi.fn();
    const { rerender } = render(
      <ImagePreview src="/one.png" title="Picture" onError={onError} />,
    );
    loadImage();
    for (let i = 0; i < 20; i++)
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Actual size (100%)' }),
    ).toHaveTextContent('400%');
    for (let i = 0; i < 20; i++)
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Rotate right' }));
    fireEvent.error(screen.getByRole('img'));
    expect(onError).toHaveBeenCalledOnce();
    rerender(<ImagePreview src="/two.png" title="Next" />);
    expect(screen.getByRole('img').style.transform).toContain(
      'rotate(0deg) scale(1)',
    );
  });

  it.each(['compact', 'spacious'] as const)(
    'uses %s themed controls',
    (density) => {
      render(
        <ThemeProvider
          theme={{ density, radius: 'sharp', colorScheme: 'dark' }}
        >
          <ImagePreview src="/one.png" title="Picture" />
        </ThemeProvider>,
      );
      expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveStyle({
        height: density === 'compact' ? '24px' : '40px',
      });
      expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveClass(
        'rounded-chat-item',
      );
    },
  );
});
