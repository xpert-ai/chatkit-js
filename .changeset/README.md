# Changesets

Packages under `packages/` use independent versions (`fixed` and `linked` are
empty). Add a changeset for each package whose shipped behavior or public API
changes. Changesets also versions affected dependents when their internal
dependency ranges need updating; unrelated packages retain their versions.
Existing published versions are not reset or downgraded.

Root and example applications are not release candidates; example applications
are explicitly ignored. Private packages can have their own changesets and
participate in dependency updates, but remain excluded from npm publishing.
Keep their `private: true` flags.

Use `corepack pnpm changeset` to record a change and
`corepack pnpm changeset status` to inspect the release plan. The release workflow
runs `pnpm changeset version` to apply versions and changelogs. Do not
consume pending changesets when only preparing a release.

Internal dependencies use `workspace:~` (examples may use `workspace:*`) and are
resolved to each dependency's own version when pnpm packs the packages. Consumers
must not assume all ChatKit packages have the same version.

## Release verification and publishing

CI uses Node.js 24 and the root `packageManager` pin, with
`pnpm install --frozen-lockfile`. Four parallel `test:ci:ui --shard=N/4` jobs run
the complete `chatkit-ui` suite. `test:ci:other` runs the release-tooling tests and
the remaining original root test scope. The existing UI5 exclusion is preserved.
All five jobs must succeed before the release job can create a version PR or
publish. `corepack pnpm test` remains the full local verification command.

After merging the version PR, publishing checks the exact version of each public
package against `https://registry.npmjs.org/`. It builds only unpublished packages
and their transitive workspace dependencies, once each in dependency order.
Examples are excluded; private packages are built only if needed as dependencies.
Already-published versions are skipped, including on a retry after a partial
publish. Registry failures other than a missing package/version stop the release.

- `corepack pnpm release:plan`: query npm and print the targets and commands;
  neither build nor publish.
- `corepack pnpm release:build`: build that plan without publishing.
- `corepack pnpm release:publish`: build the plan, then publish only its targets.

The release build disables automatic pre/post scripts because pnpm already
orders and deduplicates dependencies. Publishing uses `--ignore-scripts` because
the plan has built all outputs, avoiding the widgets package's second build.
Standalone Angular build and widgets publish hooks remain available for local
use. If a package needs a new release lifecycle step, include it in its `build`
script or explicitly in the release runner; do not rely on publish hooks.

See the [Changesets documentation](https://github.com/changesets/changesets) and
[pnpm filtering documentation](https://pnpm.io/filtering) for details.
