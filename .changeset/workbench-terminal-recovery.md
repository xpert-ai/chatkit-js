---
'@xpert-ai/chatkit-ui': patch
---

Fix Workbench terminal crashes during rapid tab changes and React StrictMode
cleanup by upgrading xterm and ignoring callbacks from disposed sessions. Keep
terminal connections and output when switching languages, and avoid focusing
hidden terminals.

Show localized guidance when the server requires the Computer desktop terminal
or reports an unsupported or disabled sandbox. Disable the terminal launcher for
that Workbench context while preserving reconnect for transient failures. Isolate
native view loading failures so other tabs remain usable, with a localized reload
action and documented development recovery steps.
