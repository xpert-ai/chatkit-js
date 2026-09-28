# ChatKit UI

This package contains the UI application rendered inside the ChatKit iframe, providing the chat experience and its in-iframe UI shell.

## Role in the ChatKit project

- Hosts the web UI that runs inside the embedded ChatKit iframe.
- Implements the chat view, message rendering, and interactive widgets for end users.
- Serves as the iframe-facing surface that communicates with the host app via ChatKit APIs.

## Assistant Workbench layout

The chat / Workbench split remembers its chat width, open state and maximized
state on this device, scoped by API service, organization and Assistant. Switching
conversations keeps the same layout; reopening an Assistant or reloading the frame
restores it once compatible Workbench views are available. No server settings or
conversation data are written for this preference.

Chat width is stored in CSS pixels and clamped to fit the current window. Temporary
window constraints do not overwrite the preferred width. Narrow screens use a
temporary drawer layout without changing the saved desktop layout. Corrupt or
unavailable browser storage falls back to the default layout.
