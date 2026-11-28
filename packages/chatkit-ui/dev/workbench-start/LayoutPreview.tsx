import { useState } from 'react';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../src/providers/Theme';
import { WorkbenchStartPage } from '../../src/workbench/start-page/WorkbenchStartPage';
import {
  WorkbenchContext,
  disabledWorkbenchContext,
} from '../../src/workbench/context';

const documentView: XpertExtensionViewManifest = {
  key: 'document',
  title: { zh_Hans: 'Word 文档', en_US: 'Word document' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  source: { provider: 'tools' },
  workbench: { openMode: 'on-demand' },
  dataSource: { mode: 'platform' },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'document' },
    dataSource: { mode: 'platform' },
  },
};

// Layout and interaction fixture; all actions stay local to this preview.
export function LayoutPreview() {
  const menuPreview = new URLSearchParams(window.location.search).has('menu');
  const [dark, setDark] = useState(false);
  const [sharp, setSharp] = useState(false);
  const [density, setDensity] = useState<ChatKitTheme['density']>('normal');
  const [notice, setNotice] = useState('新标签页');
  return (
    <ThemeProvider
      theme={{
        colorScheme: dark ? 'dark' : 'light',
        radius: sharp ? 'sharp' : 'round',
        density,
      }}
    >
      <WorkbenchContext.Provider
        value={{
          ...disabledWorkbenchContext,
          storageScope: 'start-layout-preview',
          searchUrlTemplate: 'https://example.com/search?q={query}',
        }}
      >
        <main className="flex h-dvh flex-col bg-background text-foreground">
          <header className="flex shrink-0 flex-wrap items-center gap-3 border-b p-3 text-sm">
            <span className="mr-auto" role="status">
              {notice}
            </span>
            <label>
              <input
                type="checkbox"
                checked={dark}
                onChange={(event) => setDark(event.target.checked)}
              />{' '}
              Dark
            </label>
            <label>
              <input
                type="checkbox"
                checked={sharp}
                onChange={(event) => setSharp(event.target.checked)}
              />{' '}
              Sharp
            </label>
            <label>
              Density{' '}
              <select
                value={density}
                onChange={(event) =>
                  setDensity(event.target.value as ChatKitTheme['density'])
                }
              >
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="spacious">Spacious</option>
              </select>
            </label>
          </header>
          <div data-testid="start-panel" className="min-h-0 flex-1">
            <WorkbenchStartPage
              views={
                menuPreview
                  ? [
                      documentView,
                      ...['Word 模板库', '工作簿', 'PDF 预览', '演示文稿'].map(
                        (title, index) => ({
                          ...documentView,
                          key: `document-${index}`,
                          title: { zh_Hans: title, en_US: title },
                        }),
                      ),
                    ]
                  : [documentView]
              }
              recent={[]}
              locale="zh-CN"
              apiUrl="/api/ai"
              loading={false}
              error={null}
              conversationReady
              terminalUnavailable={menuPreview ? 'sandbox_disabled' : undefined}
              sideChatEnabled
              openTabs={[
                {
                  key: 'side',
                  title: 'M200下一单采用已发布方法 1',
                  kind: 'chat',
                  opened: true,
                  onSelect: () => setNotice('已切换到侧边聊天'),
                },
              ]}
              onReload={() => setNotice('已刷新')}
              onSelectView={(key) => setNotice(`打开视图：${key}`)}
              onOpenTool={(tool) => setNotice(`打开功能：${tool}`)}
              onOpenPreview={(preview) => setNotice(`打开：${preview.title}`)}
            />
          </div>
        </main>
      </WorkbenchContext.Provider>
    </ThemeProvider>
  );
}
