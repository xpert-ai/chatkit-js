import { execFile, spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const registry = 'https://registry.npmjs.org/';

// Reuse the pnpm version that invoked the root script, including Corepack.
export function pnpmCommand(args) {
  return process.env.npm_execpath
    ? [process.execPath, [process.env.npm_execpath, ...args]]
    : ['pnpm', args];
}

export async function readPackages(cwd) {
  const directories = await readdir(join(cwd, 'packages'), {
    withFileTypes: true,
  });
  return Promise.all(
    directories
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) =>
        JSON.parse(
          await readFile(
            join(cwd, 'packages', entry.name, 'package.json'),
            'utf8',
          ),
        ),
      ),
  );
}

export async function isPublished(pkg, query = execFileAsync) {
  const spec = `${pkg.name}@${pkg.version}`;
  const [command, args] = pnpmCommand([
    'view',
    spec,
    'version',
    '--json',
    `--registry=${registry}`,
  ]);
  let stdout;
  try {
    ({ stdout } = await query(command, args, { cwd: root, timeout: 60_000 }));
  } catch (error) {
    // Only a registry 404 means unpublished. Authentication, rate limiting,
    // network errors and malformed responses must stop the release.
    let result;
    try {
      result = JSON.parse(error.stdout);
    } catch {
      throw new Error(`Cannot check npm version for ${spec}`, { cause: error });
    }
    if (result.error?.code === 'E404') return false;
    throw new Error(`Cannot check npm version for ${spec}`, { cause: error });
  }
  if (JSON.parse(stdout) !== pkg.version) {
    throw new Error(`Unexpected npm version response for ${spec}`);
  }
  return true;
}

export async function createReleasePlan(packages, check = isPublished) {
  const candidates = packages.filter((pkg) => !pkg.private);
  const unpublished = [];
  // Bound registry requests without serializing the entire workspace.
  for (let start = 0; start < candidates.length; start += 4) {
    const batch = candidates.slice(start, start + 4);
    const published = await Promise.all(batch.map((pkg) => check(pkg)));
    unpublished.push(...batch.filter((_, index) => !published[index]));
  }

  if (!unpublished.length) {
    return { packages: [], build: [], publish: [] };
  }

  return {
    packages: unpublished.map(({ name, version }) => ({ name, version })),
    build: [
      '-r',
      ...unpublished.flatMap(({ name }) => ['--filter', `${name}...`]),
      '--filter=!./examples/**',
      '--fail-if-no-match',
      // pnpm already builds shared dependencies once in topological order.
      // Angular's standalone prebuild would otherwise rebuild that closure.
      '--config.enable-pre-post-scripts=false',
      'run',
      'build',
    ],
    publish: [
      '-r',
      ...unpublished.flatMap(({ name }) => ['--filter', name]),
      'publish',
      '--report-summary',
      '--access',
      'public',
      '--no-git-checks',
      // All outputs were built above, including a2ui-react's prepublishOnly.
      '--ignore-scripts',
      `--registry=${registry}`,
    ],
  };
}

export async function executePlan(plan, run, { dryRun, buildOnly } = {}) {
  if (dryRun || !plan.packages.length) return;
  await run(plan.build);
  if (!buildOnly) await run(plan.publish);
}

function runPnpm(args) {
  const [command, commandArgs] = pnpmCommand(args);
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, commandArgs, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else
        reject(new Error(`pnpm ${args.join(' ')} failed (${signal ?? code})`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--dry-run', '--build-only'].includes(arg))) {
    throw new Error(
      'Usage: node scripts/release.mjs [--dry-run | --build-only]',
    );
  }
  const plan = await createReleasePlan(await readPackages(root));
  console.log(JSON.stringify(plan, null, 2));
  if (!plan.packages.length) {
    console.log(
      'All public package versions are already on npm; nothing to do.',
    );
  }
  await executePlan(plan, runPnpm, {
    dryRun: args.includes('--dry-run'),
    buildOnly: args.includes('--build-only'),
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
