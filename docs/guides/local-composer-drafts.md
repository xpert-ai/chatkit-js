# Local Assistant composer drafts

Assistant composers automatically recover browser-local drafts using the existing
runtime context. Hosts do not need any additional configuration or identity fields.

Drafts are separated by API base URL, active organization, Assistant, and `threadId`.
They belong to the conversation branch in this browser, without a separate
per-account namespace. A thread identifies a concrete branch; `conversationId` identifies
its parent conversation record and may be resolved later by history loading. The
composer never substitutes that record ID for a thread ID. Existing thread IDs
are stable across Project metadata loading. New chats have no durable draft key:
each unbound input instance keeps its own in-memory draft until the server creates
a real thread. A reload before that first thread exists cannot restore its input.

Text (including spaces, blank lines and trailing newlines), thread tokens,
capability tokens and portable quote/code/element references are stored as
validated structured data. Restored capabilities still use the current runtime
catalog and server authorization. File objects, image attachment handles and
signed image URLs are not restored; the recovery notice asks the user to re-add
attachments and check selections. This does not create or upload replacement files.

Edits write synchronously to `localStorage`. An explicit empty draft removes its
entry. A send moves its content into a separate pending snapshot until server
admission is acknowledged; local queue insertion alone is not acknowledgement.
Acceptance or explicit queue deletion removes only that snapshot. Rejection
restores it in its original scope alongside newer input. Unknown admission keeps
a recoverable copy without automatically resending it. After a refresh, check
conversation history before manually resending recovered pending content.
Goal-mode objectives are cleared after the goal API has durably accepted them.

Storage denial, corrupted entries and quota failures leave editing usable. No
credentials are stored or logged. Browser storage belongs to the ChatKit frame's
origin; changing that origin or clearing browser storage removes access to these
local drafts. This is local recovery, not cross-device synchronization.

Regression coverage includes StrictMode remounts, scope switches, acceptance and
rejection races, unavailable storage, structured references, browser block-line
parsing, and a production Web Component + iframe fixture in Chromium.
