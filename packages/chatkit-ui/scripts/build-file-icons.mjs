import { readdir, readFile, writeFile } from 'node:fs/promises';
const directory = new URL('../src/assets/file-types/', import.meta.url);
const files = (await readdir(directory))
  .filter((file) => file.endsWith('.svg'))
  .sort();
const entries = await Promise.all(
  files.map(async (file) => {
    const svg = (await readFile(new URL(file, directory), 'utf8')).trim();
    return `  ${JSON.stringify(file.slice(0, -4))}: ${JSON.stringify(`data:image/svg+xml,${encodeURIComponent(svg)}`)},`;
  }),
);
await writeFile(
  new URL('icons.generated.ts', directory),
  '// Generated from the adjacent SVG assets by scripts/build-file-icons.mjs.\n' +
    'export const fileTypeIcons = {\n' +
    entries.join('\n') +
    '\n} as const;\n',
);
