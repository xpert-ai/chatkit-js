import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const platform = resolve(process.argv[2] || '../xpert');
const { startRemoteViewPreview } = await import(pathToFileURL(resolve(platform, 'tools/remote-view-preview/preview-host.mjs')));
await mkdir(resolve(root, 'public'), { recursive: true });
for (const [name, component] of [
  ['scheduler', 'xpert-task/remote-components/scheduler-detail'],
  ['project', 'xpert-project/remote-components/project-tasks'],
]) {
  const folder = resolve(platform, 'packages/server-ai/src', component);
  execFileSync(process.execPath, [resolve(folder, 'build.mjs'), '--check'], { cwd: platform, stdio: 'inherit' });
  const { default: config } = await import(pathToFileURL(resolve(folder, 'preview.config.mjs')));
  const preview = await startRemoteViewPreview({ ...config, logStartup: false }, { port: 0 });
  try {
    const response = await fetch(new URL('frame', preview.url));
    if (!response.ok) throw Error(`Cannot render ${name}`);
    await writeFile(resolve(root, 'public', `${name}.html`), await response.text());
    if (name === 'project') await writeFile(resolve(root, 'public/project-data.json'), JSON.stringify(preview.state));
  } finally { await preview.close(); }
}
console.log('Prepared verified production iframe assets with fixture data.');
