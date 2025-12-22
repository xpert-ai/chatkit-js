# Managed Chatkit Frontend

这是使用 `@xpert-ai/chatkit-web-component` 的示例应用。

## 快速开始

### 1. 确保依赖已安装

```bash
# 在项目根目录
pnpm install
```

### 2. 配置环境变量

查看 `.env` 文件，确保配置正确：

```env
VITE_CHATKIT_TARGET=http://localhost:5176  # Chatkit UI 地址
VITE_CHATKIT_ASSISTANT_ID=your-assistant-id
VITE_BACKEND_TARGET=http://localhost:8000  # 后端代理地址
VITE_BACKEND_ORIGIN=                        # 留空使用代理
```

### 3. 启动服务

**终端 1 - 后端:**
```bash
cd ../backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**终端 2 - Chatkit UI:**
```bash
cd ../../../packages/chatkit-ui
pnpm run dev
```

**终端 3 - Frontend:**
```bash
pnpm run dev
```

## 代码说明

### App.tsx

```tsx
import '@xpert-ai/chatkit-web-component';

export default function App() {
  const backendOrigin = import.meta.env.VITE_BACKEND_ORIGIN ?? '';
  const assistantId = import.meta.env.VITE_CHATKIT_ASSISTANT_ID ?? '';
  const chatkitTarget = import.meta.env.VITE_CHATKIT_TARGET ?? '';

  return (
    <div className="flex h-screen">
      <div className="w-96 p-4 border-r border-gray-300">
        <h1 className="text-2xl font-bold mb-4">Managed Chatkit Example</h1>
        {/* 配置信息显示 */}
      </div>

      {/* Web Component 自动处理所有逻辑 */}
      <xpert-chatkit
        backend-url={backendOrigin}
        chatkit-url={chatkitTarget}
        assistant-id={assistantId}
        className="flex-1"
      />
    </div>
  );
}
```

### 主要特性

- ✅ **自动 Session 管理**: Web Component 自动调用后端创建 session
- ✅ **自动 postMessage**: 自动将 client secret 发送给 iframe
- ✅ **Loading 状态**: 内置加载状态显示
- ✅ **错误处理**: 自动显示错误信息
- ✅ **类型安全**: TypeScript 类型声明

## 调试

打开浏览器控制台查看日志：

```
🚀 Managed Chatkit Example with Web Component
[xpert-chatkit] Sending init message to iframe: {...}
[chatkit-ui] Received message: chatkit:init {...}
```

## 常见问题

### Q: 看不到 Chatkit UI？

**检查:**
1. Chatkit UI 是否在运行？访问 http://localhost:5176
2. 浏览器控制台是否有错误？
3. Network 标签中 `/api/create-session` 是否成功？

### Q: CORS 错误？

**解决:**
- 确保 `VITE_BACKEND_ORIGIN` 为空（使用代理）
- 或者后端正确配置了 CORS

### Q: 消息发送失败？

**检查:**
1. 后端是否正常运行？
2. Assistant ID 是否正确？
3. 控制台是否有错误日志？

## 与旧版本对比

| 功能 | 旧版本 (iframe) | 新版本 (Web Component) |
|------|----------------|----------------------|
| 代码行数 | ~135 行 | ~43 行 |
| Session 管理 | 手动 | 自动 |
| postMessage | 手动 | 自动 |
| Loading 状态 | 手动实现 | 内置 |
| 错误处理 | 手动实现 | 内置 |
| TypeScript | 需要自己写类型 | 自带类型 |
| 可重用性 | React 专用 | 任何框架 |

## 更多信息

查看 [MIGRATION.md](../MIGRATION.md) 了解迁移详情。
