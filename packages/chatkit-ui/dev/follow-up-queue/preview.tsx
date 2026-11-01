import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plus } from 'lucide-react';
import { ThemeProvider } from '../../src/providers/Theme';
import { PendingFollowUps } from '../../src/components/composer/pending-follow-ups';
import { ChatComposerForm } from '../../src/components/chat/composer/ChatComposerForm';
import { useChatDraft } from '../../src/components/chat/composer/useChatDraft';
import { Button } from '../../src/components/ui/button';
import type { PendingFollowUp } from '../../src/lib/follow-ups';
import {
  getComposerPlainText,
  readComposerPartsFromElement,
} from '../../src/lib/composer-parts';
import '../../src/i18n';
import '../../src/index.css';

const imageUrl =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#222"/><path d="M8 10h28M8 17h24M8 24h30M8 31h20M8 38h26" stroke="#ddd" stroke-width="2"/></svg>',
  );
const firstItem: PendingFollowUp = {
  id: 'first',
  clientMessageId: 'first',
  mode: 'queue',
  createdAt: 1,
  request: {
    id: 'first',
    input: {
      input:
        '这两个 icon buttons 为什么变小了？请调查修复，同类的 icons / buttons 也调查一下',
      references: [
        { id: 'image', type: 'image', name: '截图', text: '', url: imageUrl },
      ],
    },
  },
};
// Isolated presentation preview: all actions update local state only.
function Preview() {
  const draft = useChatDraft();
  const [dark, setDark] = useState(false);
  const [sharp, setSharp] = useState(false);
  const [spacious, setSpacious] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [idle, setIdle] = useState(false);
  const [items, setItems] = useState([firstItem]);
  const [result, setResult] = useState('');
  return (
    <ThemeProvider
      theme={{
        colorScheme: dark ? 'dark' : 'light',
        radius: sharp ? 'sharp' : 'round',
        density: spacious ? 'spacious' : 'compact',
      }}
    >
      <main className="min-h-screen bg-background p-4 text-foreground">
        <nav className="flex flex-wrap items-center gap-4 mb-16">
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
              checked={idle}
              onChange={(e) => setIdle(e.target.checked)}
            />{' '}
            Idle
          </label>
          <Button onClick={() => setItems([firstItem])}>恢复队列</Button>
          <Button
            onClick={() =>
              setItems([
                firstItem,
                ...Array.from(
                  { length: 5 },
                  (_, i): PendingFollowUp => ({
                    id: `extra-${i}`,
                    clientMessageId: `extra-${i}`,
                    mode: 'queue',
                    createdAt: i + 2,
                    request: { input: { input: `后续排队消息 ${i + 1}` } },
                  }),
                ),
              ])
            }
          >
            多条消息
          </Button>
          <span role="status">{result}</span>
        </nav>
        <section
          aria-label="Queue and composer preview"
          className="max-w-full"
          style={{ width: narrow ? 340 : 760 }}
        >
          <PendingFollowUps
            items={items}
            isLoading={!idle}
            onPromoteToSteer={(id) => {
              setResult('已引导');
              setItems(items.filter((item) => item.id !== id));
            }}
            canSendNow={() => idle}
            onSendNow={(id) => {
              setResult('已发送');
              setItems(items.filter((item) => item.id !== id));
            }}
            onEdit={(id) => {
              const item = items.find((item) => item.id === id);
              draft.setComposerText(item?.request.input.input ?? '');
              setItems(items.filter((item) => item.id !== id));
            }}
            onRemove={(id) => setItems(items.filter((item) => item.id !== id))}
          />
          <ChatComposerForm
            onSubmit={(e) => e.preventDefault()}
            editor={{
              inputRef: draft.composerInputRef,
              version: draft.composerDomVersion,
              value: draft.draft,
              children: getComposerPlainText(draft.renderedComposerParts),
              onInput: (e) =>
                draft.commitComposerParts(
                  readComposerPartsFromElement(e.currentTarget, new Map()),
                ),
              focus: draft.focusComposerAt,
              placeholder: '今天帮你做些什么？',
            }}
            leadingActions={
              <Button
                type="button"
                className="pointer-events-auto"
                variant="ghost"
                size="icon"
                aria-label="添加"
              >
                <Plus />
              </Button>
            }
            send={{
              isLoading: !idle,
              onStop: () => setIdle(true),
              sendLabel: '发送',
            }}
          />
        </section>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
