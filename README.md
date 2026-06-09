# ChatKit

An all-in-one AI chat framework that makes building conversational experiences dead simple.

🤔 Still building chat UIs from scratch? Managing message state manually? Implementing streaming yourself?

Let ChatKit handle the heavy lifting. Get a complete AI chat experience up and running in minutes.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## ✨ Why ChatKit?

- **Save Time**: Integrate a full-featured chat in 30 minutes, not weeks
- **Flexible**: Works with React, Vue, vanilla JS—customize themes your way
- **Complete**: Streaming, tools, uploads, threads—all built in

## 🚀 Quick Start

### Backend (FastAPI)

Config environment by copying `.env.example` to `.env` and filling in your values.

```python
from fastapi import FastAPI

app = FastAPI()

@app.post("/api/chatkit/session")
async def create_session():
  return {"client_secret": "your_session_token"}
```

Full example: `pnpm managed-chatkit:dev`

### Frontend (React)

```bash
npm install @xpert-ai/chatkit-react
```

Config environment by copying `.env.example` to `.env` and filling in your values.

```tsx
import { ChatKit, useChatKit } from '@xpert-ai/chatkit-react';

export function MyChat() {
  const { control } = useChatKit({
    api: {
      async getClientSecret() {
        const res = await fetch('/api/chatkit/session', { method: 'POST' });
        const { client_secret } = await res.json();
        return client_secret;
      },
    },
    theme: { colorScheme: 'light', radius: 'round' },
  });

  return <ChatKit control={control} className="h-[600px]" />;
}
```

## 📦 Key Features

- **🎨 Deep Customization** - Control colors, fonts, spacing—make it yours
- **⚡ Real-time Streaming** - Messages flow in smoothly, token by token
- **🔧 Tool Integration** - Seamless client and server tool support
- **📎 File Uploads** - Attach files and images with flexible config
- **💬 Thread Management** - Switch conversations, track history
- **🌍 i18n Ready** - 68+ locales out of the box
- **🎯 Framework Agnostic** - React/Vue/Angular/UI5/vanilla JS all work

## 📁 Project Structure

```
chatkit-js/
├── packages/
│   ├── chatkit/              # Shared ChatKit type contracts
│   ├── chatkit-web-shared/   # Shared browser utilities and messaging
│   ├── web-component/        # <xpertai-chatkit> Web Component
│   ├── chatkit-js/           # Vanilla JS integration helpers
│   ├── chatkit-react/        # React bindings
│   ├── chatkit-vue/          # Vue bindings
│   ├── chatkit-vue2/         # Vue 2 bindings
│   ├── chatkit-angular/      # Angular bindings
│   ├── chatkit-ui5/          # SAP UI5 bindings
│   ├── chatkit-ui/           # Iframe chat UI application
│   ├── chatkit-widgets/      # A2UI React widget renderer
│   ├── host-automation/      # Host page client-tool automation
│   └── browser-extension/    # Chrome extension host package
├── examples/
│   ├── managed-chatkit/      # React + FastAPI full-stack example
│   ├── managed-chatkit-angular/
│   └── excel-echarts-chatkit/
└── docs/                    # Documentation
```

## 📦 Workspace Packages

- [@xpert-ai/chatkit-types](./packages/chatkit/)
- [@xpert-ai/chatkit-web-shared](./packages/chatkit-web-shared/)
- [@xpert-ai/chatkit-web-component](./packages/web-component/)
- [@xpert-ai/chatkit-js](./packages/chatkit-js/)
- [@xpert-ai/chatkit-react](./packages/chatkit-react/)
- [@xpert-ai/chatkit-vue](./packages/chatkit-vue/)
- [@xpert-ai/chatkit-vue2](./packages/chatkit-vue2/)
- [@xpert-ai/chatkit-angular](./packages/chatkit-angular/)
- [@xpert-ai/chatkit-ui5](./packages/chatkit-ui5/)
- [@xpert-ai/chatkit-ui](./packages/chatkit-ui/)
- [@xpert-ai/chatkit-host-automation](./packages/host-automation/)
- [@xpert-ai/a2ui-react](./packages/chatkit-widgets/)
- [@xpert-ai/chatkit-browser-extension](./packages/browser-extension/) (private Chrome extension package)

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run full-stack example
pnpm managed-chatkit:dev

# Run Angular example
pnpm managed-chatkit-angular:dev

# Run Excel/ECharts example
pnpm excel-echarts-chatkit:dev

# Dev UI components
pnpm dev:ui

# Run tests
pnpm test

# Lint code
pnpm lint
```

## Publish

This repo uses **Changesets + GitHub Actions** for automated npm publishing.
The private browser extension package is versioned by Changesets and packaged
separately by `.github/workflows/publish-browser-extension.yml`.

### One-time setup

1. For packages that already exist on npm, configure this GitHub repository as a **Trusted Publisher** for the package(s) released from this repo.
2. For brand-new packages, do a one-time manual publish first, then configure trusted publishing for subsequent releases.
3. Ensure GitHub Actions has permission to create pull requests and request an OIDC token (used by `.github/workflows/release.yml`).

### Release flow

1. Make package changes in a feature branch.
2. Add a changeset:

```bash
pnpm changeset
```

3. Commit and merge into `main`.
4. GitHub Action `Release` will run on `main` push:
   - Create/update a Release PR with version bumps and changelogs.
   - After the Release PR is merged, publish packages to npm automatically.

### First publish for a new package

Trusted publishing can only be configured after the package already exists on npm. For a brand-new package such as `@xpert-ai/chatkit-angular`:

1. Sign in to npm with an account that has publish access to the `@xpert-ai` scope.
2. Build the repo:

```bash
pnpm build
```

3. Publish the new package once manually:

```bash
pnpm --filter @xpert-ai/chatkit-angular publish --access public
```

4. After the first publish succeeds, configure the package to use this repo's trusted publisher / `.github/workflows/release.yml`.
5. Future releases of that package can then go through the normal Changesets + GitHub Actions flow.

### Manual fallback (optional)

If you need to publish manually from your local machine, make sure you are authenticated with npm first (`npm login` or an npm access token), then run:

```bash
pnpm build && pnpm changeset publish
```

## 📚 Learn More

- [Full Documentation](docs/index.md)
- [Configuration Options](packages/chatkit/src/options.ts)
- [Thread Management](docs/concepts/threads.md)
- [Tool Integration](docs/concepts/tools.md)
- [Example Project](examples/managed-chatkit/)

## 💻 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

## 🗺️ Roadmap

- [x] Core message streaming
- [x] Thread management
- [x] File attachments
- [ ] Advanced theming
- [x] Tool call visualization
- [ ] Voice I/O
- [ ] WebSocket support

## 🤝 Contributing

We love contributions!

1. Fork the project
2. Create a branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- 📖 [Documentation](docs/index.md)
- 🐛 [Issues](https://github.com/xpert-ai/chatkit-js/issues)
- 💬 [Discussions](https://github.com/xpert-ai/chatkit-js/discussions)

## 📄 License

Apache License 2.0

---

Built with ❤️ by the **Xpert AI** team

Got questions? Want to chat? Feel free to [open an issue](https://github.com/xpert-ai/chatkit-js/issues) or [join the discussion](https://github.com/xpert-ai/chatkit-js/discussions)
