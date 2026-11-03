import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, CircleGauge, Plus } from 'lucide-react';
import {
  ChatLayout,
  ChatComposerDock,
} from '../../src/components/chat/ChatLayout';
import { ChatComposerForm } from '../../src/components/chat/composer/ChatComposerForm';
import { ModelPicker } from '../../src/components/composer/ModelPicker';
import { PendingTodos } from '../../src/components/composer/pending-todos';
import type { TodoListSnapshot } from '../../src/lib/todos';
import { useChatDraft } from '../../src/components/chat/composer/useChatDraft';
import { ThemeProvider } from '../../src/providers/Theme';
import { Button } from '../../src/components/ui/button';
import { isNearBottom } from '../../src/lib/scroll';
import {
  getComposerPlainText,
  readComposerPartsFromElement,
} from '../../src/lib/composer-parts';
import '../../src/i18n';
import '../../src/index.css';

const tasks: TodoListSnapshot = {
  componentId: 'composer-layout-preview',
  title: 'Tasks',
  tool: 'write_todos',
  category: 'Tool',
  toolset: 'preview',
  status: 'running',
  createdDate: '2026-11-02T00:00:00Z',
  receivedAt: 0,
  items: [
    { id: 'status', content: '核对本轮执行的最新状态', status: 'in_progress' },
    { id: 'result', content: '等待任务完成并返回结果', status: 'pending' },
    { id: 'review', content: '复核交付并确认下一步', status: 'pending' },
  ],
};

// Isolated geometry and theme checks; this preview never sends API requests.
function Preview() {
  const viewport = useRef<HTMLDivElement>(null);
  const draft = useChatDraft();
  const input = draft.composerInputRef;
  const [compact, setCompact] = useState(false);
  const [dark, setDark] = useState(false);
  const [spacious, setSpacious] = useState(false);
  const [sharp, setSharp] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  const [showError, setShowError] = useState(true);
  const [submitted, setSubmitted] = useState('');
  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight });
  }, []);
  const scroll = (distance = 0) => {
    const el = viewport.current;
    if (el)
      el.scrollTo({
        top: el.scrollHeight - el.clientHeight - distance,
        behavior: 'smooth',
      });
  };
  return (
    <ThemeProvider
      theme={{
        colorScheme: dark ? 'dark' : 'light',
        radius: sharp ? 'sharp' : 'round',
        density: spacious ? 'spacious' : 'compact',
      }}
    >
      <main className="h-screen bg-background p-4 text-foreground">
        <nav className="flex flex-wrap items-center gap-4 pb-4">
          <label>
            <input
              type="checkbox"
              checked={dark}
              onChange={(e) => setDark(e.target.checked)}
            />{' '}
            Dark
          </label>
          <label>
            <input
              type="checkbox"
              checked={sharp}
              onChange={(e) => setSharp(e.target.checked)}
            />{' '}
            Sharp
          </label>
          <label>
            <input
              type="checkbox"
              checked={spacious}
              onChange={(e) => setSpacious(e.target.checked)}
            />{' '}
            Spacious
          </label>
          <label>
            <input
              type="checkbox"
              checked={narrow}
              onChange={(e) => setNarrow(e.target.checked)}
            />{' '}
            Narrow
          </label>
          <label>
            <input
              type="checkbox"
              checked={showTasks}
              onChange={(e) => setShowTasks(e.target.checked)}
            />{' '}
            任务面板
          </label>
          <label>
            <input
              type="checkbox"
              checked={showError}
              onChange={(e) => setShowError(e.target.checked)}
            />{' '}
            错误提示
          </label>
          <Button onClick={() => scroll(49)}>距底部 49px</Button>
          <Button onClick={() => scroll(47)}>距底部 47px</Button>
          <Button onClick={() => scroll(500)}>阅读历史</Button>
          <Button onClick={() => scroll()}>回到底部</Button>
          <Button
            onClick={() =>
              draft.setComposerText('第一行草稿\n第二行草稿\n第三行草稿')
            }
          >
            多行草稿
          </Button>
          <span role="status">{submitted}</span>
        </nav>
        <section
          className="h-[80vh] max-w-full border border-border rounded-chat-panel"
          style={{ width: narrow ? 360 : 900 }}
        >
          <ChatLayout
            viewportRef={viewport}
            enabled={false}
            dropTitle=""
            dropHint=""
            onFiles={() => {}}
            onScroll={(e) => setCompact(!isNearBottom(e.currentTarget))}
          >
            <article className="mx-auto w-full max-w-2xl p-4">
              <h1 className="text-xl">对话滚动与输入区</h1>
              {Array.from({ length: 20 }, (_, i) => (
                <p key={i} className="my-8">
                  消息 {i + 1}
                  ：向上浏览历史时，输入框与操作按钮收为一行。到底部后恢复完整输入区。
                </p>
              ))}
            </article>
            <ChatComposerDock>
              <ChatComposerForm
                compact={compact}
                before={
                  <>
                    {showError && (
                      <div
                        role="alert"
                        className="mb-3 rounded-chat-panel border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive overflow-auto"
                      >
                        示例错误：操作尚未确认，请核对执行结果。
                      </div>
                    )}
                    {showTasks && <PendingTodos snapshot={tasks} />}
                  </>
                }
                overlay={
                  compact && (
                    <Button
                      aria-label="滚动到底部"
                      className="pointer-events-auto absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded-full shadow-md"
                      size="icon-sm"
                      variant="outline"
                      onClick={() => scroll()}
                    >
                      <ArrowDown />
                    </Button>
                  )
                }
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(
                    input.current
                      ? getComposerPlainText(
                          readComposerPartsFromElement(
                            input.current,
                            new Map(),
                          ),
                        )
                      : '',
                  );
                }}
                editor={{
                  inputRef: input,
                  version: draft.composerDomVersion,
                  value: draft.draft,
                  children: getComposerPlainText(draft.renderedComposerParts),
                  onInput: (e) =>
                    draft.commitComposerParts(
                      readComposerPartsFromElement(e.currentTarget, new Map()),
                    ),
                  focus: draft.focusComposerAt,
                  placeholder: '发送消息…',
                }}
                leadingActions={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="添加"
                    className="pointer-events-auto"
                  >
                    <Plus />
                  </Button>
                }
                trailingActions={
                  <>
                    <ModelPicker
                      selectionRequired
                      models={[
                        { id: 'preview', label: 'Example long model name' },
                      ]}
                      selectedModelId="preview"
                      onSelect={() => {}}
                      copy={{
                        label: '模型',
                        title: '模型',
                        description: 'Local preview',
                        availableModels: '可用模型',
                        defaultBadge: '默认',
                        unavailableBadge: '不可用',
                        futureTitle: '参数',
                        futureDescription: 'Local preview',
                        futureBadge: '预览',
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="上下文用量"
                    >
                      <CircleGauge />
                    </Button>
                  </>
                }
                send={{ sendLabel: '发送' }}
                footer={
                  <div data-slot="composer-context-rail">
                    <Button
                      type="button"
                      variant="ghost"
                      data-slot="composer-project-rail"
                    >
                      选择项目
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      data-slot="composer-file-selector"
                    >
                      选择文件
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      data-slot="composer-resource-selector"
                    >
                      插件
                    </Button>
                  </div>
                }
              />
            </ChatComposerDock>
          </ChatLayout>
        </section>
      </main>
    </ThemeProvider>
  );
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Preview />);
