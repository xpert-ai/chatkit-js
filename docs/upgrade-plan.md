# ChatKit 升级计划：原生侧边聊天与 Thread 分叉

## 背景与目标

本次升级为 ChatKit 增加“在侧边聊天中提问”能力。用户在主对话中选择一段文本后，可以从选择浮层打开 Workbench 侧聊，并将该片段作为结构化引用插入侧聊 Composer。侧聊从主对话的当前最新状态分叉，后续消息、运行状态和 Agent checkpoint 不再影响主 Thread。

目标行为：

- 选择内容仍可使用现有“引用选中内容”动作，也可以选择“在侧边聊天中提问”。
- Workbench 中的侧聊是 ChatKit 原生 React View，不使用 Remote View iframe。
- 侧聊复用生产 `Chat`、Composer、引用、流式响应、附件和 HITL 能力。
- 一条 Conversation 可以包含多个 Thread；每个 Thread 有独立的运行状态和消息分支。
- Project、Workspace、文件和沙箱环境保持 Conversation 级共享。
- 同一页面内，一个源 Thread 复用一个侧聊；刷新后再次选择会创建新的侧聊 Thread。

V1 不支持从侧聊中继续创建嵌套侧聊，也不把侧聊作为独立 Conversation 显示在主历史列表中。

## 当前落地状态

本计划的 V1 主链路已在当前工作区完成：

- ChatKit 已加入默认关闭的 `workbench.sideChat.enabled` 开关、选择浮层动作、原生 Workbench Chat View、内存 Thread 状态和引用注入。
- 同一页面会话内，同一个源 Thread 只执行一次 Copy；重复选择复用派生 Thread，关闭或切换 Workbench View 不会卸载侧聊草稿。
- 平台 `xpert` 与 `xpert-pro` 已加入 `ChatConversationThread`、Thread Head、派生消息归属、独立运行状态、checkpoint/writes/Goal 复制以及 Thread Copy/查询/删除链路。
- Conversation 默认消息查询已改为主 Thread 的 Head 祖先路径；显式传入 `threadId` 时返回对应派生路径，避免侧聊消息泄漏进主历史。
- Run、Execution、取消、Goal middleware、LangGraph checkpoint 和 Agent middleware runtime 均使用活动 Thread ID；只有主 Thread 继续镜像旧 Conversation 状态。
- 当前 SDK 已有的 `threads.copy`、`threads.get` 与 Conversation 消息搜索能力足以承载 ChatKit V1，没有在 UI 中绕过 SDK 发起原生请求。

上线前仍需由部署流程完成数据库 schema 同步/历史回填、发布兼容版本的 SDK 与 ChatKit 包，并在目标宿主中显式开启功能开关。生产级 E2E、窄屏截图和运行指标接入保留在阶段三，不作为本次代码提交中的自动化单元测试替代品。

## 当前实现基础

ChatKit 已经具备大部分文本引用能力：

- 文本选择被限制在同一条可引用消息中。
- 选择结果已经可以转换为 `ChatKitQuoteReference`。
- Composer 和持久化消息已经支持引用 Chip、引用去重和 `referenceComposition`。
- Workbench 已具备标签、可调整宽度的桌面分栏、窄屏 Sheet、展开和收起能力。

当前缺口主要在两个边界：

- Workbench 只接受 iframe `remote_component`，还不能挂载原生 Chat View。
- 平台虽然声明了 `POST /threads/{thread_id}/copy`，服务端仍未实现，而且当前 Conversation、状态和消息查询仍默认一对一绑定 Thread。

现有 `ChatMessage` 使用 closure-table Tree，并通过 `parentId` 表达父子关系；Retry 已经会产生 sibling AI Message。但当前 DTO 和 ChatKit 加载逻辑没有把这棵树作为活动分支使用，而是按创建时间展平 Conversation 下的消息。

## 架构决策

采用 `ChatConversationThread + ChatMessage Tree` 的组合模型：

- `ChatConversationThread` 是运行分支，负责 Thread 身份、状态、checkpoint、Goal、执行和生命周期。
- `ChatMessage` Tree 是内容血缘，负责共享分叉前的消息前缀以及分叉后的不同消息路径。
- Fork 时共享当前消息 Head，只复制 Agent checkpoint，不复制完整消息 transcript。

```text
Conversation
├─ Thread A
│  ├─ threadId: A
│  └─ headMessageId: M10A
│
└─ Thread B
   ├─ threadId: B
   ├─ parentThreadId: A
   ├─ forkedFromMessageId: M8
   └─ headMessageId: M10B

Message Tree
M1 → M2 → ... → M8
                    ├→ M9A → M10A
                    └→ M9B → M10B
```

该模型保留一份公共历史消息，避免每次分叉都复制 transcript，同时仍然为 LangGraph、Agent Protocol 和运行状态提供真实的 `threadId` 隔离。

### 为什么不只使用 ChatMessage Tree

Message Tree 可以表达消息分叉，但不能独立承载以下 Thread 级状态：

- LangGraph checkpoint 和 checkpoint writes
- Run、Execution、取消与恢复
- `status`、`error` 和 HITL `operation`
- Goal、预算、Task Summary 和排队 Follow-up
- Agent Protocol 的 `/threads/{thread_id}/*` 生命周期

如果只使用叶子消息代表分支，仍然需要为上述状态增加 branch ID 和 metadata，最终会隐式重建 `ChatConversationThread`。

### 与消息快照复制方案的取舍

复制全部消息的实现查询简单，但会重复存储历史、重映射消息父子 ID，并放大多级分支的存储成本。共享 Message Tree 会增加祖先路径分页、不可变历史和垃圾回收的实现成本，但更适合作为长期的多 Thread 基础模型。

如果实现阶段发现 legacy Tree 无法可靠回填，可以把“Thread + 消息快照复制”作为受控降级方案；所有复制消息必须保留 `originMessageId`，以便后续迁移回共享 Tree。该降级不是默认设计。

## 平台数据模型

新增 `ChatConversationThread`：

- `conversationId`
- `threadId`
- `parentThreadId`
- `headMessageId`
- `forkedFromMessageId`
- `status`、`error`、`operation`
- `metadata`
- 标准租户、组织、创建者和时间字段

调整现有模型：

- `ChatConversation.threadId` 暂时保留，表示主 Thread，兼容旧客户端和历史查询。
- `ChatMessage` 增加 `createdInThreadId`，表示消息首次创建在哪个 Thread；继承消息不会被错误标记为属于所有可见 Thread。
- `ChatConversationGoal` 的唯一约束从 Conversation 级调整为 `conversationId + threadId`。
- Task Summary、Follow-up、Memory Summary、HITL 和运行状态查询都必须接收活动 `threadId`。
- Conversation 继续拥有 Assistant、Project、Workspace、文件关系和共享 `sandboxEnvironmentId`。

已完成消息视为不可变事件。Retry、编辑或重新生成通过创建新的 sibling 节点并移动当前 Thread Head 实现，不原地改写被多个 Thread 共享的历史消息。流式生成中的 AI Message 可以继续更新，但处于 busy 状态的源 Thread 不允许 Fork。

## Fork 与消息加载

### Fork 流程

1. 锁定源 Thread，并确认它处于 idle 状态。
2. 读取源 Thread 当前 `headMessageId` 和最新 checkpoint。
3. 在同一 Conversation 下创建子 Thread：
   - `parentThreadId` 指向源 Thread。
   - `headMessageId` 和 `forkedFromMessageId` 都初始化为源 Thread 当前 Head。
4. 将源 Thread 的 checkpoint、checkpoint writes 和 Goal 快照复制到新的 `threadId`。
5. 不复制历史 Execution，也不复制 ChatMessage。
6. 子 Thread 以 idle 状态返回；后续第一条 Human Message 以共享 Head 为父节点，并只移动子 Thread Head。

Fork 和源 Thread 从 idle 进入 busy 必须使用同一套行锁或 compare-and-set 规则，防止 Fork 与新 Run 同时从不同状态开始。

### 消息路径

加载某个 Thread 时，根据 `headMessageId` 查询从根节点到 Head 的唯一祖先路径，然后按对话顺序分页和渲染。新消息持久化后，原子更新对应 Thread 的 Head。

- 主 Thread 后续消息不会出现在已经创建的侧聊中。
- 侧聊消息不会进入主 Thread transcript。
- Retry 创建当前 Human Message 下的新 AI sibling，并只把当前 Thread Head 移到新响应。
- 删除 Thread 时不能删除仍被其他 Thread Head 引用的共享祖先；先删除 Thread 运行资源，再通过可达性检查异步清理孤立消息。

## API 与 SDK 升级

- 实现 `POST /threads/{thread_id}/copy`，支持可选 metadata，并返回新 Thread。
- 新增 `GET /conversations/{conversation_id}/threads`，用于枚举 Conversation 下的主 Thread 和派生 Thread。
- Thread metadata 返回 `conversation_id`、`parent_thread_id`、`primary`、`assistant_id` 和 Side Chat 标识。
- Conversation 消息查询增加显式 `threadId`；未传时默认主 Thread。返回活动 Head 的祖先路径，而不是简单过滤 `createdInThreadId`。
- Goal 和 Task Summary API 增加 `threadId`；未传时默认主 Thread。
- `@xpert-ai/xpert-sdk` 增加对应类型、Thread Copy 参数、Conversation Threads 查询和 Thread 级消息/Goal 调用；ChatKit 不使用原生 `fetch` 绕过 SDK。
- 删除子 Thread 只删除该分支的 checkpoint、Execution、Goal 和专属消息；删除主 Thread 或 Conversation 时级联删除整个 Thread 家族。

Run 创建链路以 `/threads/{thread_id}` 中的 ID 为权威上下文。服务端先解析 `ChatConversationThread` 和所属 Conversation，再按该 Thread 加载消息、Goal、状态和中断信息。只有主 Thread 的状态继续镜像到旧 `ChatConversation.status/error/operation` 字段。

## ChatKit 与 Workbench 升级

新增配置，默认关闭，待平台和 SDK 部署完成后由宿主显式开启：

```ts
const options: ChatKitOptions = {
  // ...
  workbench: {
    enabled: true,
    sideChat: {
      enabled: true,
    },
  },
};
```

Workbench 内部 View 改为联合模型：

- Remote View 继续通过隔离 iframe 渲染。
- Side Chat View 直接挂载原生 React 组件，不经过 manifest 或 Remote View bridge。
- Remote View 加载失败或为空时，仍然允许通过文本选择创建 Side Chat。

主 Chat 的选择浮层增加“在侧边聊天中提问”：

1. 用户选择单条消息中的文本。
2. 点击动作后立即打开 Workbench loading 状态。
3. ChatKit 通过 SDK Fork 当前主 Thread。
4. 使用首次引用的短摘要作为稳定 Tab 标题。
5. 将现有 `ChatKitQuoteReference` 合并到侧聊 Composer，并聚焦输入区域。

同一 ChatKit mount 内，以源 Thread ID 缓存侧聊 Thread、草稿和引用。重复选择会激活现有 Side Chat 并追加去重后的引用；切换 Remote View、关闭整个 Workbench 面板或在页面内切换后返回源 Thread，不应丢失未提交草稿。显式关闭 Side Chat Tab 时先二次确认，确认后只从当前 Workbench 移除 Side Chat 及本地复用映射，不删除服务端 Thread；下一次选择会重新 Fork。刷新页面后不发现或恢复旧 Side Chat；已创建的服务端 Thread 沿用平台保留策略，不依赖不可靠的 unload 删除。

Side Chat 复用 `Chat`，但运行在内部 `surface="workbench"` 模式：

- 隐藏重复 Header、历史、新建 Thread、Pet、Workbench Toggle 和递归 Side Chat 动作。
- 保留消息列表、Composer、引用、附件、流式响应、HITL 和运行状态。
- 使用独立的受控 Stream Provider；Thread ID 只保存在组件内存，不写入主 URL。
- 不注册主 Chat 的 Parent Messenger handler，不覆盖全局 Stream，也不向宿主发送 `thread.change` 等主导航事件。
- 继承相同的认证、Assistant、Project、请求配置和 Workbench Context。

选择动作仅在源 Thread 已存在、认证完成并且当前不处于生成状态时可用。服务端继续执行 idle 状态检查，以覆盖点击与 Run 启动之间的竞争条件。Fork 失败时，Workbench 保留待插入引用并提供原位重试，不修改主 Composer。

视觉上沿用现有 Workbench 的安静标签层级、语义颜色、焦点样式和响应式行为。宽屏使用现有可调整分栏，窄于 960px 使用现有 Sheet；两个选择动作必须在窄屏、长文案和放大文本下保持可见、可点击且不溢出视口。

## 兼容与迁移

- 为每条历史 Conversation 创建一个主 `ChatConversationThread`。
- 将历史消息的 `createdInThreadId` 回填为主 Thread。
- 主 Thread Head 选择按现有 Tree 可达的最新叶子；Retry 产生的旧 sibling 保留在 Tree 中，但不再同时出现在活动路径。
- 历史 Goal 回填到对应主 Thread，并建立新的组合唯一约束。
- 旧 Conversation、消息、Goal 和 Task Summary API 在未传 `threadId` 时保持主 Thread 语义。
- Conversation History 仍然一条记录对应一个 Conversation；Side Chat 活动不创建新的历史条目，也不更新主 Thread 未读状态。
- `xpert` 完成数据与 API 升级后，同步到 `xpert-pro`；先发布 SDK，再升级 ChatKit 和宿主配置。

## 实施阶段

### 阶段一：平台 Thread 基础

- 引入 `ChatConversationThread`、Head 指针、迁移和租户/组织索引。
- 改造消息路径、Goal、Task Summary、Follow-up、HITL 和 Run 状态的 Thread scope。
- 实现 Thread Copy、Thread 查询、删除和 checkpoint 复制。
- 发布包含新接口的 Xpert SDK。

### 阶段二：ChatKit 原生 Side Chat

- 扩展 Workbench View 联合类型和 Side Chat session 状态。
- 增加选择浮层动作、Fork loading/error/retry 和引用注入。
- 抽取可受控的 Stream Thread 状态，隔离主/侧 Chat 的 URL、宿主事件和全局 Stream。
- 为 `Chat` 增加 Workbench surface，并修正 `header.enabled`、禁用历史拉取等嵌入行为。

### 阶段三：宿主启用与观测

- 在 Xpert ChatKit 宿主显式开启 `workbench.sideChat.enabled`。
- 记录 Fork 成功率、409 竞争、加载失败和 Side Chat Run 错误，不记录选中文本、凭证或完整消息内容。
- 完成已安装平台验证后再扩大启用范围。

## 测试与验收

平台测试必须覆盖：

- 历史 Conversation、Message Tree 和 Goal 回填。
- Fork 共享消息 Head，同时复制 checkpoint、writes 和 Goal。
- 主/子 Thread 的消息、Run、Goal、中断和 Follow-up 相互隔离。
- Retry sibling 只移动当前 Thread Head。
- idle/busy 并发控制、跨租户访问拒绝和删除可达性。
- 主 Thread 删除级联与子 Thread 独立删除。
- 旧 API 未传 `threadId` 时的主 Thread 兼容行为。

ChatKit 测试必须覆盖：

- 选择浮层的两个动作、可用条件、键盘焦点和中英文文案。
- 每个源 Thread 在一次 mount 内只 Fork 一次，重复选择复用并去重引用。
- 草稿在 Workbench Tab 切换、关闭整个面板和重新打开后保持；显式关闭 Side Chat Tab 覆盖取消、确认、“不再询问”以及不调用服务端 Thread 删除接口。
- Side Chat Stream 不改变主 URL、主 Stream 或宿主 `thread.change`。
- 没有 Remote View、Remote View 加载失败和 Fork 失败时的恢复路径。
- 桌面分栏、窄屏 Sheet、浅色/深色、长文案和放大文本。

端到端验收流程：

```text
主 Thread 完成回答
  → 选择单条消息中的文本
  → 点击“在侧边聊天中提问”
  → Workbench 打开原生 Side Chat
  → Composer 显示引用 Chip
  → 输入并提交问题
  → 子 Thread 流式回答
  → 主 Thread transcript、状态和 checkpoint 保持不变
```

E2E 使用真实生产 Chat 组件和真实 Workbench 组件，不以简化测试组件替代。除 UI 断言外，还要验证服务端 Thread 血缘、活动 Head 和 checkpoint 的权威状态，并为桌面和窄屏关键状态保留确定性截图证据。
