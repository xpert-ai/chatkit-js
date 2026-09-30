// Browser fixture: production card, command executor, SDK client and iframe bridge;
// only API data is simulated. No platform credentials or scheduler are used.
import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Client,
  type XpertExtensionViewManifest,
  type XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import {
  createResourceCardContent,
  type ResourceCardOpenTarget,
} from '@xpert-ai/chatkit-types';
import { MessageResourceCards } from '../src/components/thread/messages/resource-cards';
import {
  WorkbenchContext,
  disabledWorkbenchContext,
} from '../src/workbench/context';
import { executeWorkbenchCommand } from '../src/workbench/client-commands';
import { useResourceCardNavigation } from '../src/workbench/useResourceCardNavigation';
import { RemoteViewFrame } from '../src/workbench/RemoteViewFrame';
import { ThemeProvider } from '../src/providers/Theme';
import { setLanguage } from '../src/i18n';
import './style.css';
const params = new URLSearchParams(location.search);
const locale = params.get('lang') || 'zh-CN';
setLanguage(locale);
const zh = locale.startsWith('zh');
const ids = [
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
];
const initial = ids.map((id, index) => ({
  id,
  name: index
    ? zh
      ? '每周项目复盘'
      : 'Weekly project review'
    : zh
      ? '每日项目进展摘要：跟进交付计划与待处理风险，汇总各项任务的最新状态'
      : 'Daily project briefing: delivery plans, outstanding risks and the latest status of every task',
  prompt: zh
    ? '整理项目进展、待办和风险，生成摘要。'
    : 'Summarize project progress, outstanding work and risks.',
  options: {
    frequency: index ? 'Weekly' : 'Daily',
    time: '09:00',
    ...(index ? { dayOfWeek: 1 } : {}),
  },
  timeZone: 'Asia/Shanghai',
  status: 'scheduled',
  scheduleDescription: '09:00',
  runs: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      title: zh ? '项目进展摘要' : 'Project progress report',
      status: 'success',
      createdAt: '2026-09-29T01:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
}));
const tasks = JSON.parse(
  sessionStorage.getItem('resource-preview-tasks') || JSON.stringify(initial),
) as typeof initial;
const cards = initial.map((task) =>
  createResourceCardContent({
    resource: { namespace: 'platform', type: 'scheduled-task', id: task.id },
    title: task.name,
    description: `${task.options.frequency} · 09:00 · Asia/Shanghai`,
    icon: { type: 'emoji', value: '◷' },
    open: {
      target: 'workbench.view',
      viewKey: 'platform.scheduler__detail',
      selectionId: task.id,
    },
  }),
);
cards.push(
  createResourceCardContent({
    resource: {
      namespace: 'platform',
      type: 'project',
      id: 'platform-project',
    },
    title: zh ? '投标项目' : 'Bid project',
    description: zh ? '任务与时间线' : 'Tasks and timeline',
    icon: { type: 'emoji', value: '📁' },
    open: {
      target: 'assistant.project',
      projectId: 'platform-project',
      viewKey: 'platform.project-tasks__timeline',
    },
  }),
);
const manifest: XpertExtensionViewManifest = {
  key: 'platform.scheduler__detail',
  title: { en_US: 'Scheduled task' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  source: { provider: 'platform.scheduler' },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'scheduler-detail' },
    dataSource: { mode: 'platform' },
  },
  dataSource: {
    mode: 'platform',
    querySchema: { supportsSelection: true, supportsPagination: true },
  },
  actions: ['save', 'pause', 'resume', 'execution-target'].map((key) => ({
    key,
    label: { en_US: key },
    actionType: 'invoke',
  })),
  clientCommands: [
    { key: 'workbench.navigation.open', label: { en_US: 'Open' } },
  ],
};
const projectManifest: XpertExtensionViewManifest = {
  ...manifest,
  key: 'platform.project-tasks__timeline',
  source: { provider: 'platform.project-tasks' },
  title: { en_US: 'Project tasks' },
  actions: [
    { key: 'change', label: { en_US: 'Change' }, actionType: 'invoke' },
  ],
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'project-tasks' },
    dataSource: { mode: 'platform' },
  },
};
const client = new Client({
  apiUrl: `${location.origin}/api/ai`,
  callerOptions: {
    fetch: async (input, options) => {
      const url = new URL(String(input));
      const project = url.pathname.includes('platform.project-tasks__timeline');
      if (url.pathname.endsWith('/remote-component/entry'))
        return fetch(project ? '/project.html' : '/scheduler.html');
      if (project && url.pathname.endsWith('/data')) {
        const { graph } = await (await fetch('/project-data.json')).json();
        return new Response(
          JSON.stringify({
            item: {
              ...graph,
              projectId: 'platform-project',
              projectTitle: zh ? '投标项目' : 'Bid project',
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }
      let data: unknown;
      if (url.pathname.endsWith('/data')) {
        const query = url.searchParams.get('query');
        const selectionId =
          url.searchParams.get('selectionId') ||
          (query ? JSON.parse(query).selectionId : null);
        data = { item: tasks.find((task) => task.id === selectionId) ?? null };
      } else if (url.pathname.includes('/actions/')) {
        const body = JSON.parse(String(options?.body || '{}'));
        const task = tasks.find((item) => item.id === body.input?.taskId);
        if (!task) return new Response('Missing task', { status: 404 });
        const action = url.pathname.split('/actions/')[1];
        if (action === 'save') Object.assign(task, body.input);
        if (action === 'pause') task.status = 'paused';
        if (action === 'resume') task.status = 'scheduled';
        sessionStorage.setItem('resource-preview-tasks', JSON.stringify(tasks));
        data = {
          success: true,
          ...(action === 'execution-target'
            ? {
                data: {
                  target: 'assistant.conversation',
                  conversationId: body.input.conversationId,
                },
              }
            : {}),
        };
      } else throw Error(`Unhandled fixture route: ${url.pathname}`);
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  },
});
function App() {
  const [query, setQuery] = React.useState<XpertViewQuery | null>(null);
  const [selectedView, setSelectedView] = React.useState(manifest);
  const [notification, setNotification] = React.useState('');
  const remember = useResourceCardNavigation({
    scope: 'resource-card-browser-fixture',
    enabled: true,
    ready: true,
    restore: (target) => {
      setSelectedView(manifest);
      setQuery({ selectionId: target.selectionId });
      return true;
    },
    close: () => setQuery(null),
  });
  const open = async (target: ResourceCardOpenTarget) => {
    const result = await executeWorkbenchCommand(
      {
        commandKey: 'workbench.navigation.open',
        payload: target,
        hostType: 'agent',
        hostId: 'fixture',
        viewKey: manifest.key,
      },
      {
        apiUrl: '/api/ai',
        openView: (_key, next) => {
          setSelectedView(manifest);
          setQuery(next);
          return true;
        },
        openPreview: () => {},
        revealChat: () => {},
        updateComposer: async () => {},
        focusComposer: async () => {},
        forward: async () => ({
          success: true,
          session: {
            assistantId: 'fixture',
            projectId: 'platform-project',
            threadId: null,
            secret: 'fixture-only',
          },
        }),
        navigate: (session) => {
          setSelectedView(projectManifest);
          setQuery({});
          setNotification(`Project: ${session.projectId}`);
        },
      },
    );
    remember(target);
    return result;
  };
  return (
    <WorkbenchContext.Provider
      value={{
        ...disabledWorkbenchContext,
        enabled: true,
        openResourceCard: (card) => open(card.data.open),
      }}
    >
      <div className="grid min-h-screen bg-background text-foreground md:grid-cols-2">
        <section className="space-y-6 p-6 md:p-10">
          <p className="text-xs text-muted-foreground">
            {zh
              ? '构建产物验收 · 模拟业务数据'
              : 'Built assets · simulated business data'}
          </p>
          <h1 className="text-xl font-semibold">
            {zh ? '项目助手' : 'Project assistant'}
          </h1>
          <p>
            {zh
              ? '已创建定时任务。点击打开可查看详情。'
              : 'Scheduled tasks created. Open a card to view details.'}
          </p>
          <MessageResourceCards
            message={{ id: 'reply', type: 'assistant', content: cards }}
          />
          {notification && <p role="status">{notification}</p>}
        </section>
        {query && (
          <section className="h-screen min-w-0 border-l border-border">
            <RemoteViewFrame
              manifest={selectedView}
              initialQuery={query}
              hostId="fixture"
              locale={locale}
              title={zh ? '定时任务' : 'Scheduled task'}
              hostEvent={null}
              viewHosts={client.viewHosts}
              onNotify={(_level, message) => setNotification(message)}
              onClientCommand={async (_key, payload) => {
                setNotification(JSON.stringify(payload));
                return { success: true, status: 'opened' };
              }}
            />
          </section>
        )}
      </div>
    </WorkbenchContext.Provider>
  );
}
createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={params.get('theme') === 'dark' ? 'dark' : 'light'}>
    <App />
  </ThemeProvider>,
);
