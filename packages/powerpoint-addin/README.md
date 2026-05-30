# @xpert-ai/chatkit-powerpoint-addin

PowerPoint task pane add-in that embeds Xpert ChatKit and routes Xpert Agent client tool calls to Office.js operations.

## What is included

- React + TypeScript task pane built with Vite.
- XML add-in-only manifest generated into `dist/manifest.xml`.
- TypeScript session proxy that exchanges a server-side `XPERTAI_API_KEY` for short-lived ChatKit `client_secret` values.
- Office Bridge client tool handler for `office_powerpoint_*` tools.
- PowerPoint adapter for slide, shape, text box, and image operations.

## Local setup

```bash
pnpm install
pnpm --filter @xpert-ai/chatkit-powerpoint-addin build
```

Use `env.example` as the template for `.env.local` and set:

```bash
XPERTAI_API_KEY=sk-x-your-api-key
XPERTAI_XPERT_ID=your-xpert-id
XPERTAI_API_URL=https://your-xpert-host/api/ai
XPERTAI_CHATKIT_FRAME_URL=https://your-xpert-host/chatkit/index.html
ADDIN_BASE_URL=https://localhost:3000
```

The API key must stay on the server. The task pane only receives the short-lived `client_secret` returned by `/api/create-session`.

## Development

Run the HTTPS task pane dev server and session proxy in separate terminals:

```bash
pnpm --filter @xpert-ai/chatkit-powerpoint-addin dev
pnpm --filter @xpert-ai/chatkit-powerpoint-addin build:server
pnpm --filter @xpert-ai/chatkit-powerpoint-addin server
```

Generate the manifest:

```bash
ADDIN_BASE_URL=https://localhost:3000 pnpm --filter @xpert-ai/chatkit-powerpoint-addin manifest
```

Then sideload `packages/powerpoint-addin/dist/manifest.xml` in PowerPoint.

## Client tools

The package exports `createOfficeBridgeClientToolHandler`, `createPowerPointOfficeAdapter`, `OFFICE_POWERPOINT_TOOL_NAMES`, and the public Office Bridge types.

The MVP supports:

- `office_powerpoint_snapshot`
- `office_powerpoint_select_slide`
- `office_powerpoint_add_slide`
- `office_powerpoint_delete_slide`
- `office_powerpoint_add_text_box`
- `office_powerpoint_add_shape`
- `office_powerpoint_update_shape`
- `office_powerpoint_delete_shape`
- `office_powerpoint_insert_image`

Slide indexes exposed to the Agent are 1-based, matching what users see in PowerPoint. The adapter converts them to Office.js zero-based indexes internally.
