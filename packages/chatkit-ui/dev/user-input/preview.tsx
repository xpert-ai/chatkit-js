import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type {
  RequestUserInputForm,
  UserInputValues,
} from '@xpert-ai/chatkit-types';
import { ThemeProvider } from '../../src/providers/Theme';
import { RequestUserInputPanel } from '../../src/components/composer/request-user-input-panel';
import { RequestUserInputResultCard } from '../../src/components/thread/messages/request-user-input-result-card';
import { setLanguage } from '../../src/i18n';
import '../../src/index.css';

// Synthetic acceptance fixture. No Assistant, API requests, or model calls.
const form: RequestUserInputForm = {
  schemaVersion: 1,
  mode: 'blocking',
  purpose: 'clarification',
  title: '补充销售分析范围',
  description: '确认分析口径后，我会继续生成区域对比和趋势报告。',
  fields: [
    {
      id: 'name',
      type: 'text',
      label: '报告名称',
      required: true,
      maxLength: 60,
    },
    { id: 'period', type: 'date_range', label: '分析期间', required: true },
    {
      id: 'regions',
      type: 'multiselect',
      label: '销售区域',
      required: true,
      options: [
        { value: 'east', label: '华东' },
        { value: 'south', label: '华南' },
        { value: 'north', label: '华北' },
      ],
    },
    {
      id: 'metric',
      type: 'select',
      label: '主要指标',
      required: true,
      options: [
        { value: 'revenue', label: '销售收入' },
        { value: 'margin', label: '毛利率' },
      ],
    },
    { id: 'refunds', type: 'boolean', label: '是否包含退款', required: true },
    {
      id: 'minimum',
      type: 'number',
      label: '最低订单金额',
      description: '填写 0 表示不限制最低金额。',
      required: true,
      min: 0,
    },
    { id: 'due', type: 'date', label: '期望完成日期' },
    { id: 'notes', type: 'textarea', label: '补充要求', maxLength: 500 },
  ],
};
setLanguage('zh-CN');

function Preview() {
  const [dark, setDark] = React.useState(false);
  const [sharp, setSharp] = React.useState(false);
  const [density, setDensity] = React.useState<
    'compact' | 'normal' | 'spacious'
  >('normal');
  const [narrow, setNarrow] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  const [result, setResult] = React.useState<{
    status: 'submitted' | 'cancelled';
    values?: UserInputValues;
  } | null>(null);
  return (
    <ThemeProvider
      theme={{
        colorScheme: dark ? 'dark' : 'light',
        radius: sharp ? 'sharp' : 'round',
        density,
      }}
    >
      <main className="min-h-screen bg-background p-4 text-foreground">
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="text-xl font-semibold">运行中用户输入 · 首期验收</h1>
          <p className="text-sm text-muted-foreground">
            使用真实表单组件和模拟数据，不连接后端。非阻塞提问为后续阶段。
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label>
              <input
                type="checkbox"
                checked={dark}
                onChange={(event) => setDark(event.target.checked)}
              />{' '}
              深色
            </label>
            <label>
              <input
                type="checkbox"
                checked={sharp}
                onChange={(event) => setSharp(event.target.checked)}
              />{' '}
              直角
            </label>
            <label>
              <input
                type="checkbox"
                checked={narrow}
                onChange={(event) => setNarrow(event.target.checked)}
              />{' '}
              窄屏
            </label>
            <select
              aria-label="密度"
              className="bg-background"
              value={density}
              onChange={(event) =>
                setDensity(event.target.value as typeof density)
              }
            >
              <option value="compact">紧凑</option>
              <option value="normal">标准</option>
              <option value="spacious">宽松</option>
            </select>
            <button
              onClick={() => {
                setResult(null);
                setRevision((value) => value + 1);
              }}
            >
              重新填写
            </button>
          </div>
          <div
            className="mx-auto w-full"
            style={{ maxWidth: narrow ? 360 : 720 }}
          >
            {result ? (
              <RequestUserInputResultCard
                result={{
                  toolCallId: `preview-${revision}`,
                  answers: [],
                  status: result.status,
                  ...(result.status === 'submitted'
                    ? { form, values: result.values }
                    : {}),
                }}
              />
            ) : (
              <RequestUserInputPanel
                attachToComposer={false}
                request={{
                  id: `preview-${revision}`,
                  toolCallId: `preview-${revision}`,
                  createdAt: 0,
                  params: form,
                }}
                onSubmit={(values) => {
                  if (!Array.isArray(values))
                    setResult({ status: 'submitted', values });
                }}
                onDismiss={() => setResult({ status: 'cancelled' })}
              />
            )}
          </div>
          {result && (
            <pre
              className="overflow-auto rounded-chat-panel bg-muted p-4 text-xs"
              aria-label="结构化结果"
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
