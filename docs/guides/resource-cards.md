# Composable resource cards

Resource cards identify a business result and provide a durable route to open it.
The business identity (`resource.namespace`, `type`, `id`) is independent of its
presentation. A project, report, or receipt can compose the same content blocks.

`ConversationResourceCard.content` is an optional ordered array of
`ResourceCardContent`. Each block can have its own `title`:

| Kind            | Items                                        | Behavior                                                                             |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `image-gallery` | `images: ResourceCardImage[]`                | One responsive row by default; More expands the gallery. Click opens a file preview. |
| `file-list`     | `files: ResourceCardFile[]`                  | Title, optional description, and an authorized download action.                      |
| `fields`        | `fields: { label: string; value: string }[]` | Read-only summary values rendered as text.                                           |

```ts
import type { ConversationResourceCard } from '@xpert-ai/chatkit-types';

const card: ConversationResourceCard = {
  resource: { namespace: 'bid', type: 'chapter-delivery', id: 'task-id' },
  title: '施工总体部署',
  open: {
    target: 'workbench.view',
    viewKey: 'bid.view-provider__bid.studio',
    parameters: { projectId: 'project-id' },
  },
  content: [
    { kind: 'fields', fields: [{ label: '状态', value: '已验收' }] },
    {
      kind: 'image-gallery',
      title: '施工配图',
      images: [
        {
          id: 'site-layout',
          title: '现场平面布置图',
          alt: '施工区域与临时设施布置',
          file: {
            viewKey: 'bid.view-provider__bid.studio',
            fileKey: 'bid-project-image',
            targetId: 'project-id:asset-version-id',
          },
        },
      ],
    },
  ],
};
```

Xpert plugins import these same public types and `emitResourceCard` from
`@xpert-ai/plugin-sdk`. Emit only after the business mutation commits. Repeated
emission upserts the same resource in its owning reply; cards do not change the
task outcome or become model transcript text.

## File access

Images and files carry only `{ viewKey, fileKey, targetId }`, resolved by the
provider's file capability in the current assistant/project scope. Do not embed
credentials, temporary URLs, or file bytes in messages. File-list providers must
authorize the `download` purpose; image providers authorize `preview`.

File renderers use the SDK session → grant → read → revoke flow. The grant
supplies MIME type and filename. Image previews accept PNG, JPEG, WebP and
GIF and enforce a 50 MiB thumbnail limit. Collapsed images are not mounted or
loaded until expanded. Explicit file downloads are not capped by the thumbnail
limit. Leaving the scope cancels pending downloads.

Use `workbench.file` to open a deliverable in a file tab with preview and download,
without navigating to the business view. An optional `previewFile` can reference
a derived PDF, while Download always resolves the original file:

```ts
open: {
  target: 'workbench.file',
  viewKey: 'bid.view-provider__bid.studio',
  fileKey: 'bid-export-docx',
  targetId: 'export-version-id',
  previewFile: {
    viewKey: 'bid.view-provider__bid.studio',
    fileKey: 'bid-export-preview-pdf',
    targetId: 'export-version-id',
  },
}
```

File tabs share the workspace preview body for images, PDF, text, Markdown,
sandboxed HTML, audio and video. Unsupported types keep
the download action. A missing/pending preview can be retried without disabling
the original download. Both references are authorized independently; messages
never grant access or supply browser URLs. File tabs close on a scope change.

## UI module boundaries

- `resource-cards/` owns the narrow resource action contract/context and SDK file
  access adapters under `files/`. File access depends on authentication and the
  current runtime scope, not on whether Workbench navigation is enabled.
- `components/thread/messages/resource-cards/` renders cards and content blocks.
  It consumes resource actions only; it does not import the Workbench context,
  Shell, or SDK. A host can provide inline image loading/download without tabs.
- `components/file-preview/` owns shared preview loading, cancellation, Blob URL
  lifetime and format rendering. It accepts a file source with separate preview
  and original-download callbacks, with no dependency on resource cards or the
  Workbench. Each mounted surface owns its own URL.
- `workbench/resource-cards/` adapts the resource actions to file tabs and view
  navigation. Image clicks and file-card clicks use the same file preview and
  download toolbar. Navigation persistence is also local to this folder.
- `workbench/preview/` owns the discriminated preview model and renderer dispatch.
  URL, resource-file, snapshot, HTML and review sources cannot be mixed in one
  preview. Command payload parsing is separate from this in-memory UI model.
- `lib/files/` contains file-format and browser-download helpers, independently of
  any workspace screen.

Keep capability availability separate: an unavailable navigation action disables
Open, but does not disable authorized image loading or downloading. Do not pass a
parent conversation's resource actions into a side conversation. Protocol tests
under `resource-cards/` check the installed SDK's producer types and JSON fixtures
against ChatKit's parser, without introducing an SDK runtime dependency into the
public ChatKit wire types.

## Compatibility and extension

The parser accepts up to 32 blocks and 100 items per block. These are transport
bounds, not business limits on how many illustrations a chapter can contain.
Unknown or malformed blocks are skipped independently. The card header and
typed `open` route remain available. Item IDs must be unique within their block.

Historical top-level `images` are converted to an `image-gallery` at the read
boundary when `content` is absent. New producers emit `content` only. Deploy the
updated shared protocol/platform and renderer before switching producers; old
readers cannot display new blocks.

To add a presentation kind, extend `ResourceCardContent`, its boundary parser,
and the block dispatcher in `ResourceCardBlocks`. Add parser and renderer tests.
Synchronize the SDK's wire types and Xpert's public exports. Existing business
resource types and the event/persistence transport need no kind-specific logic.
Do not register executable plugin code from message payloads; use a Workbench
view for richer application interaction.
