# Changesets

All packages under `packages/` share a version through one `fixed` group in
`config.json`: `@xpert-ai/chatkit-*` and `@xpert-ai/a2ui-react`. Add new package names
to this group if they do not match these patterns. Root and example applications
are not part of the fixed group; example applications are explicitly ignored.

The unified baseline is `0.6.3`. The pending `unified-chatkit-minor` changeset bumps
all 18 packages to `0.7.0`. For subsequent releases, a minor changeset for any
member advances the entire group to the same next minor version; patch changesets
also keep the group synchronized. Multiple changesets in one release use the
highest requested bump, rather than incrementing the version repeatedly.

Private packages participate in versioning but remain excluded from npm
publishing. Keep their `private: true` flags; `privatePackages.version: true` does
not make them public.

Use `corepack pnpm changeset` to record a change and
`corepack pnpm changeset status` to inspect the release plan. The release workflow
runs `corepack pnpm changeset version` to apply versions and changelogs. Do not
consume pending changesets when only preparing a release.

Internal dependencies use `workspace:~` (examples may use `workspace:*`) and are
resolved to the matching release version when pnpm packs the packages. The
workspace uses `pnpm-lock.yaml`.

See the [Changesets documentation](https://github.com/changesets/changesets) for
details.
