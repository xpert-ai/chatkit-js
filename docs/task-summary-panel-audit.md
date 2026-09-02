# 任务摘要右侧面板：区块与内容完整性审计

> 初始审计日期：2026-09-01；审计范围：`chatkit-js`、`xpert-sdk-js`、`xpert-develop`、`xpert-plugins`。2026-09-02 起本文同时记录实施状态；下方“本轮实施状态”优先于初始审计快照。

## 本轮实施状态（2026-09-02）

本轮不调整六个区块的名称、顺序或分组，只纠正区块里进入了什么内容，以及已有内容能否看全。

仓库边界：

- `xpert-plugins`：零修改，不迁移任何插件 producer。
- `xpert-sdk-js`：零修改，不增加公共类型或 API。
- `xpert-develop`：只改服务端 Task Summary 提取与聚合，不修改 `plugin-sdk`。
- `chatkit-js`：改实时聚合、历史合并和区块内部展示；保留现有六区块结构。

本轮已实现：

| 内容问题                                   | 当前行为                                                                                            | 仓库                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------- |
| 非 Agent 节点混入 Agent 活动               | 历史与实时均要求 `category === 'agent'` 且存在 `parentId`                                           | `xpert-develop`、`chatkit-js` |
| Agent 历史总数被 3 条 preview 覆盖         | 合并时保留服务端 `history.agents.total`                                                             | `chatkit-js`                  |
| Pending/Running/失败或不可打开条目进入产出 | 产出只保留已完成且具有 `workspace_file`、`artifact` 或 `url` 资源的条目                             | `xpert-develop`、`chatkit-js` |
| MCP App 被误算为产出                       | 不再将 MCP App 组件投影为 Output；MCP App 仍按原消息组件展示                                        | `xpert-develop`、`chatkit-js` |
| 仅被配置的 skill/plugin 被宣称为来源       | 实时 Sources 不再从 capability selection 生成 skill/plugin 来源；显式、可追溯 contribution 不受影响 | `chatkit-js`                  |
| Todo、Running 第 4 条以后不可见            | 默认仍预览 3 条，但可在当前区块内“查看全部/收起”，不增加新 API                                      | `chatkit-js`                  |
| description 覆盖 status                    | status 与 description 分行同时显示                                                                  | `chatkit-js`                  |
| Agent 失败原因不显示                       | Agent 行显示状态、耗时和精简错误                                                                    | `chatkit-js`                  |
| 长标题或描述被裁剪后无完整入口             | 行仍保持紧凑，悬停 tooltip 可查看完整标题、状态和描述                                               | `chatkit-js`                  |
| 原始英文状态难读                           | 为 Goal、Todo、Output、Running、Agent 常用状态补中英文显示                                          | `chatkit-js`                  |

本轮明确延期：

- 插件统一产出 envelope、Plugin SDK builder 和代表插件迁移。
- `ThreadGoal.goalSpec`、Pending detail、section/page 类型关联等 SDK 契约增强。
- Pending 置顶、Task 改名、Running 与 Agent Activity 合并等区块结构调整。
- 当前生产者完全没有输出可打开资源的条目；读取端不会凭文本路径或任意 URL 猜测产物。

## 结论

右侧面板需要调整，但应先调整 ChatKit 的信息层级、命名和呈现方式，不应为了 UI 分组直接合并或重命名后端的 task-summary API 区块。

当前界面有六个同级区块：

1. 产出（Outputs）
2. 来源（Sources）
3. 任务（Task）
4. 运行中（Running）
5. Agent 活动（Agent activity）
6. 待处理（Pending）

按“摘要视图能否展示已识别条目”判断，产出、来源和待处理已经有首屏与分页链路；按“对应业务内容是否端到端完整”判断，六个区块都存在缺口。

推荐展示结构：

```text
需要你处理（有内容时置顶）
任务进度
产出
执行动态
  ├─ Agent / 节点执行
  └─ 运行服务
参考来源
```

推荐固定顺序为：

```text
待处理 → 任务进度 → 产出 → 执行动态 → 参考来源
```

原因：

- “待处理”要求用户立即行动，不应继续放在最底部。
- “任务”应表达目标、计划和 Todo 的整体进度，名称应改为“任务进度”。
- “产出”是用户最关心的结果，应高于内部执行细节。
- “运行中”和“Agent 活动”都属于执行动态，可以合并为一个视觉容器，但底层仍应保留两种数据源。
- “来源”初始实现混入了已选择的技能/插件；本轮已停止从 capability selection 生成来源，只保留显式、可追溯来源。

## 数据链与仓库责任

```text
xpert-plugins
  生产工具结果、文件、Artifact 和 App payload
       ↓
xpert-develop
  提取并持久化 message.taskSummary，聚合历史 snapshot/page
       ↓
xpert-sdk-js
  暴露 task-summary 与 sandbox services API/TypeScript 类型
       ↓
chatkit-js
  合并历史与实时数据，生成右侧面板并发出资源打开事件
       ↓
xpert-develop / ClawXpert host
  打开 workspace file、Artifact、浏览器服务或 URL
```

### 完整性判断口径

| 层次       | 判断问题                                       | 当前主要责任仓库                |
| ---------- | ---------------------------------------------- | ------------------------------- |
| 生产完整性 | 插件是否把真实产物、来源和任务状态放进统一结构 | `xpert-plugins`                 |
| 契约完整性 | API/SDK 是否声明了 UI 所需字段                 | `xpert-develop`、`xpert-sdk-js` |
| 聚合完整性 | 历史、实时、去重、total 和分页是否正确         | `xpert-develop`、`chatkit-js`   |
| 展示完整性 | 已经存在的数据是否被裁剪、覆盖或隐藏           | `chatkit-js`                    |
| 动作完整性 | 点击条目后是否能定位消息或打开资源             | `chatkit-js`、ClawXpert host    |

## 当前区块总表

| 当前区块   | 当前实际展示                                    | 数量与展开                                           | 端到端结论                                     |
| ---------- | ----------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| 任务       | Goal、Plan、Todo                                | Goal/Plan 各一条；Todo 预览 3 条，可展开当前完整列表 | Goal richer 字段仍未展示                       |
| 产出       | 已完成、可打开产出的标题、状态和描述            | 首屏 3 条；支持分页，每页最多 50 条                  | 已识别条目可翻页，但 producer 覆盖仍不完整     |
| 来源       | 显式来源、引用、附件、知识库                    | 首屏 3 条；支持分页，每页最多 50 条                  | 不再把仅配置的能力当来源；调用证据契约仍待完善 |
| 运行中     | 当前 active sandbox services                    | 预览 3 条，可展开当前完整列表                        | richer service 详情仍未展示                    |
| Agent 活动 | 真实子 Agent execution 按 `agentKey` 的最新状态 | 支持分页并保留服务端历史 total                       | Root 与同 Agent 历史仍按既定口径折叠           |
| 待处理     | 审批、用户输入、排队 follow-up/steer            | 首屏 3 条；支持分页                                  | 列表可翻页，但契约缺少完整问题与审批上下文     |

当前 UI 的固定顺序和各区块渲染位于：

- `packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:220-374`
- 现有测试还把这六个区块及其顺序固定为断言：`packages/chatkit-ui/src/components/task-summary/TaskSummary.test.tsx:7-36`

## 各区块内容完整性

### 1. 任务

#### 当前显示

- Goal：`objective`、`status`
- Plan：`title`、`excerpt`
- Todo：前 3 个 `content`、`status`，可展开当前完整列表

#### 数据已有但没有显示

- Goal 的 `tokensUsed`
- Goal 的 `elapsedSeconds`
- Goal 的 `continuationCount`
- Goal 的状态、完成和阻塞时间
- Goal 的 `goalSpec`：可执行目标、成功标准、约束、验证清单、推荐策略
- Todo 组的 `title`

#### 数据源自身限制

- Plan/Todo 都优先接受显式 `message.taskSummary`、`data.taskSummary` 或 `_meta['xpertai/taskSummary']` 中的 canonical contribution。
- 没有显式 contribution 时，Plan 的启发式 fallback 只识别 `<proposed_plan>`，并在服务端压缩成最多 160 字摘要。
- 没有显式 contribution 时，Todo 的启发式 fallback 只识别 `write_todos`；聚合结果仍只保留最新一组。
- `xpert-sdk-js` 的 `ThreadGoal` 类型漏了 `goalSpec`；运行时 JSON 不会删除它，但 TypeScript 无法安全访问。

#### 第一丢失边界

- Goal 指标和 Todo 标题：ChatKit 展示层。
- `goalSpec` 类型：`xpert-sdk-js` 契约层。
- Plan/Todo 的生产范围：`xpert-develop` 提取层。

#### 关键证据

- `packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:270-311`
- `packages/chatkit/src/message.ts:678-702`
- `xpert-sdk-js: packages/core/src/schema.ts:1282-1296`
- `xpert-develop: packages/server-ai/src/chat-message/task-summary.ts:193-253`

### 2. 产出

#### 当前可进入列表的内容

- 显式 `taskSummary.outputs`
- `image_url`
- `iframe`
- 部分 `artifact`、`artifactLink`、`file`
- 部分结构化工具输出

进入列表前还要求条目已经完成，并带有可打开的 `workspace_file`、`artifact` 或 `url` resource。MCP App 仍按消息组件展示，不再被当成产出。

每个标准条目契约可以包含：

- `id`
- `kind`
- `title`
- `description`
- `status`
- `resource`
- `messageId`
- `updatedAt`

#### 当前显示不完整

- UI 只使用统一的文件图标，不区分文件、图片、文档、表格、演示文稿、站点和 URL。
- `status` 与 `description` 已分行同时显示。
- `updatedAt` 不显示。
- 契约没有 MIME、大小、作者、版本等丰富信息；如果需要，应进入详情视图而不是继续扩张列表行。

#### 生产覆盖不完整

`xpert-plugins` 当前工作区和本地 `origin/main` 均没有正式的 `taskSummary` 或 `xpertai/taskSummary` 生产者。插件产出主要依赖 `xpert-develop` 对不同 JSON shape 的启发式提取。

当前相对稳定的形状是：

- 顶层 `artifact` / `artifactLink` / `file`
- 顶层 `artifactId`
- `content_and_artifact` 返回中的 `files[]`
- `data.output` 中的对象或 JSON 字符串，并且产物位于 payload 本身、`payload.artifact` 或 `payload.file`

以下形状不会被通用提取器递归识别：

- `payload.share`
- `payload.export`
- `payload.candidate`
- `structuredContent`
- 仅有 `shareUrl`、`exportUrl` 或普通文本路径
- array/tuple 中的 `{ files: [...] }`

#### 第一丢失边界

- 真实产物未进入统一 envelope：`xpert-plugins` 生产层。
- 后端已识别但实时视图未识别的 richer artifact shape：ChatKit 实时聚合层。
- kind、时间已经存在但未显示：ChatKit 展示层；status 已显示。

#### 关键证据

- UI：`packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:220-246`
- ChatKit 实时提取：`packages/chatkit-ui/src/lib/task-summary.ts:395-505`
- Develop richer 提取：`xpert-develop: packages/server-ai/src/chat-message/task-summary.ts:445-695`
- SDK 输出契约：`xpert-sdk-js: packages/core/src/schema.ts:1310-1327`

### 3. 来源

#### 当前可进入列表的内容

- 显式 `taskSummary.sources`
- ChatKit message references：code、quote、image、web element、file element
- message attachments / file assets
- `xpert://knowledgebase/chunk` 引用
- 显式 `taskSummary.sources` 中可追溯的 skill/plugin contribution

#### 当前显示或语义不完整

- Capability selection 不再直接生成来源；当前仍缺少 connector/skill/plugin 的实际 invocation 证据契约。
- 显式 skill/plugin contribution 的标题仍取生产者给出的值，未统一做名称解析。
- `kind` 和 `updatedAt` 已经存在，但 UI 不显示。
- 普通网页 URL 不会自动成为来源，除非它形成 reference 或显式 contribution。
- `sub_agent` 来源在服务端被过滤，改由 Agent 活动表达。

#### 推荐语义

- “参考来源”只保留真实引用、附件、知识库和可追溯网页/文件。
- 已选择但未确认调用的 skills/plugins 不应标成“来源”；可以放入“启用能力”，或暂不展示。
- 如果未来展示“已用能力”，需要以实际 invocation 记录为依据，并补齐 connector 覆盖。

#### 第一丢失边界

- Connector 和能力使用证据：Develop/契约层。
- 名称解析、kind 和时间：ChatKit 展示层。
- “选择即来源”的语义偏差已在 ChatKit 实时聚合层修正；历史显式 contribution 仍按生产者事实保留。

#### 关键证据

- `packages/chatkit-ui/src/lib/task-summary.ts:507-620`
- `packages/chatkit/src/message.ts:413-434`
- `xpert-develop: packages/server-ai/src/chat-message/task-summary.ts:698-835`
- `xpert-develop: packages/server-ai/src/chat-conversation/task-summary.service.ts:142-146`

### 4. 运行中

#### 当前显示

- service name
- active status：`starting`、`running`、`stopping`
- 实际或请求端口
- browser resource，可打开服务预览

#### 数据源

“运行中”不属于 task-summary snapshot/page API。ChatKit 使用独立的 sandbox services API：

- 切换到 thread 时主动 hydrate。
- 收到 service start/list/stop 工具事件时强制刷新。
- transitioning 状态每 2 秒轮询。
- running 状态每 20 秒轮询。
- UI 前只保留 active services。

因此当前数据源是权威 services API，不是从历史工具消息静态猜测。

#### 当前显示不完整

- 默认显示前 3 个 service，可在区块内展开当前完整列表。
- 端口 description 与 status 已分行同时显示。
- SDK/服务端已有的 command、cwd、owner、开始/停止时间、exit code 等不显示；错误信息只可能位于服务端 `metadata.error`，SDK 目前把 `metadata` 声明为 `unknown`。
- service API 加载失败或刷新状态没有在任务摘要区块内呈现。

#### 第一丢失边界

- richer service 信息：ChatKit 视图模型与展示层。

#### 关键证据

- `packages/chatkit-ui/src/components/chat.tsx:1526-1552`
- `packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:314-334`
- `packages/chatkit-ui/src/providers/runtime-activities.ts:156-285`
- `packages/chatkit-ui/src/providers/runtime-activities.ts:376-499`
- `packages/chatkit-ui/src/lib/runtime-activity.ts:17-24`
- `xpert-sdk-js: packages/core/src/schema.ts:1126-1183`

### 5. Agent 活动

#### 当前服务端语义

```text
查询 thread 下的 execution
→ 仅保留 category=agent 且 parentId 非空的子 execution
→ 按 agentKey（缺失时按 id）折叠
→ 每个 key 只保留最新一次
→ 按更新时间倒序
```

当前并不是“全部 Agent 活动”或“全部执行历史”。

#### 当前显示

- title
- status
- elapsed time
- 精简错误原因（存在时）
- 点击后定位对应 message；没有 message 时聚焦 composer

#### 当前数据和显示问题

- Root/primary execution 被明确排除。
- 同一 `agentKey` 的历史运行只保留最新一次。
- `level`、`updatedAt` 不显示。
- 服务端 snapshot 的真实 total 已在 ChatKit 合并时保留，历史超过 3 个 Agent 时可继续加载。

#### 第一丢失边界

- Root 和历史折叠：当前服务端产品语义；需要先确认预期再改。
- level、时间不显示：ChatKit 展示层；error 已显示。

#### 关键证据

- 服务端收集：`xpert-develop: packages/server-ai/src/chat-conversation/task-summary.service.ts:147-173`
- 服务端折叠：`xpert-develop: packages/server-ai/src/chat-conversation/task-summary.service.ts:287-298`
- ChatKit 实时收集：`packages/chatkit-ui/src/lib/task-summary.ts:647-668`
- ChatKit total 缺陷：`packages/chatkit-ui/src/lib/task-summary.ts:710-761`
- UI：`packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:336-355`

### 6. 待处理

#### 当前来源

- conversation operation tasks
- pending follow-up / steer messages
- interrupted conversation fallback
- 实时 `request_user_input`
- 实时 HITL approval

#### 当前契约与显示

- 条目契约包含 `kind`、`title`、可选 `description`、可选 `messageId` 和可选 `createdAt`。
- UI 实际只显示 `title` 和可选 `description`。
- `kind` 与 `createdAt` 不显示；`messageId` 仅用于点击后定位消息。

#### 契约与显示不完整

- Pending 契约没有 approval payload、tool/operation 参数、agent 信息、问题数组和选项。
- 服务端 operation 只投影 task 的 title/description 或通用标题。
- 排队 follow-up 不显示消息正文，只显示通用标题。
- ChatKit 实时 `request_user_input` 只把第一道问题的 `header` 放入列表，不包含 `question` 和 `options`。
- 完整 request-user-input 交互仍存在于 composer 面板；右侧目前只是一个非常薄的入口。

#### 第一丢失边界

- 历史问题、选项和审批上下文：Develop/SDK 契约层。
- 实时问题摘要：ChatKit `chat.tsx` 适配层。
- created time 和 kind：ChatKit 展示层。

#### 关键证据

- `packages/chatkit/src/interrupt.ts:15-29`
- `packages/chatkit-ui/src/components/chat.tsx:1482-1519`
- `packages/chatkit-ui/src/components/composer/request-user-input-panel.tsx:487-675`
- `xpert-develop: packages/server-ai/src/chat-conversation/task-summary.service.ts:218-271`
- `xpert-sdk-js: packages/core/src/schema.ts:1395-1402`

## 全区块共有的显示缺口

`SummaryButton` 仍对所有区块使用紧凑文本裁剪：

- 标题：单行 `truncate`
- 描述：最多两行 `line-clamp-2`
- 有完整标题、状态和描述 tooltip
- 没有行内展开
- 没有详情按钮

因此列表行保持紧凑，但长任务、长文件名、来源描述和错误信息可通过 tooltip 看全。

证据：`packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:414-455`。

另外：

- “查看全部”虽然传入 total，但中英文翻译都是固定文案，没有展示数量。
- Todo 和 Running 使用本地展开，不调用不存在的远端分页 API。
- Output、Running 同时显示 status 与 description。
- Goal、Output、Agent、Running 常用状态已补中英文翻译；未知状态保留原值。

## Plugins 产出覆盖矩阵

以下矩阵按 `xpert-plugins` 当前工作区的实际 payload 与 Develop 当前提取规则对照。它只判断“能否进入产出列表”，不表示任务、Todo 或来源完整。

| App                 | 当前覆盖       | 原因与证据                                                                                                                                                                                                  |
| ------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Office CLI          | 较完整         | create/edit/restore/get-file/apply-design 使用 `content_and_artifact + files[]`；`xpertai/apps/office-cli/src/lib/office-cli.middleware.ts:142-315`                                                         |
| Sites               | 可识别         | deploy/create-and-deploy/publish 返回顶层 `artifactId`；`xpertai/apps/sites/src/lib/sites.middleware.ts:191`                                                                                                |
| draw.io             | 可识别         | publish 返回顶层 Artifact IDs，Develop 还有工具名特判；`xpertai/apps/drawio/src/lib/drawio.middleware.ts:252`                                                                                               |
| Lucidchart          | 可识别         | publish 返回顶层 `artifactId/artifactLinkId`；`xpertai/apps/lucidchart/src/lib/lucidchart.middleware.ts:224`                                                                                                |
| Office Editor       | 部分           | Excel edit/restore/get-file 有标准 files；document/presentation create/read/queue edit 只返回普通 JSON；`xpertai/apps/office-editor/src/lib/office-editor.middleware.ts:228`                                |
| Presentation Studio | 部分           | theme preview/export 有 files；`presentation_share_html` 只返回 `shareUrl`；`xpertai/apps/presentation-studio/src/lib/presentation-studio.middleware.ts:195-278`                                            |
| Docx Editor         | 部分           | publish 返回顶层 `artifactId`；import 的路径位于 `importedFile` 内；`xpertai/apps/docx-editor/src/lib/docx-editor.middleware.ts:288`                                                                        |
| Cut                 | 很少部分       | 字幕导出有顶层 file；普通 export 使用嵌套 `fileReference`，native MCP 使用 `structuredContent`；`xpertai/apps/cut/src/lib/cut.middleware.ts:862`、`xpertai/apps/cut/src/lib/cut-native-capabilities.ts:249` |
| Canvas              | 漏             | Artifact IDs 位于 `payload.share`；`xpertai/apps/canvas/src/lib/canvas-artifact-export.service.ts:521`                                                                                                      |
| Pencil              | 漏             | 文件位于 `payload.export.workspacePath`，publish 只返回 `shareUrl`；`xpertai/apps/pencil/src/lib/pencil-agent-response.ts:15`                                                                               |
| Motion              | 漏             | 返回 `exportPath/exportUrl`，不是 canonical file/artifact shape；`xpertai/apps/motion/src/lib/motion-agent-response.ts:125`                                                                                 |
| Story Studio        | 漏且可能误识别 | 文件位于 `payload.candidate.workspacePath`；顶层业务 `id` 可能被当成 Artifact ID；`xpertai/apps/story-studio/src/lib/story-generated-media.service.ts:187-220`                                              |
| Excalidraw          | 漏             | preview 返回 array/tuple `{files}` 且没有标准 response format；publish 只返回 `shareUrl`；`xpertai/apps/excalidraw/src/lib/diagram-engine/diagram.middleware.ts:171-188`                                    |

补充结论：

- 当前正式 Apps 中没有 MCP App producer；只有 `xpertai/examples/echarts-mcp-app` 示例。
- Story Studio 内部的 `StoryVideoTaskSummary` 是视频任务 DTO，不是 ChatKit task-summary contract。
- Kling、SiliconFlow、Veo、Volcengine、Zhipu 等模型生成工具，以及 zip/unzip/pdfium，普遍采用 `content_and_artifact + files[]`，当前识别相对稳定。
- 不应继续在 Develop 中按具体工具名堆叠提取特判；应统一 producer contract。

## SDK 与 API 契约结论

### 当前已支持

- `GET /conversations/:conversationId/task-summary`
- `GET /conversations/:conversationId/task-summary/:section`
- 分页 section：`outputs | sources | agents | pending`
- snapshot：`task + 四个 preview list`
- page：`section + items + total + offset + limit`

SDK 使用通用 JSON 解析并断言返回类型，不会主动删除服务端的额外字段。因此大多数“字段已有但没有显示”的问题不在 SDK transport。

### 明确契约缺口

1. `ThreadGoal` 缺 `goalSpec`。
2. Pending 没有问题、选项、审批 payload 和操作信息。
3. Section page 把四类 item 定义为无关联 union，没有把 section discriminator 与 item 类型绑定，ChatKit 装载分页时因此需要强制断言。
4. Running 来自独立 sandbox services API，不是 task-summary section。

证据：

- `xpert-sdk-js: packages/core/src/client.ts:3054-3078`
- `xpert-sdk-js: packages/core/src/schema.ts:1282-1443`
- `packages/chatkit-ui/src/hooks/useTaskSummary.ts:105-149`

## 历史与实时一致性

### 服务端历史摘要

- snapshot 对 outputs/sources/agents/pending 各返回前 3 条和真实 total。
- section page 默认 3 条，最大 50 条。
- 每次分页都会重新全量聚合再 slice，不是数据库游标分页。
- 对 `taskSummary IS NULL` 的历史消息，GET summary 会按每批 100 条循环回填；这是读接口上的写操作，且没有总量上限。
- 对已经存在 version 1 taskSummary 的消息，聚合阶段只会重新提取并补充 outputs，不会补 sources/plan/todos。

### ChatKit 实时摘要

ChatKit 自己维护了一套实时提取器。它与 Develop 逻辑不完全一致：

- Develop 识别 `artifact.files`、`filePath`、MIME/扩展名、structured `data.output` 和知识库 markdown 链接。
- ChatKit 实时提取没有覆盖上述全部形状。

结果是：同一条消息可能在运行过程中不出现在右栏，刷新并读取服务端历史 snapshot 后才出现。

长期应避免两套启发式继续漂移。优先方案是让生产者发出 canonical contribution，并确保持久化后的 `message.taskSummary` 能进入实时消息状态；不推荐在前后端分别继续追加工具特判。

## 资源打开完整性

标准 resource 类型：

| 类型             | 当前处理方                                      |
| ---------------- | ----------------------------------------------- |
| `message`        | ChatKit 内部定位消息                            |
| `workspace_file` | ClawXpert host 打开文件预览                     |
| `artifact`       | ClawXpert host 请求签名链接并打开预览           |
| `browser`        | ClawXpert host 打开或复用 browser tab           |
| `url`            | ClawXpert host 打开 browser tab，仅接受 HTTP(S) |

资源 effect 契约位于：

- `packages/chatkit/src/task-summary.ts:1-27`
- `packages/chatkit-ui/src/components/chat.tsx:1630-1650`
- `xpert-develop: apps/cloud/src/app/features/chat/clawxpert/clawxpert-task-summary-effect.utils.ts:51-90`

审计最终校验时的 `xpert-develop` dirty WIP 已加入私有 workspace file 无公开 URL 时的 authenticated download fallback；本地 `origin/develop` 基线没有这条 fallback，因此不能把“私有 workspace file 均可打开”视为已发布能力。

## 已确认问题清单

| ID    | 问题                                                     | 第一责任仓库                    | 本轮状态             |
| ----- | -------------------------------------------------------- | ------------------------------- | -------------------- |
| TS-01 | 历史 Agent 超过 3 条时 total 被覆盖，无法查看全部        | `chatkit-js`                    | 已修复               |
| TS-02 | Todo 超过 3 条无法查看                                   | `chatkit-js`                    | 已修复               |
| TS-03 | Running services 超过 3 条无法查看                       | `chatkit-js`                    | 已修复               |
| TS-04 | Agent error 已存在但不显示                               | `chatkit-js`                    | 已修复               |
| TS-05 | Output/Running 的 description 覆盖 status                | `chatkit-js`                    | 已修复               |
| TS-06 | 所有标题一行、描述两行且无详情入口                       | `chatkit-js`                    | 已补完整文本 tooltip |
| TS-07 | Agent 区块混入非 Agent 子 execution                      | `xpert-develop`                 | 已修复               |
| TS-08 | Pending 缺问题、选项和审批上下文                         | `xpert-develop`、`xpert-sdk-js` | 延期                 |
| TS-09 | Plugins 没有统一 task-summary/artifact producer contract | `xpert-plugins`                 | 延期，不改插件       |
| TS-10 | ChatKit 实时提取能力落后于 Develop 历史提取              | `chatkit-js`、`xpert-develop`   | 部分收敛，仍存在     |
| TS-11 | Sources 把能力选择记录当作实际来源                       | `xpert-develop`、`chatkit-js`   | 已修复实时聚合       |
| TS-12 | SDK `ThreadGoal` 漏 `goalSpec`                           | `xpert-sdk-js`                  | 延期，不改 SDK       |
| TS-13 | SDK section/page 类型没有 discriminator-item 关联        | `xpert-sdk-js`                  | 延期，不改 SDK       |

## 推荐实施切片

### Slice A：ChatKit 展示纠正，可独立进行

1. 将 Pending 提升为条件式顶部动作区。
2. 将 Task 改为“任务进度”。
3. 将 Running 与 Agent Activity 放入“执行动态”容器，但保留两个内部数据组。
4. 保留服务端 `history.agents.total`。
5. 为 Todo 和 Running 增加展开能力。
6. 同时展示 status 与 description。
7. Agent 失败时显示 compact error。
8. 补 kind/status 的可读图标和翻译。
9. 为长标题和描述提供 tooltip 或详情展开。

该切片不要求修改公共 API，也不应把 agents 与 services 合并成一个统一分页 contract。

本轮完成 4、5、6、7、9，以及 8 中的 status 翻译；1、2、3 属于区块结构调整，按当前口径延期。kind 图标仍未调整。

### Slice B：Develop 聚合语义纠正

1. 按 execution `category/type` 区分真实 Agent 与 workflow/tool/code 节点。
2. 明确产品语义：是否继续排除 root、是否继续按 agentKey 只保留最新一次。
3. 将“参考来源”与“启用能力”分开。
4. 决定是否补充历史 version 1 summary 的 sources/plan/todos。
5. 评估将 read-path backfill 移出 GET 请求。

本轮完成 1；3 先停止把 capability selection 当作来源，真正的“已用能力”契约延期；其余保持原语义。

### Slice C：Plugins producer 统一

1. 优先使用 canonical `content_and_artifact + files[]` 或顶层 artifact/file envelope。
2. 需要丰富摘要时，生产显式 `xpertai/taskSummary` contribution。
3. 不再只返回 `shareUrl/exportUrl` 或把文件藏在任意 payload 子对象。
4. 收紧 Develop 对任意顶层 `id` 的 Artifact 推断，要求 canonical envelope 或明确 Artifact 类型证据。
5. 为代表性 App 建立 contract fixture：Office CLI、Presentation Studio、Canvas、Story Studio、Cut。

### Slice D：契约增强

1. SDK `ThreadGoal` 补 `goalSpec`。
2. Section page 改为 section 与 item 类型关联的 discriminated/generic mapping。
3. 如果右栏需要完整历史待处理详情，先在 Develop 定义 pending detail contract，再更新 SDK 和 ChatKit。

## 验收标准

后续实现至少应满足：

1. Pending 有内容时始终位于顶部，无内容时不占位。
2. Todo、Running、Outputs、Sources、Agents、Pending 的第 4 条及之后均有明确访问路径。
3. 历史 Agent 的 server total 不会被 preview 长度覆盖。
4. Agent 失败时用户能看到状态和精简错误原因。
5. Output/Running 同时显示状态与补充描述。
6. 长标题和长描述可完整查看。
7. “参考来源”不再把仅被选择但未确认使用的能力标成事实来源。
8. 代表性插件产物在实时态和刷新后的历史态保持一致。
9. 非 Agent execution 不会出现在“协作 Agent”列表。
10. `message`、`workspace_file`、`artifact`、`browser`、`url` 五种资源动作均有针对性验证。

## 审计快照与限制

### `chatkit-js`

- 分支：`main`
- HEAD：`354c40a`
- 与 `origin/main` 一致
- 工作区在审计开始时干净

### `xpert-sdk-js`

- 当前 checkout：`update/workbuddy-composer-sdk@554b8bf`
- 相对实时 `origin/main@571e77e` behind 3 / ahead 0
- task-summary 相关源码与 `origin/main` 一致
- ChatKit lock 实际使用 `@xpert-ai/xpert-sdk@0.1.0`

### `xpert-develop`

- 审计开始时 checkout：`update/xpert-workspace-data-isolation@4a0bebec42`
- 写文档期间该共享工作区被外部操作更新；最终校验时 HEAD 为 `2a2bf1d01`
- 有大量既有 staged/unstaged/untracked WIP
- 最终校验时 task-summary 服务端源码仍与本地 `origin/develop` 一致
- ClawXpert 资源打开行为包含未发布 WIP，已在本文单独标注

### `xpert-plugins`

- 当前 checkout：`update/cut-native-mcp-publication@107bdca8`
- 相对本地 `origin/main` behind 37 / ahead 0
- 有大量既有 WIP
- “正式 taskSummary producer 为 0”已同时在当前工作区和本地 `origin/main` 验证
- App payload 矩阵按当前工作区审计，发布状态需在实施前重新确认

初始审计仅使用静态源码和既有测试作为证据。2026-09-02 本轮实现完成后，已执行 ChatKit 聚合/组件聚焦测试、类型检查、lint 和正式 build，并通过临时本地桥确认 `xpert-develop:4200` 返回的 bundle 与本次 ChatKit build checksum 一致；按约定没有打开浏览器。Develop 服务端改动已通过聚焦 Jest、类型检查和 lint，未主动重启本地 API。
