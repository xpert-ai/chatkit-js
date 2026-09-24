import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type {
  ChatKitTheme,
  ChatTaskSummaryOutput,
} from '@xpert-ai/chatkit-types';
import { FileTypeIcon } from '../src/components/task-summary/FileTypeIcon';
import { ThemeProvider } from '../src/providers/Theme';
import { getSurfaceThemeStyle } from '../src/lib/theme-surfaces';
import '../src/index.css';

const examples: Pick<ChatTaskSummaryOutput, 'title' | 'kind' | 'mimeType'>[] = [
  { title: 'Word', kind: 'document', mimeType: 'application/msword' },
  { title: 'Excel / CSV', kind: 'spreadsheet', mimeType: 'text/csv' },
  { title: 'PowerPoint', kind: 'presentation' },
  { title: 'PDF', kind: 'document', mimeType: 'application/pdf' },
  { title: 'JSON', kind: 'file', mimeType: 'application/json' },
  { title: 'Code', kind: 'file', mimeType: 'text/javascript' },
  { title: 'Markdown', kind: 'document', mimeType: 'text/markdown' },
  { title: 'Text', kind: 'file', mimeType: 'text/plain' },
  { title: 'Image', kind: 'image', mimeType: 'image/png' },
  { title: 'Audio', kind: 'file', mimeType: 'audio/mpeg' },
  { title: 'Video', kind: 'file', mimeType: 'video/mp4' },
  { title: 'Archive', kind: 'file', mimeType: 'application/zip' },
  { title: 'File', kind: 'file' },
  { title: 'Web', kind: 'site' },
];

function Preview() {
  const [theme, setTheme] = React.useState<ChatKitTheme>({
    colorScheme: 'light',
    radius: 'soft',
    density: 'normal',
  });
  const choice =
    'rounded-md border border-border px-3 py-1.5 text-sm aria-pressed:bg-foreground aria-pressed:text-background';
  return (
    <ThemeProvider theme={theme}>
      <main
        className="min-h-screen bg-background p-8 text-foreground"
        style={getSurfaceThemeStyle(theme)}
      >
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-semibold">File icon family</h1>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">
            ChatKit delivery cards and output list
          </p>
          <div className="mb-8 flex flex-wrap gap-5">
            <div className="flex gap-2">
              {(['light', 'dark'] as const).map((value) => (
                <button
                  key={value}
                  className={choice}
                  aria-pressed={theme.colorScheme === value}
                  onClick={() => setTheme({ ...theme, colorScheme: value })}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {(['compact', 'normal', 'spacious'] as const).map((value) => (
                <button
                  key={value}
                  className={choice}
                  aria-pressed={theme.density === value}
                  onClick={() => setTheme({ ...theme, density: value })}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {(['sharp', 'soft', 'round', 'pill'] as const).map((value) => (
                <button
                  key={value}
                  className={choice}
                  aria-pressed={theme.radius === value}
                  onClick={() => setTheme({ ...theme, radius: value })}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {examples.map((output) => (
              <div
                key={output.title}
                className="chatkit-delivery-card flex items-center border border-border bg-card"
              >
                <FileTypeIcon output={output} variant="card" />
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {output.title}
                </span>
                <FileTypeIcon output={output} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
