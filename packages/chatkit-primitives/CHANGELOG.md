# @xpert-ai/chatkit-primitives

## 0.2.0

### Minor Changes

- e7b5d2b: Extract ChatKit's shadcn/Radix controls into a shared primitives package and reuse them in A2UI. Unify density, radius, semantic colors and themed portals; preserve Widget data bindings, actions and class-map overrides. Existing ChatKit UI exports remain compatible. Standalone A2UI consumers must use Tailwind 4 and import the shared stylesheet once.
