import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { A2UIProvider, type Types } from '@xpert-ai/a2ui-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@xpert-ai/chatkit-primitives';
import { ThemeProvider } from '../src/providers/Theme';
import { WidgetMessage } from '../src/components/thread/messages/widget';
import '../src/index.css';

const surfaceId = 'preview';
const messages: Types.ServerToClientMessage[] = [
  {
    dataModelUpdate: {
      surfaceId,
      contents: [
        { key: 'name', valueString: '' },
        { key: 'destination', valueString: '' },
        { key: 'budget', valueNumber: 2000 },
        { key: 'department', valueString: 'engineering' },
        { key: 'approved', valueBoolean: false },
      ],
    },
  },
  {
    surfaceUpdate: {
      surfaceId,
      components: [
        {
          id: 'root',
          component: {
            Column: {
              children: {
                explicitList: [
                  'heading',
                  'name-field',
                  'destination-field',
                  'department-field',
                  'budget-field',
                  'check-field',
                  'submit-button',
                ],
              },
            },
          },
        },
        {
          id: 'heading',
          component: {
            Text: { text: { literalString: '出差申请表' }, usageHint: 'h1' },
          },
        },
        {
          id: 'name-field',
          component: {
            TextField: {
              label: { literalString: '姓名' },
              text: { path: '/name' },
            },
          },
        },
        {
          id: 'destination-field',
          component: {
            TextField: {
              label: { literalString: '目的地' },
              text: { path: '/destination' },
            },
          },
        },
        {
          id: 'department-field',
          component: {
            MultipleChoice: {
              label: { literalString: '部门' },
              selections: { path: '/department' },
              options: [
                { value: 'engineering', label: { literalString: '研发中心' } },
                {
                  value: 'sales',
                  label: { literalString: '销售与客户服务团队' },
                },
                {
                  value: 'operations',
                  label: {
                    literalString: '国际业务运营与支持部门（长文本选项）',
                  },
                },
              ],
            },
          },
        },
        {
          id: 'budget-field',
          component: {
            Slider: {
              label: { literalString: '预算' },
              value: { path: '/budget' },
              minValue: 0,
              maxValue: 5000,
            },
          },
        },
        {
          id: 'check-field',
          component: {
            CheckBox: {
              label: { literalString: '已核对出差信息' },
              value: { path: '/approved' },
            },
          },
        },
        {
          id: 'submit-caption',
          component: { Text: { text: { literalString: '提交申请' } } },
        },
        {
          id: 'submit-button',
          component: {
            Button: {
              child: 'submit-caption',
              action: {
                name: 'submit_trip',
                context: [
                  { key: 'name', value: { path: '/name' } },
                  { key: 'destination', value: { path: '/destination' } },
                  { key: 'department', value: { path: '/department' } },
                  { key: 'budget', value: { path: '/budget' } },
                  { key: 'approved', value: { path: '/approved' } },
                ],
              },
            },
          },
        },
      ],
    },
  },
  { beginRendering: { surfaceId, root: 'root' } },
];
const data = { type: 'Widget' as const, widgets: [{ name: 'trip', messages }] };
function Preview() {
  const [density, setDensity] = useState<'compact' | 'normal' | 'spacious'>(
    'normal',
  );
  const [radius, setRadius] = useState<'sharp' | 'soft' | 'round' | 'pill'>(
    'soft',
  );
  const [dark, setDark] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [result, setResult] = useState('尚未提交');
  const [accent, setAccent] = useState(false);
  return (
    <ThemeProvider
      theme={{
        density,
        radius,
        colorScheme: dark ? 'dark' : 'light',
        typography: { baseSize: 16 },
        color: accent
          ? { accent: { primary: '#6155d9', level: 2 } }
          : undefined,
      }}
    >
      <main className="min-h-screen p-6 text-foreground">
        <h1 className="mb-3 text-xl font-semibold">
          ChatKit 与 A2UI 共用组件验收
        </h1>
        <div className="mb-6 flex flex-wrap gap-3">
          {(['compact', 'normal', 'spacious'] as const).map((value) => (
            <Button
              key={value}
              onClick={() => setDensity(value)}
              variant={density === value ? 'default' : 'outline'}
            >
              {value}
            </Button>
          ))}
          {(['sharp', 'soft', 'round', 'pill'] as const).map((value) => (
            <Button
              key={value}
              onClick={() => setRadius(value)}
              variant={radius === value ? 'default' : 'outline'}
            >
              {value}
            </Button>
          ))}
          <Button variant="outline" onClick={() => setDark(!dark)}>
            切换明暗
          </Button>
          <Button variant="outline" onClick={() => setAccent(!accent)}>
            切换主色
          </Button>
          <Button variant="outline" onClick={() => setNarrow(!narrow)}>
            切换窄窗口
          </Button>
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <section className="max-w-xl space-y-4">
            <h2 className="text-base font-medium">ChatKit 原生控件</h2>
            <div className="ck-field">
              <Label htmlFor="native-name">原生姓名</Label>
              <Input id="native-name" />
            </div>
            <div className="ck-field">
              <Label htmlFor="native-select">原生部门</Label>
              <Select defaultValue="engineering">
                <SelectTrigger id="native-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engineering">研发中心</SelectItem>
                  <SelectItem value="sales">销售团队</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button>原生按钮</Button>
          </section>
          <section
            style={{
              width: narrow ? 320 : '100%',
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            <h2 className="mb-3 text-base font-medium">A2UI Widget</h2>
            <A2UIProvider
              onAction={(action) => setResult(JSON.stringify(action, null, 2))}
            >
              <WidgetMessage messageId="preview" data={data} />
            </A2UIProvider>
          </section>
        </div>
        <pre
          aria-label="提交结果"
          className="mt-8 overflow-auto rounded-chat-panel bg-muted p-4 text-xs"
        >
          {result}
        </pre>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
