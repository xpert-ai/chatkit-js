import * as React from 'react';
import { ChevronRight } from 'lucide-react';

import { cn } from '../../lib/utils';

export type JsonObject = { [key: string]: JsonValue };
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonObject;

export type DetectedJsonValue =
  | {
      kind: 'json';
      value: JsonValue;
      raw: string;
    }
  | {
      kind: 'text';
      text: string;
    };

export function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

export function formatDisplayValue(value: unknown) {
  return typeof value === 'string' ? value : safeJson(value);
}

export function isJsonObjectValue(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function canUseAsJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(canUseAsJsonValue);
  }

  if (typeof value === 'object') {
    return Object.values(value).every(canUseAsJsonValue);
  }

  return false;
}

export function toJsonValue(value: unknown): JsonValue | null {
  if (canUseAsJsonValue(value)) return value;

  try {
    const raw = JSON.stringify(value);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return canUseAsJsonValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseJsonString(value: string): JsonValue | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const first = trimmed[0];
  if (first !== '{' && first !== '[') return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return canUseAsJsonValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function detectJsonValue(value: unknown): DetectedJsonValue {
  if (typeof value === 'string') {
    const parsed = parseJsonString(value);
    if (parsed !== null) {
      return {
        kind: 'json',
        value: parsed,
        raw: safeJson(parsed),
      };
    }

    return { kind: 'text', text: value };
  }

  const jsonValue = toJsonValue(value);
  if (jsonValue !== null && typeof jsonValue === 'object') {
    return {
      kind: 'json',
      value: jsonValue,
      raw: safeJson(jsonValue),
    };
  }

  return { kind: 'text', text: formatDisplayValue(value) };
}

export function getJsonValueSummary(value: JsonValue) {
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (isJsonObjectValue(value)) {
    return `Object(${Object.keys(value).length})`;
  }

  return 'JSON';
}

function formatJsonPrimitive(value: string | number | boolean | null) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function JsonTreeNode({
  label,
  value,
  depth = 0,
}: {
  label?: string;
  value: JsonValue;
  depth?: number;
}) {
  const isArray = Array.isArray(value);
  const isObject = isJsonObjectValue(value);
  const isExpandable = isArray || isObject;
  const [isExpanded, setIsExpanded] = React.useState(depth < 2);

  if (!isExpandable) {
    return (
      <div className="flex min-w-0 gap-2 leading-6">
        {label ? (
          <span className="shrink-0 font-medium text-foreground/80">
            {label}:
          </span>
        ) : null}
        <span
          className={cn(
            'min-w-0 wrap-break-word',
            typeof value === 'string'
              ? 'text-emerald-700'
              : typeof value === 'number'
                ? 'text-blue-700'
                : typeof value === 'boolean'
                  ? 'text-purple-700'
                  : 'text-muted-foreground',
          )}
        >
          {formatJsonPrimitive(value)}
        </span>
      </div>
    );
  }

  const entries = isArray
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);
  const summary = isArray ? `Array(${value.length})` : `Object(${entries.length})`;

  return (
    <div className="min-w-0">
      <button
        type="button"
        className="flex min-w-0 items-center gap-1 leading-6 text-left hover:text-foreground"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90',
          )}
        />
        {label ? (
          <span className="min-w-0 truncate font-medium text-foreground/80">
            {label}:
          </span>
        ) : null}
        <span className="shrink-0 text-muted-foreground">{summary}</span>
      </button>
      {isExpanded ? (
        <div className="ml-4 border-l border-border/70 pl-3">
          {entries.map(([entryLabel, entryValue]) => (
            <JsonTreeNode
              key={entryLabel}
              label={entryLabel}
              value={entryValue}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function JsonTreeView({
  value,
  className,
}: {
  value: JsonValue;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 font-mono text-[11px]', className)}>
      <JsonTreeNode value={value} />
    </div>
  );
}

export function RawJsonBlock({ raw }: { raw: string }) {
  return (
    <pre className="whitespace-pre-wrap wrap-break-word font-mono text-[11px]">
      {raw}
    </pre>
  );
}

export function PlainTextBlock({
  value,
  destructive = false,
}: {
  value: string;
  destructive?: boolean;
}) {
  return (
    <pre
      className={cn(
        'whitespace-pre-wrap wrap-break-word',
        destructive && 'text-destructive',
      )}
    >
      {value}
    </pre>
  );
}
