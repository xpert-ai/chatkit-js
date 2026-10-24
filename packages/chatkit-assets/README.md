# ChatKit offline pet assets

Optional, independently versioned static assets. Installing `@xpert-ai/chatkit-ui`
does **not** install this package. No JavaScript or install hooks are required.

## Local / offline deployment

```sh
corepack pnpm add -D @xpert-ai/chatkit-assets@0.1.0
cp -R node_modules/@xpert-ai/chatkit-assets/pets public/pets
```

Serve `public/pets` at `/pets`. The directory contains `catalog.json`, each pet's
`pet.json`, and its original WebP spritesheet. The default ChatKit configuration
continues to use `/pets`. The directory is the same for offline and CDN hosting.

For an unpublished workspace build, run `corepack pnpm --filter
@xpert-ai/chatkit-assets pack --pack-destination /tmp/chatkit-release`, then extract
the archive and copy `package/pets`. No registry access is needed to use that pack.

## CDN deployment

Upload `pets/` to a versioned prefix such as
`https://cdn.example.com/chatkit-assets/0.1.0/pets/`, then configure each instance:

```ts
chatkit.setOptions({
  // ...the existing API and frame options
  pet: {
    assetsBaseUrl: 'https://cdn.example.com/chatkit-assets/0.1.0/pets',
  },
});
```

Root-relative paths are resolved on the iframe's origin, including for the host
pet overlay. Use an absolute URL when the host and iframe use different origins
and the assets belong to the host. Omit query strings and fragments from the base.
`pet: true` uses `/pets`; `pet: false` keeps the existing disabled behavior.
`pet: { enabled: false, assetsBaseUrl: ... }` still supplies assets for Assistant
appearance sprites while disabling the floating pet by default.
Explicit custom `pet.character.src` / uploaded appearance URLs are unchanged.

Upload this package only when its contents change. Publish resources before
switching clients to their new version; never overwrite a versioned prefix.
Immutable versioned files can use `Cache-Control: public, max-age=31536000,
immutable`. Include the resource origin in the iframe and host `img-src` policy;
serve catalog JSON with CORS headers if another application fetches it cross-origin.
The settings picker retains its existing sprite previews; opening it can download
all previewed atlases. The initial chat does not preload the full pet collection.

## Maintaining the catalog

Add or update `pets/<id>/pet.json` and `spritesheet.webp`, and keep
`pets/catalog.json` in sync. Run this package's tests. Keep v1/v2 sprite metadata
aligned and retain existing IDs for saved user preferences. Bump this package's
version when resource bytes change, independently of UI-only releases.
