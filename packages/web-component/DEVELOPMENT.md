# Development Guide

## Quick Start

### 1. 确保依赖服务运行

在开发 Web Component 之前，需要确保以下服务正在运行：

#### 启动 Chatkit iframe (端口 5173)
```bash
cd examples/managed-chatkit/frontend
npm run dev
# 应该在 http://localhost:5173 运行
```

#### 启动后端 API (端口 8000)
```bash
cd examples/managed-chatkit/backend
# 根据你的后端启动方式运行
# 应该在 http://localhost:8000 运行
```

### 2. 启动 Web Component 开发服务器

```bash
cd packages/web-component
npm install
npm run serve
```

浏览器会自动打开 http://localhost:3001，你会看到一个配置界面。

### 3. 开发流程

#### 方式 A: 使用开发服务器 (推荐)

```bash
# 启动开发服务器，自动加载源码
npm run serve
```

- 修改 `src/xpert-chatkit.ts` 后，页面会自动刷新
- 可以在界面上修改配置并重新加载

#### 方式 B: 监听构建模式

```bash
# 终端 1: 监听构建
npm run dev

# 终端 2: 在另一个终端使用构建后的文件
# 打开 example.html (需要 HTTP 服务器)
python3 -m http.server 8080
# 访问 http://localhost:8080/example.html
```

### 4. 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录：
- `xpert-chatkit.js` - ES Module 版本
- `xpert-chatkit.umd.cjs` - UMD 版本
- `xpert-chatkit.d.ts` - TypeScript 类型定义

## 测试流程

### 1. 测试 Web Component 加载

确认在浏览器控制台看到：
```
🚀 Starting Xpert Chatkit Web Component...
✅ Chatkit loaded with config: {...}
```

### 2. 测试 Session 创建

1. 检查 Network 标签，应该看到：
   - `POST http://localhost:8000/api/create-session`
   - 响应包含 `client_secret`

2. 如果看到错误：
   - **CORS 错误**: 检查后端 CORS 配置
   - **404 错误**: 确认后端在 8000 端口运行
   - **500 错误**: 检查后端日志

### 3. 测试 postMessage

在浏览器控制台运行：

```javascript
// 监听 iframe 发送的消息（如果有的话）
window.addEventListener('message', (event) => {
  console.log('📨 Message from iframe:', event);
});
```

在 iframe 端（Chatkit），你应该能收到 `chatkit:init` 消息：

```javascript
// 在 Chatkit iframe 代码中
window.addEventListener('message', (event) => {
  console.log('📨 Message received:', event.data);
  // 应该看到: { type: 'chatkit:init', clientSecret: '...', styleConfig: {...} }
});
```

### 4. 测试样式配置

1. 在配置界面修改 Style Config
2. 点击 "Load Chatkit" 重新加载
3. 在 iframe 端检查是否收到新的样式配置

## 调试技巧

### 查看 Web Component 状态

```javascript
// 在控制台
const chatkit = document.querySelector('xpert-chatkit');
console.log(chatkit);

// 查看 Shadow DOM
console.log(chatkit.shadowRoot);

// 查看 iframe
console.log(chatkit.shadowRoot.querySelector('iframe'));
```

### 查看 postMessage 通信

```javascript
// 拦截所有 postMessage
const originalPostMessage = window.postMessage;
window.postMessage = function(...args) {
  console.log('🚀 postMessage called:', args);
  return originalPostMessage.apply(this, args);
};
```

### 查看网络请求

1. 打开 DevTools -> Network 标签
2. 过滤 "create-session"
3. 检查请求和响应

### 常见问题

#### Q: 看到 "Creating session..." 一直在加载

**可能原因:**
1. 后端没有运行
2. 后端地址配置错误
3. CORS 问题

**解决方法:**
```bash
# 检查后端是否运行
curl http://localhost:8000/api/create-session

# 检查浏览器控制台的错误信息
```

#### Q: iframe 不显示

**可能原因:**
1. chatkit-url 配置错误
2. Chatkit 服务没有运行

**解决方法:**
```bash
# 确认 Chatkit 在运行
curl http://localhost:5173

# 检查 iframe src 是否正确
const iframe = document.querySelector('xpert-chatkit').shadowRoot.querySelector('iframe');
console.log(iframe.src);
```

#### Q: postMessage 没有发送

**可能原因:**
1. iframe 还没加载完成
2. client secret 没有获取成功

**解决方法:**
- 检查 Network 标签，确认 create-session 成功
- 检查控制台是否有错误

## 文件说明

```
packages/web-component/
├── src/
│   └── xpert-chatkit.ts           # 核心实现
├── dist/                           # 构建产物（git ignored）
├── index.html                      # 开发界面
├── example.html                    # 生产示例（需要先构建）
├── vite.config.ts                  # Vite 配置
├── tsconfig.json                   # TypeScript 配置
├── package.json                    # NPM 配置
├── README.md                       # 使用文档
├── DEVELOPMENT.md                  # 本文件 - 开发指南
└── INTEGRATION.md                  # 集成指南
```

## 下一步

完成 Web Component 开发后：

1. **修改 Chatkit iframe 端**
   - 更新消息监听从 `chatkit:client-secret` 到 `chatkit:init`
   - 实现样式配置应用逻辑

2. **集成测试**
   - 确保 Web Component 和 iframe 正确通信
   - 测试各种样式配置

3. **文档完善**
   - 更新 README
   - 添加更多使用示例

4. **发布**
   - 发布到 NPM
   - 部署到 CDN
