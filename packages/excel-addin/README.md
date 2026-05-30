# @xpert-ai/chatkit-excel-addin

Excel task pane add-in that embeds Xpert ChatKit and routes Xpert Agent client tool calls to Office.js operations.

## What is included

- React + TypeScript task pane built with Vite.
- XML add-in-only manifest generated into `dist/manifest.xml`.
- TypeScript session proxy that exchanges a server-side `XPERTAI_API_KEY` for short-lived ChatKit `client_secret` values.
- Office Bridge client tool handler for `office_excel_*` tools.
- Excel adapter for workbook snapshot, range reads/writes, worksheet management, autofit, and tables.

## Local setup

```bash
pnpm install
pnpm --filter @xpert-ai/chatkit-excel-addin build
```

Use `env.example` as the template for `.env.local` and set:

```bash
XPERTAI_API_KEY=sk-x-your-api-key
XPERTAI_XPERT_ID=your-xpert-id
XPERTAI_API_URL=https://your-xpert-host/api/ai
XPERTAI_CHATKIT_FRAME_URL=https://your-xpert-host/chatkit/index.html
ADDIN_BASE_URL=https://localhost:3002
```

The API key must stay on the server. The task pane only receives the short-lived `client_secret` returned by `/api/create-session`.

## Development

Run the HTTPS task pane dev server and session proxy in separate terminals:

```bash
pnpm --filter @xpert-ai/chatkit-excel-addin dev
pnpm --filter @xpert-ai/chatkit-excel-addin build:server
pnpm --filter @xpert-ai/chatkit-excel-addin server
```

Generate the manifest:

```bash
ADDIN_BASE_URL=https://localhost:3002 pnpm --filter @xpert-ai/chatkit-excel-addin manifest
```

Then sideload `packages/excel-addin/dist/manifest.xml` in Excel.

## Client tools

The package exports `createOfficeBridgeClientToolHandler`, `createExcelOfficeAdapter`, `OFFICE_EXCEL_TOOL_NAMES`, and the public Office Bridge types.

The MVP supports:

- `office_excel_snapshot`
- `office_excel_get_range`
- `office_excel_set_range_values`
- `office_excel_add_worksheet`
- `office_excel_delete_worksheet`
- `office_excel_autofit_range`
- `office_excel_add_table`

Delete worksheet calls require `confirm: true`. The Office Bridge uses the same host adapter contract as the PowerPoint add-in so future Excel tools can be added without changing the ChatKit client handler.
