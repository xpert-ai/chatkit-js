# Chat header visual verification

Scope: the existing ChatKit header and its controls, using the user's ChatGPT reference for placement and background treatment. This is not a replacement of the host layout or design system.

## Evidence

- Source: `/var/folders/zr/dr3n4hcx5h1fr9c63_gncck40000gn/T/codex-clipboard-fa610946-5b79-4391-b7a2-01dd74e3c400.png` (1880 × 640). The referenced ChatGPT page was also inspected in Chrome.
- Implementation: `/tmp/chatkit-header-qa/implementation-matched.jpg` (972 × 600, CSS viewport 972 × 600, 1x screenshot).
- Combined focused comparison: `/tmp/chatkit-header-qa/comparison.png`. The reference header is normalized at an assumed 2x source density; comparison concerns structure, not exact ChatGPT typography.
- Full preview: `/tmp/chatkit-header-qa/implementation-light.jpg` (1728 × 941). Preview route: `http://localhost:5173/dev/chat-header/index.html`.
- States inspected: light/round/compact, dark/sharp/spacious, 360px panel, character and standard header, more menu, summary popover, and sharing dialog.

## Findings

No actionable visual differences within the requested scope. New conversation is independently accessible on the left; sharing is directly accessible on the right; the header is transparent; only the action group has a surface background.

- Typography: existing ChatKit typography and localized labels are retained. Narrow panels show the share icon with its accessible label.
- Spacing: horizontal toolbar padding exceeds vertical padding. The toolbar spans the chat viewport while summary docking retains the transcript-column measurement.
- Colors: semantic theme colors apply to surfaces, icons, hover, focus, and disabled controls; header background computes to transparent.
- Assets: standard Lucide controls and the existing workbench icon are retained; no new raster or branded assets are needed.
- Content: the existing action labels, sharing permissions, and project-aware new-conversation behavior are preserved.

The extra minimize/workbench actions and ChatKit's compact density are intentional differences from ChatGPT. The focused header comparison covers the requested region; full preview screenshots were inspected for surrounding layout and overflow. No visual fixes were required after the combined comparison.

## Verification and limits

- Node 22.17.1; pnpm 10.11.0. Six targeted Vitest files: 75 tests passed. `@xpert-ai/chatkit-ui` type checking passed.
- Browser preview: new conversation, more menu, summary, share open/close, and return focus passed. No preview console errors were captured. No share link was created.
- Existing lint issue remains at `useGroupConversation.tsx`: the pre-existing `useGroupConversationState()!` assertion. Newly added files pass lint.
- The full local conversation page remained in thread loading during this check; end-to-end host-page visual verification is therefore not established. The component preview renders the same production header components with synthetic data.

Final result: passed

This result applies to the scoped component visual comparison and interaction checks, not the unavailable full host-page verification.

## Toolbar and View menu follow-up

- Chat and Workbench actions, including tab overflow arrows, now share `ToolbarButton`. In the live Bid page, all inspected toolbar SVGs measured 14px under the host's compact typography. In the standalone preview they measured 16px in compact mode and 25px in spacious mode, consistently across both toolbars.
- The View menu uses a right-only stable scrollbar gutter, smaller outer padding, and matching horizontal insets for its heading and rows. Row vertical padding is half its horizontal padding. Live screenshot: `/tmp/chatkit-header-qa/bid-view-menu.jpg`.
- Project conversations retain a visible disabled Share action with an explanation. The backend's existing project-sharing restriction remains in effect. Personal conversation sharing still opens directly and restores focus on close.
- After reloading the live Bid page to refresh translations, the disabled Share action displayed its Chinese explanation correctly. No share link was created.
- Verified light/round/compact and dark/sharp/spacious themes, including the portaled View menu and keyboard opening. Screenshots: `/tmp/chatkit-header-qa/toolbars-compact.jpg` and `/tmp/chatkit-header-qa/toolbars-spacious-dark.jpg`.
- Node 22.17.1 and pnpm 10.11.0: four focused Vitest files passed (16 tests); the eight tab tests were rerun successfully after adopting the shared button for overflow arrows. UI type checking, scoped lint, and whitespace checks passed.
