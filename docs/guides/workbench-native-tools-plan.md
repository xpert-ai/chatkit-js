# Workbench 原生工具与文件 Views 实施计划

## 调查结论

参考 `xpert/apps/cloud/src/app/features/chat/clawxpert` 与 `@shared/files`：

- `clawxpert-conversation-files.component.ts` 使用 Assistant 文件区；有 Project 时通过 conversation 文件 API 解析实际工作区，不从客户端拼接磁盘路径。
- `@shared/files/workbench` 提供惰性目录加载、上传下载、删除、编辑保存及未保存修改保护。目录用 `hasChildren` 区分，`children: null` 表示尚未加载。
- `@shared/chat/terminal` 使用 xterm + FitAddon，连接 `sandbox-terminal` Socket.IO namespace，支持 open/input/resize/close，关闭或换范围时释放会话。
- 文件编辑包括文本/代码、Markdown、HTML、DOCX（Eigenpal / ProseMirror）、CSV/XLS/XLSX（Univer）、PPTX；图片、PDF、音视频为预览。
- 现有 ChatKit SDK 只有 workspace 文件列表和 sandbox 服务接口，必须先增加文件读写及终端 SDK；Xpert 的 terminal JWT 认证和 workspace 文件认证还需要兼容受限 ChatKit 会话。
- ChatKit 已有独立侧边聊天、scope 隔离、原生预览与远程 Views 生命周期，可复用。

## 实施顺序

- [x] 导览页：原生常用工具（文件/文件夹、终端、侧边聊天），更多工具预留插件/MCP Apps，推荐为动态视图及已关闭固定视图。
- [x] SDK：显式文件范围、文件读写/上传下载/删除、终端连接协议；保持请求认证和组织上下文。
- [x] 文件工作区：目录、搜索、创建、上传、下载、删除，文件类型分派与最近记录。
- [x] 终端与侧边聊天：独立标签、实时会话、尺寸变化与生命周期清理。
- [x] 文件 Views：文本/代码/Markdown/HTML，Office 编辑，图片/PDF/音视频预览，保存回读和未保存修改保护。
- [x] 验收：SDK 协议测试、认证/范围隔离、编辑保存测试、ChatKit 集成测试、主题与窄屏浏览器验收。

## 边界

插件和 MCP Apps 的更多工具接入按本次要求预留，不显示虚构可用工具。文件及终端通过 SDK 访问当前授权范围，禁止使用登录浏览器凭据。Office 保存应保留原包中未修改的内容；不可安全保存的文件提供明确错误而不覆盖。不同作用域的数据与编辑状态不混用。

## 落地结果

- `WorkbenchStartPage`：固定原生工具、推荐视图、最近记录、搜索/网址入口；`useWorkbenchPages` 管理独立新标签和已访问预览。
- `native/WorkspaceFiles`、`WorkspaceFileEditor`：按 Assistant/Project 会话范围浏览与编辑文件，保存冲突检查、失败保留编辑缓冲、关闭脏文件确认和草稿下载。
- `native/WorkbenchTerminal`：SDK Socket.IO 连接、xterm/FitAddon、状态/重连、会话释放。
- `native/office`：复用 ClawXpert 的 Office 解析与原包保存工具，适配 React 编辑界面；同步修复源端 PPTX 位置回写的闭合标签匹配。
- `xpert-sdk-js/packages/core/src/workbench.ts`：文件与终端协议；ChatKit 使用可复现的 0.5.0 pnpm 补丁，在 SDK 正式发布后移除。
- Xpert 服务端：会话文件端点、受限 client-secret 文件/终端认证、Assistant/tenant/organization 绑定检查、文本与表格格式保存支持。

## 验证记录

- ChatKit UI 全量：139 个测试文件，1296 项通过；之后补充文件创建覆盖保护的 2 项测试，并回归导览页。
- SDK：Workbench HTTP/二进制/认证 hook 与 terminal 协议测试通过，SDK 编译通过。
- Xpert：范围权限、文件路由 guard、Assistant workspace guard、terminal gateway、volume subtree 共 37 项通过；server-ai 类型检查通过；ClawXpert PPTX 源端回归 22 项通过。
- ChatKit 类型检查、library 和 iframe app 构建通过。应用构建仍提示 Office 编辑器等懒加载 chunk 较大。
- 本地浏览器使用真实 UI + 内存 SDK transport 测试文件，完成 DOCX/XLSX/PPTX 编辑、保存、关闭与回读，Markdown 保存/预览、HTML 隔离预览、文件夹浏览、深色/浅色和 360px 面板验收；sharp 主题下工具按钮计算圆角为 0px。
- ESLint 未执行成功：仓库使用 ESLint 9，但没有 flat config；没有修改无关 lint 配置。

## 上线前置与能力边界

本次没有发布 npm 包或部署/重启平台，也没有使用真实组织凭据连接沙箱 PTY。启用时需同时采用更新后的 SDK（本仓库已带补丁）和 Xpert 服务端，并以有权使用当前 Assistant/Project 的账号验证真实文件接口与终端。终端依赖 sandbox provider 提供 PTY 能力。

更多工具中的插件/MCP Apps 按要求仅预留。DOCX 提供连续文档与基本格式编辑；XLSX 保存单元格值/公式，结构和样式调整会阻止保存，以保护原包。PPTX 提供基本文本、位置、幻灯片和表格单元格编辑，保留未修改媒体及包内容；不是完整 Office 套件。图片/PDF/音视频使用浏览器可用的预览能力。最近记录只保存在当前运行范围内；切换 Assistant/Project/会话前需保存文件。

## 配套提交

- `xpert-sdk-js`: `89c3945`，SDK 文件与终端客户端。
- `xpert`: `c805159e2`，范围认证、文件端点和终端接入。
- `chatkit-js`: `59b0c70`，SDK 补丁与依赖；`abec0d6`，原生文件编辑器和终端 Views。
- 导览页、标签生命周期和侧边聊天入口单独提交；本说明随该提交保存。
