# Workbench shell

`../WorkbenchShell.tsx` remains the public entry point. It owns the shared session
state, composes the existing workbench hooks, and wires `WorkbenchPanel` callbacks.

- `tabs/` coordinates native, remote, preview, guide, side-chat, and maximized
  main-chat tabs. It preserves tab order, selection restoration, and replacement.
- `commands/` handles client commands and assistant request context. Existing
  navigation and command handlers remain in the workbench modules they use.
- `side-chat/` opens copied threads, reuses pending thread copies, and handles the
  close confirmation preference. Shared side-chat state stays in the shell because
  tab ordering, scope resets, and layout also use it.
- `layout/` renders desktop panels, the narrow-screen sheet, resize controls,
  notifications, and close dialogs. The shell still owns the persistent chat and
  panel portal hosts so layout changes retain mounted content.
- `types.ts` contains the shell props and assistant context contract, independently
  of the UI entry point.

Public imports, including `useWorkbench`, `WorkbenchToggleButton`, and
`buildWorkbenchRequestContext`, remain available from `WorkbenchShell.tsx`.
Keep the existing `WorkbenchShell.test.tsx` integration coverage at that boundary;
it verifies tab replacement, navigation, scope changes, and panel lifecycles.
