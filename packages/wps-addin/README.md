# @xpert-ai/chatkit-wps-addin

WPS Writer task pane add-in that embeds Xpert ChatKit and routes Xpert Agent client tool calls to WPS JSAPI operations.

## What is included

- React + TypeScript task pane built with Vite.
- WPS loader entry generated into `dist/index.html`.
- WPS `ribbon.xml`, `manifest.xml`, and `publish.xml` generated into `dist`.
- User API key mode that creates short-lived ChatKit `client_secret` values from the task pane.
- Optional TypeScript session proxy for deployments that keep `XPERTAI_API_KEY` on a server.
- Office Bridge-compatible client tool handler for existing `office_word_*` tools.
- WPS Writer adapter for document snapshot, text insertion, selection replacement, headings, tables, and search.

## Local setup

```bash
pnpm install
pnpm --filter @xpert-ai/chatkit-wps-addin build
```

The default build uses user API key mode and does not require a session proxy. After build, edit `dist/config.js` in the deployed or local add-in folder:

```js
window.XPERTAI_WPS_CONFIG = {
  sessionMode: "user-api-key",
  apiUrl: "https://api.xpertai.cn/api/ai",
  apiKey: "sk-x-your-api-key",
  xpertId: "your-xpert-id",
  frameUrl: "https://app.xpertai.cn/chatkit/index.html",
  expiresAfter: 600
};
```

If `apiKey` or `xpertId` is not configured in `config.js`, the task pane shows a local settings form and stores the user's values in browser local storage.
User API key mode requires the configured `apiUrl` to allow browser CORS requests from the add-in origin.

For server proxy mode, use `env.example` as the template for `.env.local`, set `VITE_CHATKIT_SESSION_MODE=proxy`, and configure `XPERTAI_API_KEY`, `XPERTAI_XPERT_ID`, `XPERTAI_API_URL`, and `XPERTAI_CHATKIT_FRAME_URL`. In that mode the API key stays on the server and the task pane receives the short-lived `client_secret` returned by `/api/create-session`.
`ADDIN_BASE_URL` is also used by the metadata generator to write the WPS `publish.xml` URL. You can override it with `WPS_ADDIN_URL` for one-off local installs.

## Development

Run the task pane dev server:

```bash
pnpm --filter @xpert-ai/chatkit-wps-addin dev
```

For proxy mode, run the session proxy in a separate terminal:

```bash
pnpm --filter @xpert-ai/chatkit-wps-addin build:server
pnpm --filter @xpert-ai/chatkit-wps-addin server
```

Generate WPS add-in metadata:

```bash
pnpm --filter @xpert-ai/chatkit-wps-addin manifest
```

Deploy the generated `dist` directory for WPS online/publish mode. WPS reads the local `publish.xml`, requests `${ADDIN_BASE_URL}/ribbon.xml` and `${ADDIN_BASE_URL}/index.html`, and the ribbon button opens `taskpane.html` through `Application.CreateTaskPane(...)`.

## Install for users

Recommended deployment does not require each user to run a backend server:

1. Build the add-in:

   ```bash
   WPS_ADDIN_URL=https://your-domain.example/wps-addin pnpm --filter @xpert-ai/chatkit-wps-addin build
   ```

2. Deploy `packages/wps-addin/dist` as static files. The deployed URL must serve `index.html`, `taskpane.html`, `config.js`, `ribbon.xml`, and `manifest.xml`.

3. Install the generated `publish.xml` on each user's machine. For WPS Writer, the file contains the static add-in URL:

   ```xml
   <jsplugins>
     <jspluginonline
         name="XpertAIWpsCopilot"
         url="https://your-domain.example/wps-addin"
         type="wps"
         install="true"/>
   </jsplugins>
   ```

   Common WPS add-in directories:

   - macOS global WPS: `~/Library/Containers/com.kingsoft.wpsoffice.mac.global/Data/.kingsoft/wps/jsaddons`
   - macOS non-global WPS: `~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons`
   - Windows: `%appdata%/kingsoft/wps/jsaddons`
   - Linux: `~/.local/share/Kingsoft/wps/jsaddons`

4. Restart WPS Writer. The ribbon should show the `XpertAI` tab. Click `XpertAI Copilot` to open the task pane.

5. In user API key mode, each user enters their own API key and Xpert ID in the task pane settings. The values are stored locally in the WPS webview local storage. Do not put a user's API key into a shared hosted `config.js`.

For a smoother hosted installer, provide a web page that calls WPS `WpsAddonMgr.verifyStatus` and `WpsAddonMgr.enable` with `{ name, addonType: "wps", online: "true", url }`, which writes the user's local `publish.xml` automatically.

## Client tools

The package exports `createOfficeBridgeClientToolHandler`, `createWpsWordAdapter`, `OFFICE_WORD_TOOL_NAMES`, and the public Office Bridge types.

The MVP supports the same tool names as the Word add-in so the existing Office Automation middleware can be configured with `host: "word"`:

- `office_word_snapshot`
- `office_word_insert_text`
- `office_word_replace_selection`
- `office_word_insert_heading`
- `office_word_insert_table`
- `office_word_search_text`

No backend middleware or `wps_*` tool names are required.
