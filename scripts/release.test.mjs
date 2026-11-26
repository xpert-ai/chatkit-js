import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  createReleasePlan,
  executePlan,
  isPublished,
  pnpmCommand,
  readPackages,
} from './release.mjs';

const execFileAsync = promisify(execFile);
const pkg = (name, extra = {}) => ({
  name: `@release-test/${name}`,
  version: '1.0.0',
  ...extra,
});
const npmError = (code) =>
  Object.assign(new Error(code), {
    stdout: JSON.stringify({ error: { code } }),
  });

test('registry lookup checks exact versions and recognizes only E404 as unpublished', async () => {
  assert.equal(
    await isPublished(pkg('ui'), async (_, args) => {
      assert.ok(args.includes('@release-test/ui@1.0.0'));
      assert.ok(args.includes('--registry=https://registry.npmjs.org/'));
      return { stdout: '"1.0.0"' };
    }),
    true,
  );
  assert.equal(
    await isPublished(pkg('ui'), async () => {
      throw npmError('E404');
    }),
    false,
  );
  for (const code of ['E401', 'E403', 'E429', 'E500', 'ETIMEDOUT']) {
    await assert.rejects(
      isPublished(pkg('ui'), async () => {
        throw npmError(code);
      }),
      /Cannot check npm version/,
    );
  }
  await assert.rejects(
    isPublished(pkg('ui'), async () => {
      throw new Error('socket hang up');
    }),
    /Cannot check npm version/,
  );
  for (const stdout of ['not json', '"2.0.0"', '{}']) {
    await assert.rejects(isPublished(pkg('ui'), async () => ({ stdout })));
  }
});

test('private and already-published packages are not release targets', async () => {
  const checked = [];
  const plan = await createReleasePlan(
    [pkg('ui'), pkg('types'), pkg('private-app', { private: true })],
    async ({ name }) => {
      checked.push(name);
      return name === '@release-test/types';
    },
  );
  assert.deepEqual(checked, ['@release-test/ui', '@release-test/types']);
  assert.deepEqual(plan.packages, [pkg('ui')]);
  assert.ok(plan.build.includes('@release-test/ui...'));
  assert.ok(plan.publish.includes('@release-test/ui'));
  assert.ok(!plan.publish.includes('@release-test/types'));
  assert.ok(plan.publish.includes('--ignore-scripts'));
});

test('an empty plan does not run unfiltered build or publish commands', async () => {
  const plan = await createReleasePlan([pkg('ui')], async () => true);
  assert.deepEqual(plan, { packages: [], build: [], publish: [] });
  await executePlan(plan, () => assert.fail('must not execute'));
});

test('registry failure aborts planning instead of assuming packages are unpublished', async () => {
  await assert.rejects(
    createReleasePlan([pkg('ui')], async () => {
      throw new Error('registry unavailable');
    }),
    /registry unavailable/,
  );
});

test('dry run, build-only, successful publish and failed build respect their boundaries', async () => {
  const plan = await createReleasePlan([pkg('ui')], async () => false);
  const calls = [];
  const run = async (args) => calls.push(args);
  await executePlan(plan, run, { dryRun: true });
  assert.deepEqual(calls, []);
  await executePlan(plan, run, { buildOnly: true });
  assert.deepEqual(calls, [plan.build]);
  calls.length = 0;
  await executePlan(plan, run);
  assert.deepEqual(calls, [plan.build, plan.publish]);
  calls.length = 0;
  await assert.rejects(
    executePlan(plan, async (args) => {
      calls.push(args);
      throw new Error('build failed');
    }),
    /build failed/,
  );
  assert.deepEqual(calls, [plan.build]);
});

test('partial-publish retries only select the remaining unpublished versions', async () => {
  const packages = [pkg('ui'), pkg('types')];
  const first = await createReleasePlan(packages, async () => false);
  assert.equal(first.packages.length, 2);
  const retry = await createReleasePlan(
    packages,
    async ({ name }) => name === '@release-test/types',
  );
  assert.deepEqual(retry.packages, [pkg('ui')]);
});

test('CI test selection partitions the full scope without reentering the root test script', async () => {
  const { scripts } = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  const selected = async (script) => {
    // Inspect the actual selectors used by the scripts with pnpm's resolver.
    const args = script.split(' && ').at(-1).split(' ').slice(1, -2);
    const [command, commandArgs] = pnpmCommand([
      ...args,
      'list',
      '--depth=-1',
      '--json',
    ]);
    const { stdout } = await execFileAsync(command, commandArgs, {
      cwd: new URL('..', import.meta.url),
    });
    return JSON.parse(stdout)
      .map(({ name }) => name)
      .sort();
  };
  const full = await selected(scripts.test);
  const other = await selected(scripts['test:ci:other']);
  assert.ok(!full.includes('root'));
  assert.ok(!other.includes('root'));
  assert.ok(!other.includes('@xpert-ai/chatkit-ui'));
  assert.deepEqual([...other, '@xpert-ai/chatkit-ui'].sort(), full);
  assert.ok(!full.includes('@xpert-ai/chatkit-ui5'));
});

async function createVersionFixture(t, manifests) {
  const cwd = await mkdtemp(join(tmpdir(), 'chatkit-version-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(join(cwd, '.changeset'));
  const config = JSON.parse(
    await readFile(
      new URL('../.changeset/config.json', import.meta.url),
      'utf8',
    ),
  );
  // This fixture has no examples to ignore.
  await writeFile(
    join(cwd, '.changeset/config.json'),
    JSON.stringify({ ...config, ignore: [] }),
  );
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({ name: 'version-fixture', private: true }),
  );
  await writeFile(
    join(cwd, 'pnpm-workspace.yaml'),
    "packages:\n  - 'packages/*'\n",
  );
  for (const [name, manifest] of Object.entries(manifests)) {
    const dir = join(cwd, 'packages', name);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: `@xpert-ai/chatkit-${name}`,
        version: '1.0.0',
        ...manifest,
      }),
    );
  }
  const require = createRequire(import.meta.url);
  const cli = join(
    dirname(require.resolve('@changesets/cli/package.json')),
    'bin.js',
  );
  const readManifest = async (name) =>
    JSON.parse(
      await readFile(join(cwd, 'packages', name, 'package.json'), 'utf8'),
    );
  return {
    readManifest,
    version: async (name) => (await readManifest(name)).version,
    release: async (releases) => {
      const entries = Object.entries(releases)
        .map(([name, type]) => `${JSON.stringify(name)}: ${type}`)
        .join('\n');
      await writeFile(
        join(cwd, '.changeset/fixture-change.md'),
        `---\n${entries}\n---\n\nUpdate fixture packages.\n`,
      );
      await execFileAsync(process.execPath, [cli, 'version'], { cwd });
    },
  };
}

test('Changesets aligns released ChatKit packages and affected dependents without releasing the whole group', async (t) => {
  const { release, version, readManifest } = await createVersionFixture(t, {
    ui: {
      version: '0.27.2',
      dependencies: { '@xpert-ai/chatkit-types': 'workspace:~' },
    },
    types: { version: '0.24.1' },
    react: {
      version: '0.18.6',
      dependencies: { '@xpert-ai/chatkit-types': 'workspace:~' },
    },
    'browser-extension': {
      version: '0.17.8',
      private: true,
      dependencies: { '@xpert-ai/chatkit-types': 'workspace:~' },
    },
    'browser-runner': { version: '0.17.0' },
    assets: { version: '0.1.0' },
    a2ui: { name: '@xpert-ai/a2ui-react', version: '0.18.0' },
  });
  await release({
    '@xpert-ai/chatkit-ui': 'minor',
    '@xpert-ai/chatkit-types': 'minor',
    '@xpert-ai/a2ui-react': 'patch',
  });
  for (const name of ['ui', 'types', 'react', 'browser-extension']) {
    assert.equal(await version(name), '0.28.0', name);
  }
  assert.equal(await version('browser-runner'), '0.17.0');
  assert.equal(await version('assets'), '0.1.0');
  assert.equal(await version('a2ui'), '0.18.1');
  assert.equal((await readManifest('browser-extension')).private, true);
  assert.equal(
    (await readManifest('react')).dependencies['@xpert-ai/chatkit-types'],
    'workspace:~',
  );
});

test('Changesets bases later patches on the highest linked version while leaving unaffected packages unchanged', async (t) => {
  const { release, version } = await createVersionFixture(t, {
    ui: {
      version: '0.28.1',
      dependencies: { '@xpert-ai/chatkit-types': 'workspace:~' },
    },
    types: { version: '0.28.3' },
    'browser-runner': { version: '0.17.0' },
  });
  await release({ '@xpert-ai/chatkit-ui': 'patch' });
  assert.equal(await version('ui'), '0.28.4');
  assert.equal(await version('types'), '0.28.3');
  assert.equal(await version('browser-runner'), '0.17.0');

  await release({ '@xpert-ai/chatkit-types': 'minor' });
  assert.equal(await version('types'), '0.29.0');
  assert.equal(await version('ui'), '0.29.0');
  assert.equal(await version('browser-runner'), '0.17.0');

  await release({ '@xpert-ai/chatkit-browser-runner': 'patch' });
  assert.equal(await version('browser-runner'), '0.29.1');
  assert.equal(await version('types'), '0.29.0');
  assert.equal(await version('ui'), '0.29.0');
});

test('pnpm builds the dependency closure once, without examples or recursive prebuild hooks', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'chatkit-release-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const { packageManager } = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({ name: 'fixture-root', private: true, packageManager }),
  );
  await writeFile(
    join(cwd, 'pnpm-workspace.yaml'),
    "packages:\n  - 'packages/*'\n  - 'examples/*'\n",
  );
  await writeFile(
    join(cwd, 'record.cjs'),
    `require('node:fs').appendFileSync(
      require('node:path').join(__dirname, 'builds.log'),
      process.env.npm_package_name + '\\n'
    );`,
  );
  const packages = [
    pkg('shared'),
    pkg('private-helper', { private: true }),
    pkg('ui', {
      dependencies: {
        '@release-test/shared': 'workspace:~',
        '@release-test/private-helper': 'workspace:~',
      },
    }),
    pkg('adapter', {
      dependencies: { '@release-test/shared': 'workspace:~' },
    }),
    pkg('unrelated'),
    pkg('private-app', { private: true }),
  ];
  for (const manifest of [
    ...packages,
    pkg('example', {
      private: true,
      dependencies: { '@release-test/ui': 'workspace:~' },
    }),
  ]) {
    const name = manifest.name.split('/')[1];
    const dir = join(cwd, name === 'example' ? 'examples' : 'packages', name);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        ...manifest,
        scripts: {
          build: 'node ../../record.cjs',
          // Standalone hooks must not be entered by the release build.
          prebuild: 'node -e "process.exit(1)"',
        },
      }),
    );
  }
  const manifests = await readPackages(cwd);
  assert.equal(manifests.length, packages.length);
  const plan = await createReleasePlan(
    manifests,
    async ({ name }) =>
      !['@release-test/ui', '@release-test/adapter'].includes(name),
  );
  const [command, args] = pnpmCommand(plan.build);
  await execFileAsync(command, args, { cwd });
  const builds = (await readFile(join(cwd, 'builds.log'), 'utf8'))
    .trim()
    .split('\n');
  assert.deepEqual(
    [...builds].sort(),
    ['adapter', 'private-helper', 'shared', 'ui']
      .map((name) => `@release-test/${name}`)
      .sort(),
  );
  const before = (dependency, consumer) =>
    assert.ok(
      builds.indexOf(`@release-test/${dependency}`) <
        builds.indexOf(`@release-test/${consumer}`),
    );
  before('shared', 'adapter');
  before('shared', 'ui');
  before('private-helper', 'ui');
});
