import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../../src/providers/Theme';
import { FileChangeReview } from '../../src/workbench/file-review/FileChangeReview';
import { ReviewFileContent } from '../../src/workbench/file-review/ReviewFileContent';
import type {
  FileReviewEntry,
  FileChangeReviewOptions,
} from '../../src/workbench/file-review/file-change-review';
import { initI18n } from '../../src/i18n';
import '../../src/index.css';

initI18n().changeLanguage('zh-CN');
const revision = (text: string) => ({
  text,
  size: text.length,
  sha256: 'a'.repeat(64),
});
const entry = (
  path: string,
  before: string | null,
  after: string | null,
): FileReviewEntry => ({
  key: path,
  path,
  report: {
    schema: 'xpert.file-change.v1',
    workspacePath: path,
    before: before === null ? null : revision(before),
    after: after === null ? null : revision(after),
  },
});
const before = `import { createContext } from 'react';\nimport type { VoiceCall } from './types';\nimport type { VoiceServerControl } from './server';\n\nexport class VoiceRuntime {\n  private started = false;\n  private context?: AudioContext;\n\n  constructor() {\n    this.started = false;\n  }\n\n  async start() {\n    this.started = true;\n    this.context = new AudioContext();\n    await this.context.resume();\n  }\n\n  async stop() {\n    this.started = false;\n    await this.context?.close();\n  }\n}\n`;
const entries = [
  entry(
    'apps/desktop/src/voice/call-sounds.ts',
    null,
    `/** Sounds for the voice call lifecycle. */\nexport class CallSounds {\n  private context?: AudioContext;\n\n  async play(frequency = 440) {\n    this.context ??= new AudioContext();\n    await this.context.resume();\n    const oscillator = this.context.createOscillator();\n    const gain = this.context.createGain();\n    oscillator.frequency.value = frequency;\n    gain.gain.value = 0.15;\n    oscillator.connect(gain);\n    gain.connect(this.context.destination);\n    oscillator.start();\n    oscillator.stop(this.context.currentTime + 0.2);\n  }\n}\n`,
  ),
  entry(
    'apps/desktop/src/voice/runtime.ts',
    before,
    before
      .replace(
        '\n\nexport class',
        "\nimport { CallSounds } from './call-sounds';\n\nexport class",
      )
      .replace(
        'private started = false;',
        'private started = false;\n  private sounds = new CallSounds();',
      )
      .replace(
        'this.started = true;',
        'this.started = true;\n    await this.sounds.play(660);',
      ),
  ),
  entry(
    'apps/desktop/src/voice/VoiceProvider.tsx',
    `import * as React from 'react';\n\nexport function VoiceProvider({ children }) {\n  const [active, setActive] = React.useState(false);\n  return <div data-active={active}>{children}</div>;\n}\n`,
    `import * as React from 'react';\n\nexport function VoiceProvider({ children }) {\n  const [active, setActive] = React.useState(true);\n  return <section data-active={active}>{children}</section>;\n}\n`,
  ),
  entry(
    'docs/voice.md',
    '# Voice calls\n\nStart a conversation.\n',
    '# Voice calls\n\nStart a conversation with **live audio**.\n\n- Mute your microphone\n- End the call\n',
  ),
  entry(
    'dev/preview/index.html',
    null,
    '<!doctype html>\n<html lang="zh-CN">\n  <head><meta charset="UTF-8" /><title>语音浮层拖回归</title></head>\n  <body style="margin:0">\n    <div id="window-wrapper" style="position:relative;width:100vw;height:100vh">\n      <div id="root" style="position:relative;isolation:isolate">语音通话预览</div>\n    </div>\n  </body>\n</html>\n',
  ),
];
function Preview() {
  const [dark, setDark] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState<FileReviewEntry | null>(null);
  const options = React.useMemo<FileChangeReviewOptions>(
    () => ({
      selected: { type: 'file_change_set', changes: [] },
      load: async (scope) =>
        scope === 'selected'
          ? entries
          : [...entries, { key: 'missing', path: 'assets/audio.bin' }],
      openFile: setSnapshot,
    }),
    [],
  );
  return (
    <ThemeProvider theme={dark ? 'dark' : 'light'}>
      <main className="h-screen bg-background text-foreground flex flex-col">
        <div className="flex h-10 shrink-0 items-center gap-5 border-b px-4 text-sm">
          <button onClick={() => setSnapshot(null)}>查看变更</button>
          {snapshot && (
            <button onClick={() => setSnapshot(null)}>{snapshot.path} ×</button>
          )}
          <button className="ml-auto" onClick={() => setDark(!dark)}>
            切换主题
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {snapshot ? (
            <ReviewFileContent
              path={snapshot.path}
              text={
                (snapshot.report?.after ?? snapshot.report?.before)?.text ?? ''
              }
            />
          ) : (
            <FileChangeReview options={options} />
          )}
        </div>
      </main>
    </ThemeProvider>
  );
}
const root = createRoot(document.getElementById('root')!);
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
