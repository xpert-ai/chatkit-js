# Migration to Web Component

## 更新说明

`examples/managed-chatkit` 现在使用 `@xpert-ai/chatkit-web-component` 而不是直接使用 iframe。

## 主要变化

### 1. Frontend (React 应用)

**之前:**
```tsx
// App.tsx - 135 行代码
- 手动管理 session 创建
- 手动管理 iframe ref
- 手动 postMessage 发送 client secret
- 需要处理 loading/error 状态
```

**现在:**
```tsx
// App.tsx - 43 行代码 ✨
import '@xpert-ai/chatkit-web-component';

<xpert-chatkit
  backend-url={backendOrigin}
  chatkit-url={chatkitTarget}
  assistant-id={assistantId}
  className="flex-1"
/>
```

**简化了:**
- ✅ 代码量减少 68%
- ✅ 自动处理 session 创建
- ✅ 自动处理 postMessage
- ✅ 内置 loading 和 error 状态
- ✅ 不需要 React hooks

### 2. Chatkit UI (iframe 端)

**更新:**
```tsx
// packages/chatkit-ui/src/main.tsx
// 现在支持两种消息格式（向后兼容）:
- chatkit:client-secret (旧格式)
- chatkit:init (新格式，包含 styleConfig 支持)
```

### 3. 新增类型声明

```tsx
// src/vite-env.d.ts
declare namespace JSX {
  interface IntrinsicElements {
    'xpert-chatkit': React.DetailedHTMLProps<...>;
  }
}
```

## 如何测试

### 1. 启动后端
```bash
cd examples/managed-chatkit/backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. 启动 Chatkit UI
```bash
cd packages/chatkit-ui
pnpm run dev
# 应该运行在 http://localhost:5176
```

### 3. 启动 Frontend
```bash
cd examples/managed-chatkit/frontend
pnpm run dev
# 应该运行在 http://localhost:5173 (或其他端口)
```

### 4. 验证

打开浏览器控制台，你应该看到：

**Frontend 日志:**
```
🚀 Managed Chatkit Example with Web Component
Backend: (using proxy)
Chatkit URL: http://localhost:5176
Assistant ID: e6342c69-372c-4bd3-8e96-3ab4ddd5be37
```

**Web Component 日志:**
```
[xpert-chatkit] Sending init message to iframe: {type: 'chatkit:init', clientSecret: '...'}
```

**Chatkit UI 日志:**
```
[chatkit-ui] Received message: chatkit:init {type: 'chatkit:init', clientSecret: '...'}
```

### 5. 测试功能
- [ ] 页面加载后自动创建 session
- [ ] iframe 正确显示 Chatkit UI
- [ ] 可以发送消息
- [ ] 可以接收回复
- [ ] 没有 CORS 错误

## 回滚说明

如果需要回滚到旧版本：

```bash
# 恢复原来的 App.tsx
cp examples/managed-chatkit/frontend/src/App.tsx.backup examples/managed-chatkit/frontend/src/App.tsx

# 移除依赖
# 编辑 package.json，删除 @xpert-ai/chatkit-web-component
pnpm install
```

## 未来计划

- [ ] 添加样式配置支持（styleConfig）
- [ ] 在 Chatkit UI 中实现动态样式应用
- [ ] 添加更多配置选项
- [ ] 优化错误处理和用户反馈

## 架构对比

### 旧架构
```
React App (Frontend)
  ↓ fetch
Backend API (/api/create-session)
  ↓ client_secret
React App (Frontend)
  ↓ postMessage
iframe (Chatkit UI)
```

### 新架构
```
React App (Frontend)
  ↓ 使用
Web Component (<xpert-chatkit>)
  ↓ 自动 fetch
Backend API (/api/create-session)
  ↓ 自动 postMessage
iframe (Chatkit UI)
```

**优势:**
- 更好的封装
- 可在任何框架中重用
- 更少的样板代码
- 自动处理复杂逻辑
