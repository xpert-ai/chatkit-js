import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
const root = new URL('../pets/', import.meta.url);

test('the offline pack catalog matches every shipped pet and valid WebP bytes', () => {
  const catalog = JSON.parse(
    readFileSync(new URL('catalog.json', root), 'utf8'),
  );
  const ids = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(catalog.map((pet) => pet.id).sort(), ids);
  assert.ok(ids.includes('boba'));
  for (const pet of catalog) {
    const metadata = JSON.parse(
      readFileSync(new URL(`${pet.id}/pet.json`, root), 'utf8'),
    );
    assert.equal(pet.id, metadata.id);
    assert.ok(
      pet.spriteVersionNumber === undefined ||
        pet.spriteVersionNumber === 1 ||
        pet.spriteVersionNumber === 2,
    );
    assert.equal(pet.label, metadata.displayName);
    assert.equal(pet.spriteVersionNumber, metadata.spriteVersionNumber);
    const image = readFileSync(new URL(`${pet.id}/spritesheet.webp`, root));
    assert.equal(image.toString('ascii', 0, 4), 'RIFF');
    assert.equal(image.toString('ascii', 8, 12), 'WEBP');
    assert.equal(image.readUInt32LE(4) + 8, image.length);
  }
});
