# Resource Card browser acceptance fixture

This fixture builds the production MessageResourceCards, command executor, SDK client, navigation restoration and RemoteViewFrame. The scheduler iframe uses the platform's built `app.js`/`app.css`. API data is simulated: this is browser/asset acceptance, not a deployed-platform test.

Build both Remote Components in the sibling platform checkout, then prepare/build/serve this fixture from the ChatKit root. Preparation refuses stale assets and copies locally rendered iframe HTML; it starts no persistent platform process.

```sh
node packages/chatkit-ui/resource-card-preview/prepare.mjs ../xpert
corepack pnpm --dir packages/chatkit-ui exec vite build --config resource-card-preview/vite.config.ts
corepack pnpm --dir packages/chatkit-ui exec vite preview --config resource-card-preview/vite.config.ts
```

Open http://127.0.0.1:4326/ with optional `?lang=en-US&theme=dark`. No credentials are used. The copied HTML and fixture dist are ignored. Recopy/rebuild after platform changes.

Check: no automatic open on an untouched session; click or keyboard Enter opens the selected task; edit/save, pause/resume and execution navigation work; selecting the second card updates the existing iframe; Back/Forward and refresh retain selection. At 430px inspect long titles and form controls for overflow. Repeat for both languages/themes. Screenshots from this implementation are in `output/playwright/resource-card-*.png` (local acceptance artifacts).
