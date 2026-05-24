# @xpert-ai/chatkit-word-addin

Word task pane add-in that embeds Xpert ChatKit and routes Xpert Agent client tool calls to Office.js operations.

## What is included

- React + TypeScript task pane built with Vite.
- XML add-in-only manifest generated into `dist/manifest.xml`.
- TypeScript session proxy that exchanges a server-side `XPERTAI_API_KEY` for short-lived ChatKit `client_secret` values.
- Office Bridge client tool handler for `office_word_*` tools.
- Word adapter for document snapshot, text insertion, selection replacement, headings, tables, and search.

## Local setup

```bash
pnpm install
pnpm --filter @xpert-ai/chatkit-word-addin build
```

Use `env.example` as the template for `.env.local` and set:

```bash
XPERTAI_API_KEY=sk-x-your-api-key
XPERTAI_XPERT_ID=your-xpert-id
XPERTAI_API_URL=https://your-xpert-host/api/ai
XPERTAI_CHATKIT_FRAME_URL=https://your-xpert-host/chatkit/index.html
ADDIN_BASE_URL=https://localhost:3001
```

The API key must stay on the server. The task pane only receives the short-lived `client_secret` returned by `/api/create-session`.

## Development

Run the HTTPS task pane dev server and session proxy in separate terminals:

```bash
pnpm --filter @xpert-ai/chatkit-word-addin dev
pnpm --filter @xpert-ai/chatkit-word-addin build:server
pnpm --filter @xpert-ai/chatkit-word-addin server
```

Generate the manifest:

```bash
ADDIN_BASE_URL=https://localhost:3001 pnpm --filter @xpert-ai/chatkit-word-addin manifest
```

Then sideload `packages/word-addin/dist/manifest.xml` in Word.

## Client tools

The package exports `createOfficeBridgeClientToolHandler`, `createWordOfficeAdapter`, `OFFICE_WORD_TOOL_NAMES`, and the public Office Bridge types.

The MVP supports:

- `office_word_snapshot`
- `office_word_insert_text`
- `office_word_replace_selection`
- `office_word_insert_heading`
- `office_word_insert_table`
- `office_word_search_text`

The Office Bridge uses a host adapter shape shared with the PowerPoint add-in so future Word tools can be added without changing the ChatKit client handler.
