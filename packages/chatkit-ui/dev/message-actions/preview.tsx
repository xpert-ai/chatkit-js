import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatKitTheme, ChatSkillUsage } from '@xpert-ai/chatkit-types';
import { ThemeProvider } from '../../src/providers/Theme';
import { MessageActions } from '../../src/components/thread/MessageActions';
import { MarkdownText } from '../../src/components/thread/markdown-text';
import { SandboxShellToolCallCard } from '../../src/components/thread/messages/sandbox-shell-tool-call';
import { ToolCallValueBlock } from '../../src/components/thread/messages/tool-call-output';
import '../../src/i18n';
import '../../src/index.css';

const skills: ChatSkillUsage[] = [
  {
    skillId: 'review',
    name: 'Review',
    version: '1',
    source: { type: 'project', id: 'preview' },
    activation: 'read',
    toolCallId: 'preview-call',
    loadedAt: '2026-11-01T00:00:00Z',
  },
];
// Synthetic controls only: no Assistant connection or API calls.
function Preview() {
  const [density, setDensity] = useState<ChatKitTheme['density']>('compact');
  const [dark, setDark] = useState(true);
  const [sharp, setSharp] = useState(false);
  const [smallText, setSmallText] = useState(true);
  return (
    <ThemeProvider
      theme={{
        colorScheme: dark ? 'dark' : 'light',
        radius: sharp ? 'sharp' : 'soft',
        density,
        typography: { baseSize: smallText ? 14 : 16 },
      }}
    >
      <main className="min-h-screen bg-background p-6 text-foreground">
        <nav className="flex flex-wrap gap-4 mb-8">
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
              checked={smallText}
              onChange={(e) => setSmallText(e.target.checked)}
            />{' '}
            14px type
          </label>
          {(['compact', 'normal', 'spacious'] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="density"
                checked={density === value}
                onChange={() => setDensity(value)}
              />{' '}
              {value}
            </label>
          ))}
        </nav>
        <section
          className="max-w-2xl space-y-6"
          aria-label="Message actions preview"
        >
          <div>
            <p>Assistant: copy, retry, branch and skills</p>
            <MessageActions
              content="Preview answer"
              isAssistant
              alwaysVisible
              onRetry={() => {}}
              onBranch={() => {}}
              branching={{ available: true }}
              skillUsages={skills}
            />
          </div>
          <div>
            <p>User: copy and edit</p>
            <MessageActions
              content="Preview question"
              alwaysVisible
              onEdit={() => {}}
            />
          </div>
          <div>
            <p>Pending branch / unavailable retry</p>
            <MessageActions
              content="Preview pending"
              isAssistant
              alwaysVisible
              onRetry={() => {}}
              retryDisabled
              onBranch={() => {}}
              branching={{ available: true }}
              isBranching
            />
          </div>
          <MarkdownText>{'```js\nconsole.log("Example");\n```'}</MarkdownText>
          <ToolCallValueBlock value={{ result: 'Example output' }} />
          <SandboxShellToolCallCard
            data={{
              title: 'sandbox_shell',
              input: { cmd: 'echo preview' },
              output: { stdout: 'preview', exit_code: 0 },
              status: 'success',
            }}
          />
        </section>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
