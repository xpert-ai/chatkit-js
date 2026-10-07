import { describe, expect, it } from 'vitest';

describe('test environment Blob APIs', () => {
  const bytes = new Uint8Array([0, 127, 128, 255]);

  it.each([
    ['Blob', () => new Blob([bytes], { type: 'image/png' })],
    ['File', () => new File([bytes], 'image.png', { type: 'image/png' })],
  ] as const)(
    'reads binary %s content without breaking FileReader',
    async (_name, create) => {
      const blob = create();
      expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
      expect(new Uint8Array(await blob.slice(1, 3).arrayBuffer())).toEqual(
        bytes.slice(1, 3),
      );
      const dataUrl = await new Promise<string | ArrayBuffer | null>(
        (resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        },
      );
      expect(dataUrl).toBe('data:image/png;base64,AH+A/w==');
    },
  );

  it('reads binary content from a native Response on the release Node version', async () => {
    const blob = await new Response(bytes, {
      headers: { 'Content-Type': 'image/png' },
    }).blob();
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
    expect(blob.type).toBe('image/png');
  });
});
