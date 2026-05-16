import * as React from 'react';

import { Check, Copy } from 'lucide-react';

import { resolveLocalizedText } from '../../../i18n/localized-text';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import { formatDisplayValue } from '../json-tree-view';
import type { ComponentMessagePartialStepData } from './component-message-renderers';

type ShellStepData = ComponentMessagePartialStepData;
type ShellStepStatus = ShellStepData['status'];

type NamedStepData = ShellStepData & {
  name?: unknown;
};

type SandboxShellTextSource = {
  command?: unknown;
  cmd?: unknown;
  input?: unknown;
  stdout?: unknown;
  stderr?: unknown;
  output?: unknown;
  text?: unknown;
  logs?: unknown;
  content?: unknown;
  chunk?: unknown;
  delta?: unknown;
};

type SandboxShellExitSource = {
  exit_code?: unknown;
  exitCode?: unknown;
  return_code?: unknown;
  returnCode?: unknown;
  code?: unknown;
};

const SANDBOX_SHELL_TEXT_CLASS =
  'text-[13px] leading-5 in-data-[density=compact]:text-xs in-data-[density=compact]:leading-4 in-data-[density=spacious]:text-sm in-data-[density=spacious]:leading-6';
const SANDBOX_SHELL_SECTION_GAP_CLASS =
  'mt-2 in-data-[density=compact]:mt-1.5 in-data-[density=spacious]:mt-3';

function normalizeShellToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized || null;
}

function isPlainObject(value: unknown): value is object {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readShellString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function stringifyShellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') return value;

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const output = value
      .map((item) => stringifyShellText(item))
      .filter((item): item is string => item !== null)
      .join('');
    return output || null;
  }

  if (!isPlainObject(value)) return formatDisplayValue(value);

  const source = value as SandboxShellTextSource;
  const textParts = [
    source.stdout,
    source.stderr,
    source.output,
    source.text,
    source.logs,
    source.content,
    source.chunk,
    source.delta,
  ]
    .map((item) => stringifyShellText(item))
    .filter((item): item is string => item !== null && item.length > 0);

  if (textParts.length > 0) return textParts.join('');

  return null;
}

function getSandboxShellCommand(data: ShellStepData, language: string) {
  const input = data.input;
  if (typeof input === 'string') return input;

  if (isPlainObject(input)) {
    const source = input as SandboxShellTextSource;
    const command =
      readShellString(source.command) ??
      readShellString(source.cmd) ??
      readShellString(source.input);
    if (command) return command;
  }

  const payload = data.data;
  if (isPlainObject(payload)) {
    const source = payload as SandboxShellTextSource;
    const command =
      readShellString(source.command) ??
      readShellString(source.cmd) ??
      readShellString(source.input);
    if (command) return command;
  }

  return (
    readShellString(resolveLocalizedText(data.message, language)) ??
    readShellString(resolveLocalizedText(data.title, language)) ??
    'sandbox_shell'
  );
}

function getSandboxShellOutput(data: ShellStepData) {
  const output =
    stringifyShellText(data.output) ??
    stringifyShellText(data.data) ??
    stringifyShellText(data.error);

  return output ?? '';
}

function readExitCodeFrom(value: unknown): number | null {
  if (!isPlainObject(value)) return null;

  const source = value as SandboxShellExitSource;
  const candidate =
    source.exit_code ??
    source.exitCode ??
    source.return_code ??
    source.returnCode ??
    source.code;

  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate === 'string' && candidate.trim() !== '') {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getSandboxShellExitCode(data: ShellStepData) {
  return (
    readExitCodeFrom(data.output) ??
    readExitCodeFrom(data.data) ??
    readExitCodeFrom(data)
  );
}

export function isSandboxShellStep(data: ShellStepData) {
  const namedData = data as NamedStepData;
  return [data.tool, data.type, data.title, namedData.name].some(
    (value) => normalizeShellToken(value) === 'sandbox_shell',
  );
}

function formatShellCommand(command: string) {
  const trimmed = command.trim();
  return trimmed.startsWith('$') ? trimmed : `$ ${trimmed}`;
}

export function getSandboxShellActivityLabel(
  data: ShellStepData,
  status: ShellStepStatus | undefined,
  language: string,
  t: ReturnType<typeof useChatkitTranslation>['t'],
) {
  const command = getSandboxShellCommand(data, language);
  const key =
    status === 'running'
      ? 'message.toolGroup.shell.runningCommand'
      : 'message.toolGroup.shell.ranCommand';

  return t(key, { command });
}

function ShellCopyButton({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const { t } = useChatkitTranslation();
  const [isCopied, setIsCopied] = React.useState(false);
  const resetTimeoutRef = React.useRef<number | null>(null);

  const clearResetTimeout = React.useCallback(() => {
    if (resetTimeoutRef.current === null) return;
    window.clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = null;
  }, []);

  React.useEffect(() => clearResetTimeout, [clearResetTimeout]);

  const handleCopy = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;

    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setIsCopied(true);
        clearResetTimeout();
        resetTimeoutRef.current = window.setTimeout(() => {
          setIsCopied(false);
          resetTimeoutRef.current = null;
        }, 1500);
      })
      .catch(() => undefined);
  }, [clearResetTimeout, value]);

  const label = isCopied
    ? t('message.toolGroup.copied')
    : t('message.toolGroup.copy');

  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
      aria-label={label}
      title={label}
      onClick={handleCopy}
    >
      {isCopied ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

function SandboxShellStatus({
  data,
  exitCode,
}: {
  data: ShellStepData;
  exitCode: number | null;
}) {
  const { t } = useChatkitTranslation();

  if (exitCode !== null) {
    return (
      <span className="text-muted-foreground/90">
        {t('message.toolGroup.shell.exitCode', { code: exitCode })}
      </span>
    );
  }

  if (data.status === 'running') {
    return (
      <span className="text-muted-foreground/90">
        {t('message.toolGroup.shell.running')}
      </span>
    );
  }

  if (data.status === 'fail' || data.error) {
    return (
      <span className="text-destructive/90">
        {t('message.toolGroup.shell.failed')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground/90">
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
      {t('message.toolGroup.shell.success')}
    </span>
  );
}

export function SandboxShellToolCallCard({ data }: { data: ShellStepData }) {
  const { i18n } = useChatkitTranslation();
  const command = getSandboxShellCommand(data, i18n.language);
  const formattedCommand = formatShellCommand(command);
  const output = getSandboxShellOutput(data);
  const exitCode = getSandboxShellExitCode(data);
  const copyButtonClassName =
    'absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover/shell-copy:opacity-100 group-focus-within/shell-copy:opacity-100 in-data-[density=compact]:right-0.5 in-data-[density=compact]:top-0.5 in-data-[density=compact]:h-5 in-data-[density=compact]:w-5 in-data-[density=spacious]:right-1.5 in-data-[density=spacious]:top-1.5 in-data-[density=spacious]:h-7 in-data-[density=spacious]:w-7';

  return (
    <div
      className="flex max-h-64 min-w-0 flex-col overflow-hidden rounded-md bg-muted/60 px-3 my-1 text-left shadow-sm ring-1 ring-border/30 in-data-[density=compact]:max-h-52 in-data-[density=compact]:px-2 in-data-[density=compact]:py-1.5 in-data-[density=spacious]:max-h-80 in-data-[density=spacious]:px-4 in-data-[density=spacious]:py-3"
      data-slot="sandbox-shell-tool-call"
      aria-label="Shell"
    >
      <div
        className={cn(
          'font-medium text-muted-foreground',
          SANDBOX_SHELL_TEXT_CLASS,
        )}
      >
        Shell
      </div>
      <div
        className={cn(
          'group/shell-copy relative min-w-0',
          SANDBOX_SHELL_SECTION_GAP_CLASS,
        )}
      >
        <pre
          className={cn(
            'whitespace-pre-wrap break-words pr-8 font-mono text-foreground in-data-[density=compact]:pr-6 in-data-[density=spacious]:pr-10',
            SANDBOX_SHELL_TEXT_CLASS,
          )}
          data-slot="sandbox-shell-command"
        >
          {formattedCommand}
        </pre>
        <ShellCopyButton value={command} className={copyButtonClassName} />
      </div>
      {output ? (
        <div
          className={cn(
            'group/shell-copy relative min-h-0 flex-1',
            SANDBOX_SHELL_SECTION_GAP_CLASS,
          )}
        >
          <pre
            className={cn(
              'min-h-0 overflow-auto whitespace-pre pr-8 font-mono text-muted-foreground/85 in-data-[density=compact]:pr-6 in-data-[density=spacious]:pr-10',
              SANDBOX_SHELL_TEXT_CLASS,
            )}
            data-slot="sandbox-shell-output"
          >
            {output}
          </pre>
          <ShellCopyButton value={output} className={copyButtonClassName} />
        </div>
      ) : null}
      <div
        className={cn(
          'mt-3 flex shrink-0 justify-end in-data-[density=compact]:mt-2 in-data-[density=spacious]:mt-4',
          SANDBOX_SHELL_TEXT_CLASS,
        )}
      >
        <SandboxShellStatus data={data} exitCode={exitCode} />
      </div>
    </div>
  );
}
