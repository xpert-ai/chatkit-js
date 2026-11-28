# Command icon assets

The static `terminal-light-16` shape and `code-thinking` sprite were taken from the
locally installed Codex desktop app (bundle `com.openai.codex`, version
26.1120.50957, build 30866), following the requested Codex reference.

- `CommandTerminalIcon.tsx`: the static terminal silhouette paired with the animation.
- `code-thinking-sprite.ts`: an inline copy of `code-thinking.7b4edd406a.webp`,
  13,254 bytes, 6400 × 64 pixels, 100 horizontal frames. Inlining preserves the
  asset in both the standalone Vite app and the published ESM/CJS library.
- `command-icon.css`: a currentColor mask, a 1.66667-second stepped loop with
  deliberate holds, and a static fallback for reduced motion.

The sprite is a still image. CSS selects its frames; the WebP decoder does not
drive playback. The component only plays for active visible work, waits for the
asset to load, and preserves the static icon if loading fails.
