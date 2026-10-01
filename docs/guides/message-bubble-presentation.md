# 消息气泡模式

ChatKit 现在支持两种消息展示形式，默认仍为 `transcript`。设置 `messagePresentation.mode` 为 `bubbles`，即可将每个 AI 文本块、可见结果和交互组件展示为独立气泡。存储的消息、流式协议、工具执行和消息 ID 不变。

## 启用与回退

在现有完整 options 中增加：

```ts
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

const options: ChatKitOptions = {
  ...baseOptions, // 沿用宿主的 API、认证回调、frameUrl 等配置
  messagePresentation: {
    mode: 'bubbles',
    collapseProcess: true,
  },
};

chatkitElement.setOptions(options);
```

`collapseProcess` 在气泡模式中暂不生效：工具前后的正文都会保留为独立气泡。改回 `mode: 'transcript'` 后恢复原来的过程折叠设置。未配置 mode 的已有宿主不改变行为。调用 `setOptions` 时继续提供完整 options，不能只传展示字段覆盖已有配置。

React 使用 `useChatKit({ ...baseOptions, messagePresentation: { mode } })`；Vue 使用同样的 options（运行时变化通过 ref / computed 提供）；原生 JS 使用 `createChatKit(options)` 创建，后续通过 `instance.element.setOptions(nextOptions)` 更新。没有新增框架专属属性。

本地无需发布 SDK：使用当前工作区的 ChatKit types / wrapper，并让 `frameUrl` 指向运行此源码的 UI 开发服务。只升级类型、仍加载旧 iframe bundle，不会启用新界面。本功能不增加 Xpert API 或沙箱依赖。

## 展示规则

| 内容                             | 气泡模式                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------ |
| AI 文本                          | 每个原始 text 块一个气泡；段落、SSE token 不拆成额外气泡                       |
| 用户消息                         | 右侧主题强调色气泡；AI 靠左使用中性色                                          |
| 普通工具、推理、Memory、内部事件 | 隐藏过程 UI；仍保留原始数据及执行                                              |
| 工具图片、搜索与知识检索结果     | 通过已声明附件与专用结果 renderer 保留，避免展示原始工具 JSON                  |
| 文件活动、资源卡片               | 复用原去重与操作逻辑，使用气泡外观                                             |
| Widget、MCP App、提问与审批      | 保留原交互和调用绑定；历史 MCP 结果不重新连接工具                              |
| 子 Agent / 外部 Assistant        | 保留署名及执行入口；子内容遵守相同展示规则，内部工具输入与计数不再展示         |
| 未知组件                         | 保留现有兼容 renderer，不按名称猜测并丢弃                                      |
| 无正文的回复                     | 运行中展示状态；明确成功后显示完成；失败、暂停、中断可见；无完成信号不猜测成功 |

同一消息只保留一组主操作。主回复复制按顺序组合当前发言者的正文，不复制推理、工具载荷或子助手正文；子助手正文在其独立视图中复制或选中引用。重试、编辑、分支仍定位原始消息。导航隐藏过程摘要，外部 Assistant 使用其可见卡片名称。

主聊天、Workbench 最大化后的 Chat 标签页、侧边聊天和外部 Assistant 消息列表共用配置。侧边聊天继承 options，不增加额外的运行权限。

## 生命周期与主题

两种模式使用同一棵 keyed 内容树。气泡不改写原始消息，不用气泡序号替代 messageId。Widget / MCP 实例不会因为切换展示模式或后到达的推理前缀而重新挂载。过程折叠通过可见性控制，最终回复的交互实例保持稳定。

切换模式前记录当前消息的相对滚动位置，切换后恢复同一可见消息；原本在底部的视口继续跟随底部。正常增量更新与分页仍由现有 viewport 流程处理。无 ID 的旧内容使用原始位置回退；不承诺任意重排无 ID 内容时仍可无损匹配。

气泡圆角来自 `--chat-panel-radius`，密度来自 `--chat-density-scale`，通过 ThemeProvider 继承。`sharp` 为直角，颜色跟随主题。文本最大宽度桌面 80%、窄容器 92%；交互卡片可使用完整消息列宽度。代码和表格保留内部滚动。

## 维护入口

- `lib/message-presentation.ts`：配置优先级、内容分类、发言者与来源描述、正文复制。
- `components/thread/messages/assistant-content.tsx`：共享渲染树、稳定 key、过程与结果可见性。
- `assistant-blocks.tsx`：从旧 `ai.tsx` 提取的叶子 renderer；`ai.tsx` 管理回复状态与尾部结果。
- `bubble-tool-results.tsx` / `component-message-renderers.tsx`：专用工具结果提取。新增结果类型需明确声明 `hasBubbleResult`，不得直接把任意工具 output 当成可见结果。
- `MessageBubble` / `message-bubbles.css`：统一外观；`PresentationScrollAnchor`：模式切换滚动保护。
- `MessageList`：原始消息操作、审批落点、引用与 actor 适配。

## 审核与本地预览

```sh
pnpm dev:ui
```

访问 UI 开发服务的 `/dev/message-bubbles/`，可对比两种模式、浅深色、圆角 / 直角、紧凑密度、360px 面板与 200% 缩放，并在草稿输入框中验证模式切换不会丢失内容。该页面仅使用合成数据，不请求 Assistant、不执行工具；不会进入生产 app 的入口 bundle。

## 验收记录（2026-10-01）

### 自动验证

- 全量 UI 测试 173 个文件、1,389 项通过；Web Component 测试 4 个文件、8 项通过；UI 类型检查、UI library / app 构建通过。
- 气泡专项验证包括块边界、流式追加、历史插入、Widget / MCP 节点与草稿保持、历史 MCP、提问结果、审批、工具图片提取、未知组件兼容、无正文状态和原模式恢复。
- 配置桥接验证初次 iframe 序列化和运行时 setOptions 更新，不更换 iframe；JS / React / Vue / Web Component 类型检查通过。
- 验证复制、子助手来源隔离、导航原消息锚点、模式切换滚动和主题 token 更新。
- 最后的空值检查调整后，重新通过 22 项相关测试及 UI 类型检查。修改范围的 ESLint 仍报告既有的 3 处非空断言错误和 4 条 Hook 依赖警告，本次新增代码的 lint 问题已修正；不将此项标为全部通过。

### 平台 ClawXpert

使用既有本地 Cloud、API 与本工作区 ChatKit UI，临时在 ClawXpert options 中启用 `mode: 'bubbles'`，未修改 Assistant 发布配置。验收后已恢复宿主配置，正式启用仍通过 options 显式选择。

审核状态补充：用户要求查看实际效果后，已在本地 ClawXpert 的 `clawxpert-conversation-detail.component.ts` 中重新启用气泡模式，并保留为未提交改动供审核。此配置影响该本地宿主中的 ClawXpert 展示，ChatKit SDK 的默认模式仍为 `transcript`。

1. 发起合成验收对话，观察真实请求的运行状态、逐块正文、列表与代码块。
2. 观察实际外部 DOCX 助手调用及结果卡片；打开 Workbench 外部助手视图，确认其回复也使用气泡。
3. 最大化 Workbench，切换到首个“聊天”标签，原会话和气泡保持；约 360px 聊天区域下无整体横向溢出。
4. 刷新平台页面，历史消息正常恢复；重新复制主回复，确认保留正文与代码且排除隐藏子助手正文。
5. 从 Workbench 新标签页打开侧边聊天，真实创建分支并加载历史；主列表与侧边列表都保持气泡模式。
6. 使用独立合成预览补充深色、直角、紧凑、200% 缩放、过程展开与草稿保留验收。

本次平台会话的工具集合没有通用终端，实际调用了 DOCX 子助手并返回能力限制。没有将模型生成的“模拟验收总结”当作工具执行证据。审批、工具图片和 MCP 的保留由自动测试覆盖，本次没有逐项在真实服务中触发。真实长会话性能和所有浏览器 / 屏幕阅读器组合仍需后续专项覆盖。

## 尚未启用的扩展

Assistant 配置默认值的服务端契约尚未确定，当前只有 options 生效。内部解析器已预留 defaults 参数，优先级为显式 options > Assistant defaults > transcript 默认值；未读取猜测的 Assistant 字段。

`MessageActor` 与 `PresentationSource` 区分作者、角色、原消息 / 块和执行 ID，但本期没有群聊协议、并行多 Assistant 调度、参与者目录或 @提及。不能把执行 ID 或相同显示名称当成跨会话作者身份。
