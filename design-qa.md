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

## Summary side-chat rows — 2026-11-25

Scope: match the side-chat section highlighted in the supplied ChatGPT screenshot, within the existing ChatKit summary. Preserve the host theme and the conversation/thread model.

### Evidence and normalization

- Source: `/var/folders/x6/8x8b7vx12jg24jfdtvl2tv5c0000gn/T/codex-clipboard-aaaa3436-98b4-49cc-b916-d7c2dd59f084.png`, 836 × 972 pixels. The highlighted row is approximately 550 × 56 pixels. Source density is not provided; an assumed 2x scale is used only to compare proportions.
- Current light panel: `/Users/xpertai05/tiwen/.xpert-local-environment/chatkit-upgrade/summary-row-light-panel.png`, 640 × 674 pixels, captured at a 1440 × 1000 CSS viewport and 2x density.
- Current focused row: `/Users/xpertai05/tiwen/.xpert-local-environment/chatkit-upgrade/summary-row-light-detail.png`, 572 × 56 pixels (286 × 28 CSS px). State: selected, running, pointer over the row, light/round/normal theme.
- Dark panel: `/Users/xpertai05/tiwen/.xpert-local-environment/chatkit-upgrade/summary-row-dark-panel.png`, 640 × 582 pixels. Dark/sharp/compact at a 390 × 844 CSS viewport, 2x density.
- Context-menu state: `/Users/xpertai05/tiwen/.xpert-local-environment/chatkit-upgrade/summary-row-dark-context-menu.png`. The menu stays inside the narrow viewport and inherits the active theme.
- Source and rendered panel/row screenshots were opened together for comparison. The full panel comparison checks alignment and surrounding sections; the focused row comparison checks chat/status/action icon order, text baseline, height, and whole-row highlighting. Chat titles and row counts are fixture data; existing 20rem panel width is intentional.
- Evidence uses production components with synthetic records, through the existing automated Chromium harness. The in-app browser connection timed out twice; authenticated host-page visual verification is not claimed. The real host and ChatKit dev servers are running and their health checks passed.

### Findings and iterations

- [P2, fixed] The first implementation's 32px row and 18px icons were larger than the reference proportions. Reduced the row to 28px, the chat/action icons to 16px (14px under compact density), and stroke weight to 1.75. Latest row evidence above shows the corrected rhythm.
- [P1, fixed] Opening rename from the context menu mounted its input before the menu focus trap released. Deferred the rename action until menu close; automated browser checks now verify input focus, saving, and F2 renaming.
- No actionable P0/P1/P2 findings remain in the requested component scope.

### Fidelity surfaces

- Typography: inherited ChatKit/host font; preview computes to Geist Variable with CJK fallback, 14px, weight 500. This intentionally preserves the product font rather than replacing it with the native reference app's font. Long titles truncate while retaining their full accessible/title text.
- Spacing: 28px normal row, shared radius tokens, a stable left chat icon, trailing status and action controls, and whole-row neutral highlighting. Compact and spacious sizes use density tokens; the action hit target remains at least 28px.
- Colors: semantic foreground, muted, and destructive tokens; light and dark selected/focus states remain legible. No screenshot-specific colors are hard-coded.
- Assets: matching Lucide MessageCircle, LoaderCircle, Archive/ArchiveRestore icons; no custom SVG, raster replacement, or invented brand assets. The spinner respects reduced-motion preferences.
- Copy/behavior: visible status words and pencil controls are replaced with compact icons. Status names remain accessible and available on hover. Rename is in the context menu and F2; the creation control appears on heading hover/focus and remains available in New View. The trailing box control is explicitly labelled collapse/reopen: it affects one Workbench tab, retains its thread and draft, and does not archive the whole conversation.

### Verification

- Browser checks: open/select, collapse and reopen, context-menu rename, autofocus, F2 rename, Escape/focus restoration, and dark/sharp/compact narrow-screen bounds passed; no page errors. Receipt: `/Users/xpertai05/tiwen/.xpert-local-environment/chatkit-upgrade/summary-row-preview-result.json`.
- Regression coverage includes closing the active side chat through the summary controller and selecting its adjacent tab without unmounting or deleting its runtime.
- Root `corepack pnpm test` passed (UI: 2730 passed, 1 skipped); root `corepack pnpm types` passed. The focused summary tests were rerun after the context-menu focus fix. Scoped ESLint reports zero errors and the existing missing-setter dependency warning in `useWorkbenchShellTabs`.
- Local runtime: Node 24.18.1 / pnpm 10.11.0. Data Xpert remote pull timed out twice; its existing local checkout was retained and dependencies installed with the frozen lockfile. ChatKit pull succeeded.
- Implementation checklist: row fidelity, per-tab actions, accessible status, context-menu theme inheritance, keyboard focus, responsive bounds — complete.
- Follow-up polish: none required in this scope. Cross-device per-thread archiving is outside this visual change; the existing archive API operates on the conversation.

final result: passed
