import type { ToolCall } from '@langchain/core/messages/tool';
import {
  REQUEST_USER_INPUT_RESULT_PURPOSE_IMPLEMENTATION_CONFIRMATION,
  REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION,
  REQUEST_USER_INPUT_TOOL_NAME,
  isClientToolRequest,
  isLangGraphInterruptPayload,
  type ClientToolMessageInput,
  type ClientToolRequest,
  type LangGraphInterruptPayload,
  type RequestUserInputQuestion,
  type RequestUserInputResultPurpose,
  type RequestUserInputToolArgs,
} from '@xpert-ai/chatkit-types';
import type React from 'react';
import { createMessageId } from '../../../lib/utils';
import type { ParentMessenger } from '../../ParentMessenger';
import { findLatestAssistantMessageIndex } from '../messages/reducer';
import type { ChatKitAIMessage, StateType } from '../types';

export function normalizeClientToolRequest(
  value: unknown,
): ClientToolRequest | null {
  return isClientToolRequest(value) ? value : null;
}

export function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeRequestUserInputParams(
  value: unknown,
): RequestUserInputToolArgs | null {
  if (!value || typeof value !== 'object') return null;

  const questions = (value as { questions?: unknown }).questions;
  if (
    !Array.isArray(questions) ||
    questions.length < 1 ||
    questions.length > 3
  ) {
    return null;
  }

  const normalizedQuestions: RequestUserInputQuestion[] = [];
  for (const question of questions) {
    if (!question || typeof question !== 'object') return null;

    const rawQuestion = question as {
      id?: unknown;
      header?: unknown;
      question?: unknown;
      options?: unknown;
    };
    const id = readTrimmedString(rawQuestion.id);
    const header = readTrimmedString(rawQuestion.header);
    const questionText = readTrimmedString(rawQuestion.question);
    if (!id || !header || !questionText) return null;

    const options = rawQuestion.options;
    if (!Array.isArray(options) || options.length < 2 || options.length > 3) {
      return null;
    }

    const normalizedOptions = options.map((option) => {
      if (!option || typeof option !== 'object') return null;
      const rawOption = option as {
        label?: unknown;
        description?: unknown;
      };
      const label = readTrimmedString(rawOption.label);
      if (!label || typeof rawOption.description !== 'string') return null;

      return {
        label,
        description: rawOption.description.trim(),
      };
    });

    if (normalizedOptions.some((option) => option === null)) return null;

    normalizedQuestions.push({
      id,
      header,
      question: questionText,
      options: normalizedOptions as RequestUserInputQuestion['options'],
    });
  }

  return { questions: normalizedQuestions };
}

export function normalizeRequestUserInputToolCall(
  call: ToolCall,
): RequestUserInputToolArgs | null {
  if (call.name !== REQUEST_USER_INPUT_TOOL_NAME) {
    return null;
  }

  return normalizeRequestUserInputParams(call.args);
}

export function getRequestUserInputResultPurpose(
  params: RequestUserInputToolArgs,
): RequestUserInputResultPurpose {
  const questions = params.questions;

  if (questions.length === 1 && questions[0]?.id === 'implement_plan') {
    return REQUEST_USER_INPUT_RESULT_PURPOSE_IMPLEMENTATION_CONFIRMATION;
  }

  return REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION;
}

export function collectClientToolRequests(
  payload: unknown,
): ClientToolRequest[] {
  if (!isLangGraphInterruptPayload(payload)) return [];

  const requests: ClientToolRequest[] = [];
  const interruptPayload: LangGraphInterruptPayload = payload;
  for (const task of interruptPayload.tasks) {
    for (const interrupt of task.interrupts) {
      const request = normalizeClientToolRequest(interrupt.value);
      if (request) requests.push(request);
    }
  }

  return requests;
}

export function getToolCallIdentity(call: ToolCall): string {
  return typeof call.id === 'string' && call.id.trim()
    ? call.id
    : `${call.name}:${JSON.stringify(call.args ?? {})}`;
}

export function mergeClientToolCalls(
  existing: unknown,
  incoming: ToolCall[],
): ToolCall[] {
  const calls = Array.isArray(existing) ? ([...existing] as ToolCall[]) : [];
  const seen = new Set(calls.map(getToolCallIdentity));

  for (const call of incoming) {
    const key = getToolCallIdentity(call);
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push(call);
  }

  return calls;
}

export function collectClientToolCalls(payload: unknown): ToolCall[] {
  return collectClientToolRequests(payload).flatMap(
    (request) => request.clientToolCalls ?? [],
  );
}

export function rememberClientToolCalls(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  calls: ToolCall[],
) {
  if (calls.length === 0) return;

  setValues((prev) => {
    const messages = prev.messages ?? [];
    const lastAssistantIndex = findLatestAssistantMessageIndex(messages);

    if (lastAssistantIndex < 0) {
      return {
        ...prev,
        messages: [
          ...messages,
          {
            id: createMessageId(),
            type: 'ai',
            content: '',
            clientToolCalls: calls,
          } as ChatKitAIMessage,
        ],
      };
    }

    const nextMessages = [...messages];
    const lastAssistantMessage = nextMessages[lastAssistantIndex] as
      | (ChatKitAIMessage & { clientToolCalls?: ToolCall[] })
      | undefined;

    if (!lastAssistantMessage) return prev;

    nextMessages[lastAssistantIndex] = {
      ...lastAssistantMessage,
      clientToolCalls: mergeClientToolCalls(
        lastAssistantMessage.clientToolCalls,
        calls,
      ),
    } as ChatKitAIMessage;

    return { ...prev, messages: nextMessages };
  });
}

export function normalizeToolMessagesResponse(
  response: unknown,
): ClientToolMessageInput | null {
  if (!response) return null;
  if (typeof response === 'object' && response !== null) {
    const raw = response as ClientToolMessageInput;
    return {
      tool_call_id: raw.tool_call_id,
      name: raw.name,
      content: raw.content,
      status: raw.status,
      artifact: raw.artifact,
    };
  }
  return null;
}

export async function resolveClientToolCallResponse(
  call: ToolCall,
  {
    isParentAvailable,
    sendCommand,
    waitForRequestUserInput,
  }: {
    isParentAvailable: boolean;
    sendCommand: ParentMessenger['sendCommand'];
    waitForRequestUserInput: (
      call: ToolCall,
      params: RequestUserInputToolArgs,
    ) => Promise<ClientToolMessageInput>;
  },
): Promise<unknown | null> {
  const requestUserInputParams = normalizeRequestUserInputToolCall(call);
  if (requestUserInputParams) {
    return waitForRequestUserInput(call, requestUserInputParams);
  }

  if (!isParentAvailable) {
    return null;
  }

  return sendCommand('onClientToolCall', {
    name: call.name,
    params: call.args,
    id: call.id,
  });
}
