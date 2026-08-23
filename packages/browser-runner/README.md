# ChatKit Browser Runner

Runs ChatKit `host_page_*` automation in a separate, visible Chrome window with
an ephemeral profile and download directory. It does not copy the user's Chrome
profile, cookies, storage, or credentials.

Build the package, find the extension ID on `chrome://extensions`, then install
the Native Messaging host:

```sh
pnpm --filter @xpert-ai/chatkit-browser-runner build
node packages/browser-runner/dist/native-host.js --install-host --extension-id <extension-id>
```

The runner uses the installed Chrome channel by default. Set
`CHATKIT_BROWSER_RUNNER_EXECUTABLE_PATH` to use a specific Chrome/Chromium
binary, or `CHATKIT_BROWSER_RUNNER_CHANNEL` to select another Playwright channel.

The extension's options page can then start, stop, and select the isolated
runner. Manual input or navigation pauses the active action chain and requires a
fresh snapshot.
