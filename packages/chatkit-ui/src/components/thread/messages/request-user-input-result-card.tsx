import * as React from 'react';
import {
  REQUEST_USER_INPUT_RESULT_TYPE,
  REQUEST_USER_INPUT_TOOL_NAME,
  isRequestUserInputForm,
  validateUserInputValues,
  type RequestUserInputForm,
  type UserInputValues,
  type ChatkitMessage,
  type RequestUserInputAnswer,
  type TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
import { CheckCircle2, CircleX } from 'lucide-react';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';

type RecordLike = Record<string, unknown>;

export type RequestUserInputResultCardData = {
  toolCallId: string;
  answers: RequestUserInputAnswer[];
  status?: 'submitted' | 'cancelled';
  form?: RequestUserInputForm;
  values?: UserInputValues;
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

function collectPotentialToolCalls(
  messages: ChatkitMessage | ChatkitMessage[],
): unknown[] {
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

type ParsedRequestUserInputResult = {
  answers: RequestUserInputAnswer[];
  hasExplicitType: boolean;
  status?: 'submitted' | 'cancelled';
  form?: RequestUserInputForm;
  values?: UserInputValues;
};

function parseResultOutput(
  output: unknown,
): ParsedRequestUserInputResult | null {
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

  const hasExplicitType = result.type === REQUEST_USER_INPUT_RESULT_TYPE;
  if (hasExplicitType && result.status === 'cancelled') {
    return { answers: [], hasExplicitType, status: 'cancelled' };
  }
  if (
    hasExplicitType &&
    result.schemaVersion === 1 &&
    isRequestUserInputForm(result.form)
  ) {
    const parsed = validateUserInputValues(result.form, result.values);
    if (!parsed.valid) return null;
    return {
      answers: [],
      hasExplicitType,
      status: 'submitted',
      form: result.form,
      values: parsed.values,
    };
  }
  const answers = result.answers.map(normalizeAnswer);
  if (answers.some((answer) => answer === null)) {
    return null;
  }

  return {
    answers: answers as RequestUserInputAnswer[],
    hasExplicitType,
  };
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

  const result = parseResultOutput(data.output);
  if (
    !result ||
    (result.answers.length === 0 &&
      !result.form &&
      result.status !== 'cancelled')
  ) {
    return null;
  }

  if (!result.hasExplicitType) {
    const toolCall = findRequestUserInputClientToolCallById(
      messages,
      content.id,
    );
    if (!toolCall) {
      return null;
    }
  }

  return {
    toolCallId: content.id,
    answers: result.answers,
    ...(result.status ? { status: result.status } : {}),
    ...(result.form ? { form: result.form, values: result.values } : {}),
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
      aria-label={t(
        result.status === 'cancelled'
          ? 'composer.userInputForm.cancelled'
          : result.form
            ? 'composer.userInputForm.answered'
            : 'message.requestUserInputResult.title',
      )}
      className={cn(
        'rounded-chat-panel border border-border bg-muted/25 px-3 py-2.5',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        {result.status === 'cancelled' ? (
          <CircleX className="h-4 w-4 text-muted-foreground" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        )}
        <span>
          {result.status === 'cancelled'
            ? t('composer.userInputForm.cancelled')
            : result.form
              ? result.form.title
              : t('message.requestUserInputResult.title')}
        </span>
      </div>

      <div className="space-y-2">
        {result.form?.fields.map((field) => {
          const value = result.values?.[field.id];
          if (value === undefined) return null;
          const label = (item: string) =>
            field.options?.find((option) => option.value === item)?.label ??
            item;
          const display =
            typeof value === 'boolean'
              ? t(value ? 'composer.hitl.true' : 'composer.hitl.false')
              : Array.isArray(value)
                ? value.map(label).join(', ')
                : typeof value === 'object'
                  ? `${value.start} – ${value.end}`
                  : typeof value === 'string'
                    ? label(value)
                    : String(value);
          return (
            <div key={field.id} className="text-sm">
              <span className="text-muted-foreground">{field.label}: </span>
              <span className="whitespace-pre-wrap break-words">{display}</span>
            </div>
          );
        })}
        {result.answers.map((answer, index) => (
          <div
            key={`${answer.id}-${index}`}
            className="rounded-chat-item bg-background/70 px-2.5 py-2"
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
