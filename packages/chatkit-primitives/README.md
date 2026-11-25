# ChatKit primitives

Shared shadcn/Radix controls for ChatKit and the A2UI React renderer. The implementation originates in ChatKit's `components/ui`; the old paths re-export this package during migration.

```tsx
import {
  Input,
  Button,
  PrimitiveThemeProvider,
} from '@xpert-ai/chatkit-primitives';
import '@xpert-ai/chatkit-primitives/styles.css';
```

The package owns basic controls, variants, density sizing, surface tokens and themed portals. It must not import ChatKit UI, the Xpert SDK, Agent state, A2UI or application translations. `PrimitiveThemeProvider` accepts the owning theme root, a theme revision and translated labels. Portals render outside message clipping while retaining that surface's resolved tokens. Updating the theme preserves controls, values and open portals.

React and React DOM are peer dependencies. The stylesheet requires Tailwind 4 and includes an `@source` entry for the shipped component classes; it does not load another reset or overwrite the host's color palette. Import it once in the host stylesheet. Use package exports, including `/button`, `/input`, `/select`, etc., rather than source paths. Standalone consumers supply their own semantic color/font variables and may use the provider without ChatKit.

The A2UI adapters preserve scalar/array values, binding paths, actions and the public class-map theme override API. They do not maintain a second default control skin. Component sizing follows `--chat-density-scale`; radius follows `--chat-item-radius` and `--chat-panel-radius`.

Verification covers ESM/CJS exports, CSS packaging, isolated portal tokens, live density changes, keyboard navigation, A2UI binding/action regressions and browser checks for focus clipping. Update the shared components here; do not copy implementations back into consumers.

The consumer `components.json` routes shadcn UI and utility generation to this package using the workspace aliases. Add or update shadcn components from `packages/chatkit-primitives` so its local `components.json` owns generated source. Add matching package exports and any compatibility re-export in ChatKit; do not copy generated source into the old ChatKit UI folder. The preview at `/widget-preview/` on the ChatKit Vite development server compares host and A2UI controls with live theme switches.

For a standalone surface, apply `getSurfaceThemeStyle(theme)` to the element referenced by `rootRef`; the provider reads that root’s resolved colors and fonts for portals. Pass a new `theme` or increment `revision` when host CSS variables change. ChatKit performs this bridge automatically.

Workspace generator routing follows the [shadcn monorepo alias contract](https://ui.shadcn.com/docs/monorepo). `shadcn info --json` in ChatKit UI resolves UI components, utilities and CSS into this package.
