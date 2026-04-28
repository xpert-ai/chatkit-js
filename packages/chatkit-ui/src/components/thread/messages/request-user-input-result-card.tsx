import * as React from 'react';
import {
  REQUEST_USER_INPUT_TOOL_NAME,
  type ChatkitMessage,
  type RequestUserInputAnswer,
  type TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
import { CheckCircle2 } from 'lucide-react';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';

type RecordLike = Record<string, unknown>;

export type RequestUserInputResultCardData = {
  toolCallId: string;
  answers: RequestUserInputAnswer[];
};

function isRecord(value: unknown): value is RecordLike {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: RecordLike, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getToolCallId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return readString(value, ['id']);
}

function getToolCallName(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return readString(value, ['name']);
}

function pushClientToolCallsFromRecord(record: RecordLike, calls: unknown[]) {
  const clientToolCalls = record.clientToolCalls;
  if (Array.isArray(clientToolCalls)) {
    calls.push(...clientToolCalls);
  }
}

function collectPotentialToolCalls(messages: ChatkitMessage | ChatkitMessage[]): unknown[] {
  const calls: unknown[] = [];
  const messageList = Array.isArray(messages) ? messages : [messages];

  for (const message of messageList) {
    const rawMessage = message as unknown as RecordLike;

    pushClientToolCallsFromRecord(rawMessage, calls);
  }

  return calls;
}

export function findRequestUserInputClientToolCallById(
  messages: ChatkitMessage | ChatkitMessage[],
  id: string | undefined,
) {
  if (!id) return null;

  return (
    collectPotentialToolCalls(messages).find(
      (call) =>
        getToolCallId(call) === id &&
        getToolCallName(call) === REQUEST_USER_INPUT_TOOL_NAME,
    ) ?? null
  );
}

function normalizeAnswer(value: unknown): RequestUserInputAnswer | null {
  if (!isRecord(value)) return null;

  const id = readString(value, ['id']);
  const question = readString(value, ['question']);
  const answerValue = readString(value, ['value']);
  const type = readString(value, ['type']);
  if (
    !id ||
    !question ||
    !answerValue ||
    (type !== 'option' && type !== 'other')
  ) {
    return null;
  }

  const label = readString(value, ['label']);
  const description = readString(value, ['description']);

  return {
    id,
    question,
    value: answerValue,
    type,
    ...(label ? { label } : {}),
    ...(description ? { description } : {}),
  };
}

function parseResultOutput(output: unknown): RequestUserInputAnswer[] | null {
  let result = output;

  if (typeof output === 'string') {
    try {
      result = JSON.parse(output);
    } catch {
      return null;
    }
  }

  if (!isRecord(result) || !Array.isArray(result.answers)) {
    return null;
  }

  const answers = result.answers.map(normalizeAnswer);
  if (answers.some((answer) => answer === null)) {
    return null;
  }

  return answers as RequestUserInputAnswer[];
}

export function getRequestUserInputResultCardData(
  content: TMessageContentComponent,
  messages: ChatkitMessage | ChatkitMessage[],
): RequestUserInputResultCardData | null {
  const data = isRecord((content as { data?: unknown }).data)
    ? ((content as { data?: unknown }).data as RecordLike)
    : null;
  if (data?.status !== 'success') {
    return null;
  }

  const toolCall = findRequestUserInputClientToolCallById(messages, content.id);
  if (!toolCall) {
    return null;
  }

  const answers = parseResultOutput(data.output);
  if (!answers || answers.length === 0) {
    return null;
  }

  return {
    toolCallId: content.id,
    answers,
  };
}

export function RequestUserInputResultCard({
  result,
  className,
}: {
  result: RequestUserInputResultCardData;
  className?: string;
}) {
  const { t } = useChatkitTranslation();

  return (
    <section
      aria-label={t('message.requestUserInputResult.title')}
      className={cn(
        'rounded-lg border border-border bg-muted/25 px-3 py-2.5',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span>{t('message.requestUserInputResult.title')}</span>
      </div>

      <div className="space-y-2">
        {result.answers.map((answer, index) => (
          <div
            key={`${answer.id}-${index}`}
            className="rounded-md bg-background/70 px-2.5 py-2"
          >
            <div className="text-xs font-medium leading-5 text-muted-foreground">
              {answer.question}
            </div>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="min-w-0 wrap-break-word text-sm font-semibold text-foreground">
                {answer.label ?? answer.value}
              </span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {t(
                  answer.type === 'other'
                    ? 'message.requestUserInputResult.other'
                    : 'message.requestUserInputResult.option',
                )}
              </span>
            </div>
            {answer.description ? (
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                {answer.description}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
