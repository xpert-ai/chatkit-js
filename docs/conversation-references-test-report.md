# Conversation references / read_thread 测试报告

测试日期：2026-09-23。平台修改和测试位于 `xpert`；`xpert-pro` 工作区保持干净。实现计划见 [conversation-references.md](conversation-references.md)。

## 结果

| 范围 | 本次结果 | 测试方式 |
| --- | --- | --- |
| ChatKit UI | 100 个文件、987 项通过 | 全量 Vitest，包含实际 Chat 组件的 jsdom 交互测试；SDK/服务使用 mock |
| Xpert 后端 | 17 个选定套件、157 项通过 | 短句柄升级后的 Jest 回归，包含真实 Redis/PostgreSQL；首轮失败的两组定向修正后通过，见下文 |
| Xpert SDK | 103 项通过、4 项原有测试跳过 | 全量 Vitest，覆盖查询参数、作用域、传输和取消 |
| Cloud 宿主 | 2 个套件、9 项通过 | 引用标准化及历史消息附件回归；Angular 开发构建通过 |
| 本地端到端 | 通过下文列出的真实链路 | API + Cloud、登录账号、现有模型、浏览器及持久化工具调用记录 |
| 类型与构建 | 通过 | server-ai 与 UI TypeScript；SDK 构建 |
| 变更格式 | 通过 | 三个修改仓库的 `git diff --check` |

后端最初 141 项包含 PostgreSQL 的 11 项；短句柄升级后为 157 项，另包含 Redis 的 2 项，不重复累计。共享类型构建和 UI 的 ESM/CJS/声明构建在此前实现阶段已通过；本轮没有修改 UI 产品代码。全平台所有后端套件未运行。

## 覆盖维度

| 维度 | 已验证场景 |
| --- | --- |
| 搜索与交互 | SDK 标题搜索、Assistant/Project 作用域、排除当前和已选对话、同名对话身份区分、键盘选择、中文输入法组合输入、Escape、空结果和错误恢复 |
| 异步可靠性 | 旧请求取消、迟到响应不覆盖新结果、卸载取消、SDK 在途请求 AbortError 且不重试 |
| 引用生命周期 | 原子 token、Backspace/Delete 保留相邻文字、仅引用的发送、排队 follow-up、发送失败恢复、历史引用标准化与重放、忽略伪造 DOM 标签 |
| 内容边界 | 标题按文本渲染，客户端附带正文/权限字段被剥离，工具参数严格校验，引用数量与参数上限 |
| Middleware | 无引用时隐藏 schema，当前输入或历史引用激活，后续输入重新判断，并发调用不串用输入，保留其他工具和原始模型消息 |
| 权限与受众 | 未引用 thread、伪造 conversation/thread 对、跨租户/组织、Assistant family、Project 受众、技术账号受众、调用时重新检查权限 |
| 分支与分页 | 当前可见分支、拒绝兄弟分支游标、固定 head 后新增消息不干扰旧页、切换分支/删除 head 后拒绝旧游标、软删除中间节点可跨过且不返回正文 |
| 投影与限额 | 隐藏 reasoning、未完成回答及 pending/canceled 输入；工具输出默认关闭；仅输出文本；每项字符上限、总计 60,000 字符、每消息最多 20 条输出与省略计数 |
| 大历史边界 | 1,001 条消息的单轮历史按每页最多 500 行扫描，逐页读取无重复和遗漏；这是容量边界测试，不是并发性能基准 |
| 关联回归 | Conversation ACL、ConversationThread、public principal、持久化 follow-up、human input、ToolNode、subgraph 注册、conversation search controller |

## 真实数据库测试与范围

使用独立 PostgreSQL 16 临时容器和专用 `_test` 数据库，未使用平台业务库。测试完成后已停止并删除该容器。

- `thread-reference.integration.spec.ts`：8 项，使用真实 TypeORM tree repository、closure table、原始 SQL、reader、Middleware 和 ToolNode。覆盖重载后从持久化引用激活、读取工具结果、权限撤销、分支游标攻击和异常 JSON。
- `thread-history.query.spec.ts`：3 项，使用 PostgreSQL 临时表验证 parent 链查询、分页和扫描上限。

集成夹具仅定义 reader 需要的消息字段；conversation 访问服务和 thread 定位服务使用受控替身。已有 ACL/public-principal 单元套件单独回归。因此此处证明的是数据库/ORM/工具执行路径，不是经过真实登录、HTTP guard 和完整 Nest 应用的端到端验收。

## 测试发现并修复的问题

1. **分支游标校验失效**：TypeORM `createAncestorsQueryBuilder` 已用 `:id` 绑定后代节点；额外查询又把该参数覆写为祖先节点，导致伪造兄弟分支游标可通过检查。改为独立 `:ancestorId` 参数，并加入伪造 head、伪造 next 两个真实数据库回归用例。
2. **历史 references 格式异常导致运行失败**：历史 JSON 是对象而非数组时，`jsonb_array_elements` 抛错。查询现在先检查 `jsonb_typeof`，非数组按空引用处理；集成测试验证不会影响无关 Agent 调用。
3. **普通引用被误计入 thread 上限**：101 条 quote 引用也会触发 thread 引用超限。现在仅统计有效 thread 引用，同时保留真实 thread 数量限制及字段标准化。
4. **非输出事件消耗工具输出配额**：先截取前 20 个事件会漏掉后续有效输出。现在从全部事件中选择最多 20 条文本输出，正确报告不支持或超额的输出数量。
5. **Cloud 宿主遗漏 thread 引用类型**：启动实际 Cloud 时，`apps/cloud/src/app/@shared/chat/references.ts` 对新增联合类型编译失败，导航及历史标准化也会丢弃 thread 引用。补齐标准化、按 conversation/thread 身份去重、标签和来源处理；新增 3 项引用测试，与已有附件处理测试合计 9 项通过。

另修正 `human-input.spec.ts` 两处原有文案断言，使其符合既有实现；未修改产品提示词。首次最终 UI 回归曾与 SDK 构建并行，SDK 的清理阶段短暂删除链接目录中的 `dist`，导致 5 个套件加载失败。按依赖顺序完成 SDK 构建后重跑 UI，全量 987 项通过；该失败不是产品行为缺陷。

## 复现命令

### 短句柄升级补充验收

`nextCursor` 已从约 207 字符的编码 JSON 改为 19 字符随机句柄。Redis 只保存分页状态与绑定上下文，TTL 为 30 分钟，不保存消息正文或授权结论。每次读取仍重新检查引用白名单、访问权限及分支；调用者或源/目标会话发生变化时，句柄不能复用。旧长游标不兼容，需要不传 `cursor` 重新读取。

- 新增 store 单元测试 13 项：跨服务实例读取、可重试但不续期、租户/组织/用户/目标会话/目标分支/源会话/源分支隔离、过期、格式异常、旧游标、缺失缓存、碰撞重试、Redis 故障。
- 新增真实 Redis 测试 2 项：两个独立连接读取同一句柄、验证 TTL、实际过期拒绝，以及 12 个并发生成句柄的上下文隔离。该并发用例只验证正确性，不是吞吐量基准。
- reader 增加 1 项测试，确认带有效句柄也会先重新检查源访问权限；原有 PostgreSQL 11 项和关联运行时回归继续通过。
- 17 个套件首轮为 154 通过、3 失败：一个测试样例误写了 17 位随机部分；临时 Redis 未配置认证，protected mode 阻止宿主连接，影响两个用例。修正样例、为临时 Redis 配置认证并保留 protected mode 后，定向重跑两组共 18 项全部通过；最终 157 项均已有通过记录。产品代码在这次定向重跑前后未改变。
- server-ai TypeScript 检查通过。本次未修改 UI/SDK 产品代码，未重复运行其全量测试。
- 本地 API 已加载新实现。真实 `qwen3.6-plus` 模型以 `turnLimit=1` 连续调用三次 `read_thread`，两次原样传回 19 字符句柄，末页 `hasMore=false`，正确返回最早识别码及最新数量 49。

测试使用专用临时 PostgreSQL 与 Redis 容器，完成后均已停止删除。运行证据保存在受保护的本地目录中：`short-cursor-tests.log`、`short-cursor-retry-tests.log`、`short-cursor-e2e-run.json` 与 `short-cursor-e2e-result.json`。

复现新增 Redis 用例时，把 `THREAD_REFERENCE_TEST_REDIS_URL` 设置为可用于测试的 Redis URL（凭据通过环境注入，不写入命令或源码），运行：

```sh
corepack pnpm exec jest --config packages/server-ai/jest.config.ts --runInBand \
  packages/server-ai/src/chat-conversation/thread-cursor.store.spec.ts \
  packages/server-ai/src/chat-conversation/thread-cursor.store.integration.spec.ts
```

### 原功能测试命令

先在 `xpert-sdk-js/packages/core` 运行 SDK 测试和构建，再运行依赖它的 UI 测试：

```sh
corepack pnpm exec vitest run
corepack pnpm run build
```

在 `chatkit-js/packages/chatkit-ui`：

```sh
corepack pnpm exec vitest run
corepack pnpm exec tsc --noEmit
```

在 `xpert`，将 `THREAD_REFERENCE_TEST_DATABASE_URL` 设置为专用、可丢弃且名称以 `_test` 结尾的 PostgreSQL 数据库连接字符串。下面命令对应本轮 15 个套件；未设置该变量时，11 个数据库用例会跳过：

```sh
corepack pnpm exec jest --config packages/server-ai/jest.config.ts --runInBand \
  packages/server-ai/src/chat-conversation/conversation.service.spec.ts \
  packages/server-ai/src/chat-conversation/conversation-thread.service.spec.ts \
  packages/server-ai/src/ai/public-xpert-principal.spec.ts \
  packages/server-ai/src/shared/agent/persisted-follow-up.spec.ts \
  packages/server-ai/src/shared/agent/human-input.spec.ts \
  packages/server-ai/src/xpert-agent/commands/handlers/tool_node.spec.ts \
  packages/server-ai/src/xpert-agent/commands/handlers/subgraph.handler.spec.ts \
  packages/server-ai/src/ai/conversation.controller.spec.ts \
  packages/server-ai/src/chat-conversation/thread-reference.integration.spec.ts \
  packages/server-ai/src/chat-conversation/thread-reference.contract.spec.ts \
  packages/server-ai/src/chat-conversation/thread-reference.service.spec.ts \
  packages/server-ai/src/chat-conversation/thread-read-projection.spec.ts \
  packages/server-ai/src/chat-conversation/thread-history.query.spec.ts \
  packages/server-ai/src/xpert-middleware/thread-reference.middleware.spec.ts \
  packages/server-ai/src/xpert-middleware/thread-reference.runtime.spec.ts
corepack pnpm exec tsc --project packages/server-ai/tsconfig.lib.json --noEmit --incremental false
```

本地使用源码构建的 ChatKit types 和 SDK 链接包。npm 尚未发布，正式依赖/锁文件升级仍按实现文档的协调发布步骤执行；上述结果不代表使用当前已发布 npm 版本的干净安装已经通过。

## 本地 API/Cloud 端到端验收

2026-09-23，用户授权复用现有 PostgreSQL/Redis，并完成 Cloud 浏览器登录后，补充了以下真实验收。API 和 Cloud 均从 `xpert` 源码运行，进程 cwd 已核实；未修改 `xpert-pro` 源码、已有 Assistant 配置或模型配置。

- API：`http://localhost:3000`，`/api/health/ready` 返回 200。
- Cloud：`http://localhost:4200`，页面及 ChatKit JS/CSS 返回 200。`/chatkit/index.html` 与本次构建一致，iframe 使用同源 `/chatkit`。
- 仅在启动进程中覆盖端口、API 地址、`VITE_CHATKIT_FRAME_URL=/chatkit` 和 `DB_SCHEMA_SYNC_MODE=external`；没有修改 `.env`，没有执行 schema 同步。测试通过正常 API 创建了专用验收会话。
- API 脚本通过平台 CLI 的 Keychain 登录及组织请求头访问；浏览器由用户登录。没有读取浏览器凭据。
- 使用现有、不依赖沙盒的 `Plugin Quickstart Acceptance` Assistant 和 `qwen3.6-plus` 模型；没有更改其定义。

| 真实场景 | 结果与证据 |
| --- | --- |
| 无引用基线 | 源会话连续完成两轮记录，模型成功返回；工具 schema 的无引用隐藏行为另由 Middleware 测试验证 |
| 标题搜索 | SDK 小写查询匹配含大写标记的标题；浏览器输入 `@` 加标题关键词显示对应会话 |
| 选择并发送 | 点击搜索结果生成引用 chip，发送后后台保存结构化 conversation/thread 定位信息，消息及任务摘要展示来源 |
| 按页读取 | 强制 `turnLimit=1`，模型实际连续调用两次 `read_thread`；第一页 `hasMore=true`，第二次使用 `nextCursor`，最终读取到两轮事实并正确回答 |
| 客户端伪造正文 | 请求附带伪造 transcript；持久化引用中该字段被剥离，模型回答来自源历史而非伪造正文 |
| 浏览器真实模型链路 | 从搜索、选择、发送到回答全部完成；后台存在成功的 `ThreadReferenceMiddleware/read_thread` 工具组件记录 |
| 刷新与历史激活 | 刷新目标页面后原引用及来源仍显示；下一轮不再添加引用，后台 human message 的 references 为空，Agent 仍成功调用 `read_thread` |
| 源历史实时更新 | 源会话新增一轮把数量从 37 更新为 49；目标无新引用的追问返回 49，工具输出包含新增源消息，证明不是复用旧回答 |
| 跨组织访问 | 同一真实账号切换到另一个获准访问的组织范围，读取源会话返回 403；未绕过授权 |
| 伪造定位配对 | 引用中的 conversation 与 thread 不匹配时，真实工具调用以 `fail` 拒绝，模型报告不可用，没有披露源事实 |

两次分页工具调用在本次本地记录中耗时约 26/28 ms，仅为单次观测，不代表并发性能基准。浏览器桌面截图检查通过，文件入口仍可见。

运行回执、测试脚本和原始调用记录保存在工作区下受保护的 `.xpert-local-environment/thread-reference-20260923/`，未提交到仓库；其中包含环境专属标识。API 和 Cloud 保持运行，验收页面及源会话保留供继续检查。

### 环境限制和剩余验收

- 原 Claw 测试入口在模型调用前因缺少 `docker-sandbox` 的 `SANDBOX_WORKSPACE_MAPPER` 失败。上述成功链路使用了现有不依赖沙盒的 Assistant，因此不能据此宣称 Claw 的整个沙盒环境已正常。
- 启动日志仍有现有 Lark 插件 SDK 导出不兼容、旧调度配置缺少 OIDC 字段的问题；未在本功能范围内修复。API readiness 和上述链路均已通过。
- 尚未使用两个不同用户账号做真实隔离测试；权限撤销、Project/技术账号受众、兄弟分支攻击已由单元/数据库集成测试覆盖，未全部复测于真实登录环境。
- 窄屏、深色主题、真实流式排队/插入消息、高并发基准和发布包的干净安装仍未执行。发布仍需协调 types/SDK/UI 版本；本地通过依赖源码链接运行，不等同于 npm 发布完成。

## SDK 0.4.1 升级与 ChatKit 审核（2026-09-23）

- ChatKit UI 的 SDK 依赖更新为 `^0.4.1`，锁文件解析到 npm 发布的 `0.4.1` 及其实际 integrity；其他依赖的锁定版本保持不变。
- `pnpm install --frozen-lockfile` 通过，实际 SDK 路径位于 pnpm 的 `0.4.1` 包目录，已不使用兄弟仓库源码链接。
- 直接调用发布包验证：标题与 Assistant/Project 范围正确传递，取消中的搜索抛出 `AbortError`，且不重试。
- UI 全量回归通过：102 个文件、998 项测试；UI 类型检查、共享类型构建、UI ESM/CJS 与声明构建、生产 app 构建通过。保留现有 API Extractor TypeScript 版本提示、CJS `import.meta` 和大 bundle 警告。
- 审核覆盖引用规范化、输入法与原子 chip、搜索取消与过期结果、提交/恢复/历史消息，以及 Skills 去重、来源归属与弹层交互。
- 新构建的哈希资源最初未被 Cloud 开发服务发现；仅重启本次 Cloud 后，`/chatkit/index.html` 与新构建一致，JavaScript/CSS 均返回 HTTP 200。API 和数据库进程未重启。

### 已修复：P2 — 引用移除按钮的 Enter 会误发送

`ComposerThreadToken.tsx` 的移除按钮处于 composer 的 contenteditable 内，
只处理了鼠标按下和 click，未隔离键盘事件。选中一个引用后，把焦点移到该
按钮并按 Enter，事件会冒泡到 `Chat.handleComposerKeyDown`，被当作发送快捷键
执行 `submitDraft`，而不是移除引用。即使只有引用、没有正文，也会发送。

临时针对性测试在实际 Chat 组件中复现：对移除按钮触发 Enter 后，断言
`stream.submit` 未被调用失败，实际调用一次。该诊断测试未保留在默认测试集中，
原始输出保存在受保护的本地运行回执中；上面的 998 项通过不包含这个新增失败场景。
后续修复在 `Chat.handleComposerKeyDown` 入口忽略来自子按钮的事件，保留按钮原生
Enter/Space 激活行为，避免把移除操作当作发送、补全或光标快捷键处理。
已将 Enter/Space 回归测试加入正式测试集，验证不取消按钮默认行为、不调用
`stream.submit`、移除引用且保留相邻草稿。修复前 Enter 用例失败，修复后 UI 全量
102 个文件、1000 项测试通过，UI 类型检查通过。
修复后的库与 app 构建通过；浏览器真实 Enter/Space 操作均只移除引用、保留草稿，
消息数量未变化。验收结束后已清空测试草稿。
