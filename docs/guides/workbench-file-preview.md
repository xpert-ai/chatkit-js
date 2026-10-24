# Remote View file previews

ChatKit supports `workbench.file.open` with a resource reference. New Views should
use this form so private URLs and file bytes stay in the authenticated host:

```ts
import type { ChatKitWorkbenchResourceFileOpen } from '@xpert-ai/chatkit-types';

const payload = {
  resource: { fileKey: 'document-original', targetId: document.id },
} satisfies ChatKitWorkbenchResourceFileOpen;

await invokeClientCommand('workbench.file.open', payload);
```

This is a ChatKit command payload, separate from the SDK's legacy URL-based
`WorkbenchOpenFile`. A View must declare `workbench.file.open` in its
`clientCommands`, and its file provider must authorize the `preview` purpose.
Download independently requests `download` permission. Older hosts without this
resource form need their existing URL-based integration until upgraded.

The invoking View and current Assistant, organization, project and conversation
determine the scope. The payload cannot choose another View or runtime scope.
The host uses the SDK session → grant → read → revoke transport shared with
resource cards. File names and MIME types come from the grant. Failed reads,
expired grants, cancellation and scope changes do not open stale previews.
The command returns an opened tab identifier, never private URLs or content.

The shared file viewer renders images (including zoom, rotation and pan), PDF,
DOCX, spreadsheets, PPTX, text, Markdown, sandboxed HTML, audio and video. Actual
format support follows the existing renderer and browser; unsupported files
retain Download. This does not change any business plugin's upload whitelist.
Native binary preview types must agree with the MIME type, preventing HTML
content with a misleading PDF extension from entering a native PDF frame.

Existing HTTP(S) file commands retain their URL behavior. Older Views that
round-trip a materialized base64 data URL now use the same shared file viewer
for all supported file kinds instead of an image-only branch. This compatibility
path is self-contained and does not confer server file permissions. New code
should use resource references, avoiding the duplicate binary transfer and
letting the server enforce independent preview and download permissions.
`workbench.browser.open` continues to accept only HTTP(S) navigation.
