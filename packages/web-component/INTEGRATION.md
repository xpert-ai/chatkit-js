# Integration Guide

## 完整集成流程

### 1. iframe 端修改（chatkit）

iframe 需要监听 `chatkit:init` 消息，这个消息包含了 `clientSecret` 和 `styleConfig`：

```typescript
// 在 iframe 端 (chatkit 应用中)
window.addEventListener('message', (event) => {
  // 验证来源
  if (event.origin !== expectedOrigin) return;

  const message = event.data;

  // 处理初始化消息
  if (message.type === 'chatkit:init') {
    const { clientSecret, styleConfig } = message;

    // 使用 clientSecret 初始化会话
    initializeSession(clientSecret);

    // 应用样式配置（如果提供）
    if (styleConfig) {
      applyStyleConfig(styleConfig);
    }
  }
});
```

### 2. 后端 API 要求

后端需要提供一个 `/api/create-session` 端点：

```typescript
// POST /api/create-session
// Request body: { assistantId?: string }
// Response: { client_secret: string }

app.post('/api/create-session', async (req, res) => {
  const { assistantId } = req.body;

  try {
    // 创建会话并返回 client secret
    const session = await createChatSession(assistantId);

    res.json({
      client_secret: session.clientSecret
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});
```

### 3. 使用 Web Component

#### 基础使用

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="path/to/xpert-chatkit.js"></script>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      height: 100vh;
    }

    xpert-chatkit {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <xpert-chatkit
    backend-url="https://your-backend.com"
    chatkit-url="https://chatkit.xpert.ai"
    assistant-id="assistant_123">
  </xpert-chatkit>
</body>
</html>
```

#### 带样式配置

```html
<xpert-chatkit
  backend-url="https://your-backend.com"
  chatkit-url="https://chatkit.xpert.ai"
  assistant-id="assistant_123"
  style-config='{
    "primaryColor": "#007bff",
    "secondaryColor": "#6c757d",
    "fontSize": "14px",
    "borderRadius": "8px",
    "fontFamily": "Inter, sans-serif"
  }'>
</xpert-chatkit>
```

#### 程序化使用

```javascript
// 动态创建
const chatkit = document.createElement('xpert-chatkit');
chatkit.setAttribute('backend-url', 'https://your-backend.com');
chatkit.setAttribute('chatkit-url', 'https://chatkit.xpert.ai');
chatkit.setAttribute('assistant-id', 'assistant_123');

// 设置样式
chatkit.updateStyleConfig({
  primaryColor: '#007bff',
  fontSize: '16px'
});

document.body.appendChild(chatkit);
```

### 4. 消息协议

#### Web Component → iframe

```typescript
interface ChatkitInitMessage {
  type: 'chatkit:init';
  clientSecret: string;
  styleConfig?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontSize?: string;
    borderRadius?: string;
    fontFamily?: string;
    // ... 其他样式配置
  };
}
```

消息在以下时机发送：
- iframe onload 事件触发时
- client secret 成功获取后

### 5. 样式配置 Schema

样式配置是一个灵活的 JSON 对象，具体支持的字段由 iframe 端决定。常见字段包括：

```typescript
interface StyleConfig {
  // 颜色
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;

  // 字体
  fontSize?: string;
  fontFamily?: string;
  lineHeight?: string;

  // 间距
  padding?: string;
  margin?: string;

  // 边框
  borderRadius?: string;
  borderColor?: string;
  borderWidth?: string;

  // 阴影
  boxShadow?: string;

  // 其他自定义字段
  [key: string]: unknown;
}
```

### 6. 错误处理

Web Component 会自动处理以下错误：

- **网络错误**: 无法连接到后端 API
- **认证错误**: 后端返回 4xx/5xx 错误
- **配置错误**: 缺少必需的属性

错误会：
1. 在控制台输出（带 `[xpert-chatkit]` 前缀）
2. 在界面上显示错误信息

### 7. 安全考虑

#### CORS 配置

后端需要正确配置 CORS：

```javascript
app.use(cors({
  origin: ['https://your-frontend.com'],
  credentials: true
}));
```

#### postMessage 安全

iframe 端应该验证消息来源：

```typescript
window.addEventListener('message', (event) => {
  // 只接受来自可信来源的消息
  const trustedOrigins = [
    'https://your-frontend.com',
    'http://localhost:3000' // 开发环境
  ];

  if (!trustedOrigins.includes(event.origin)) {
    console.warn('Untrusted message origin:', event.origin);
    return;
  }

  // 处理消息...
});
```

### 8. 开发和调试

#### 本地开发

```bash
# 1. 构建 web component
cd packages/web-component
npm run build

# 2. 使用示例页面测试
# 打开 example.html 在浏览器中
```

#### 调试 postMessage

在浏览器控制台中监听消息：

```javascript
window.addEventListener('message', (event) => {
  console.log('Message received:', event);
  console.log('Origin:', event.origin);
  console.log('Data:', event.data);
});
```

### 9. 生产部署

#### 构建

```bash
npm run build
```

#### CDN 部署

将 `dist/xpert-chatkit.js` 部署到 CDN：

```html
<!-- ES Module -->
<script type="module" src="https://cdn.example.com/xpert-chatkit.js"></script>

<!-- UMD (传统方式) -->
<script src="https://cdn.example.com/xpert-chatkit.umd.cjs"></script>
```

#### NPM 发布

```bash
npm publish
```

使用者可以通过 npm 安装：

```bash
npm install @xpert-ai/chatkit-web-component
```

```javascript
import '@xpert-ai/chatkit-web-component';
```

### 10. 浏览器兼容性

支持所有现代浏览器：
- Chrome/Edge 54+
- Firefox 63+
- Safari 10.1+

对于旧浏览器，需要添加 polyfill：

```html
<script src="https://unpkg.com/@webcomponents/webcomponentsjs@2/webcomponents-loader.js"></script>
<script type="module" src="xpert-chatkit.js"></script>
```

## 常见问题

### Q: 如何更新样式配置？

A: 目前样式配置只在初始化时应用一次。如果需要动态更新，需要重新创建组件：

```javascript
const oldChatkit = document.querySelector('xpert-chatkit');
oldChatkit.remove();

const newChatkit = document.createElement('xpert-chatkit');
// 设置新的属性...
```

### Q: 如何处理会话过期？

A: Web Component 会在每次加载时创建新的会话。如果需要会话持久化，需要在后端实现会话管理。

### Q: 可以在 React/Vue/Angular 中使用吗？

A: 可以！Web Component 可以在任何框架中使用：

**React:**
```jsx
function App() {
  return (
    <xpert-chatkit
      backend-url="https://api.example.com"
      chatkit-url="https://chatkit.xpert.ai"
      assistant-id="assistant_123"
    />
  );
}
```

**Vue:**
```vue
<template>
  <xpert-chatkit
    backend-url="https://api.example.com"
    chatkit-url="https://chatkit.xpert.ai"
    assistant-id="assistant_123"
  />
</template>
```

**Angular:**
```typescript
// app.module.ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
```

```html
<xpert-chatkit
  backend-url="https://api.example.com"
  chatkit-url="https://chatkit.xpert.ai"
  assistant-id="assistant_123">
</xpert-chatkit>
```
