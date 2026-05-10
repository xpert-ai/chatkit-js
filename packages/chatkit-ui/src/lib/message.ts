import type {
  ChatkitMessage,
  TMessageContentComplex,
  TMessageContentComponent,
  TMessageComponentStep,
  TMessageContentReasoning,
  TMessageContentText,
} from '@xpert-ai/chatkit-types'
import { isNil, omitBy } from 'lodash-es'

export type AssistantStreamingStatus = 'loading' | 'thinking' | 'answering'
export const ASSISTANT_STREAM_IDLE_TO_THINKING_MS = 2000

export function hasRenderableReasoning(
  reasoning: ChatkitMessage['reasoning'] | undefined,
): boolean {
  return Array.isArray(reasoning) && reasoning.some((item) => item.text?.trim())
}

export function hasRenderableMessageContent(
  content: ChatkitMessage['content'] | undefined,
): boolean {
  if (typeof content === 'string') {
    return content.trim().length > 0
  }

  if (!Array.isArray(content) || content.length === 0) {
    return false
  }

  const items = content as Array<TMessageContentComplex | string>

  return items.some((item) => {
    if (typeof item === 'string') {
      return item.trim().length > 0
    }

    if (!item || typeof item !== 'object') {
      return false
    }

    if (item.type === 'text') {
      return Boolean((item as TMessageContentText).text?.trim())
    }

    if (item.type === 'reasoning') {
      return Boolean((item as TMessageContentReasoning).text?.trim())
    }

    return true
  })
}

export function hasRenderableAssistantMessage(
  message: Pick<ChatkitMessage, 'content' | 'reasoning'>,
): boolean {
  return (
    hasRenderableMessageContent(message.content) ||
    hasRenderableReasoning(message.reasoning)
  )
}

export function getAssistantStreamingStatus(
  message: Pick<ChatkitMessage, 'status' | 'reasoning'> & {
    lastStreamOutputAt?: number | null
  },
  isStreaming: boolean,
  options?: {
    now?: number
  },
): AssistantStreamingStatus | null {
  if (!isStreaming) {
    return null
  }

  const now = options?.now ?? Date.now()
  const lastStreamOutputAt =
    typeof message.lastStreamOutputAt === 'number'
      ? message.lastStreamOutputAt
      : null
  const isIdle =
    lastStreamOutputAt !== null &&
    now - lastStreamOutputAt >= ASSISTANT_STREAM_IDLE_TO_THINKING_MS

  if (message.status === 'reasoning') {
    return 'thinking'
  }

  if (message.status === 'answering') {
    if (isIdle) {
      return 'thinking'
    }

    return 'answering'
  }

  if (hasRenderableReasoning(message.reasoning)) {
    return 'thinking'
  }

  if (isIdle) {
    return 'thinking'
  }

  return 'loading'
}

/**
 * Append content into AI Message
 *
 * @param aiMessage
 * @param content
 */
export function appendMessageContent(
  aiMessage: ChatkitMessage,
  content: string | TMessageContentComplex,
) {
  aiMessage.status = 'answering'
  const _content = aiMessage.content
  if (typeof content === 'string') {
    if (typeof _content === 'string') {
      aiMessage.content = _content + content
    } else if (Array.isArray(_content)) {
      const lastContent = _content[_content.length - 1]
      if (lastContent.type === 'text') {
        lastContent.text = lastContent.text + content
      } else {
        _content.push({
          type: 'text',
          text: content,
        })
      }
    } else {
      aiMessage.content = content
    }
  } else {
    if ((<TMessageContentReasoning>content).type === 'reasoning') {
      const reasoning = <TMessageContentReasoning>content
      aiMessage.reasoning ??= []
      if (
        aiMessage.reasoning[aiMessage.reasoning.length - 1]?.id === reasoning.id
      ) {
        aiMessage.reasoning[aiMessage.reasoning.length - 1].text +=
          reasoning.text
      } else {
        aiMessage.reasoning.push(reasoning)
      }
      aiMessage.reasoning = Array.from(aiMessage.reasoning)
      aiMessage.status = 'reasoning'

      // if (Array.isArray(_content)) {
      //   const index = _content.findIndex((_) => _.type === 'reasoning' && _.id === content.id)
      //     if (index > -1) {
      //       (<TMessageContentReasoning>_content[index]).text += (<TMessageContentReasoning>content).text
      //     } else {
      //       _content.push(content)
      //     }
      // } else if(_content) {
      //   aiMessage.content = [
      //     {
      //       type: 'text',
      //       text: _content
      //     },
      //     content
      //   ]
      // } else {
      //   aiMessage.content = [
      //     content
      //   ]
      // }
    } else {
      if (Array.isArray(_content)) {
        // Merge text content by id
        if (content.type === 'text' && content.id) {
          const index = _content.findIndex(
            (_) => _.type === 'text' && _.id === content.id,
          )
          if (index > -1) {
            const previousText = _content[index] as TMessageContentText &
              Pick<TMessageContentComplex, 'created_date'>
            _content[index] = {
              ..._content[index],
              ...content,
              id: previousText.id ?? content.id,
              created_date: previousText.created_date ?? content.created_date,
              agentKey: previousText.agentKey ?? content.agentKey,
              xpertName: previousText.xpertName ?? content.xpertName,
              executionId: previousText.executionId ?? content.executionId,
              parentExecutionId:
                previousText.parentExecutionId ?? content.parentExecutionId,
              runId: previousText.runId ?? content.runId,
              text: previousText.text + content.text,
            }
          } else {
            _content.push(content)
          }
        } else {
          const index = _content.findIndex(
            (_) => _.type === 'component' && _.id === content.id,
          )
          if (index > -1) {
            _content[index] = mergeMessageComponent(
              <TMessageContentComponent>_content[index],
              <TMessageContentComponent>content,
            )
          } else {
            _content.push(content)
          }
        }
      } else if (_content) {
        aiMessage.content = [
          {
            type: 'text',
            text: _content,
          },
          content,
        ]
      } else {
        aiMessage.content = [content]
      }
    }
  }
}

type ComponentStepLike = Partial<TMessageComponentStep<unknown>> & {
  category?: string
}

function normalizeStepText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  return normalized || null
}

/**
 * Treat tool names/titles as fallback labels so they do not overwrite a
 * more descriptive message that arrived earlier in the stream.
 */
function isGenericStepMessage(
  message: unknown,
  previousData: ComponentStepLike,
  incomingData: ComponentStepLike,
) {
  const normalizedMessage = normalizeStepText(message)
  if (!normalizedMessage) return false

  return [
    incomingData.tool,
    incomingData.title,
    incomingData.type,
    previousData.tool,
    previousData.title,
    previousData.type,
  ].some((candidate) => normalizeStepText(candidate) === normalizedMessage)
}

/**
 * Keep the existing message when an update omits one or sends only a generic
 * tool identifier; otherwise allow later concrete messages to replace it.
 */
function mergeComponentStepMessage(
  previousData: ComponentStepLike,
  incomingData: ComponentStepLike,
) {
  if (incomingData.message === undefined) {
    return previousData.message
  }

  if (
    previousData.message !== undefined &&
    isGenericStepMessage(incomingData.message, previousData, incomingData)
  ) {
    return previousData.message
  }

  return incomingData.message
}

/**
 * Streaming step updates are partial, so merge new fields while preserving
 * stable metadata that later status/output events may omit.
 */
function mergeComponentStepData(
  previous: TMessageContentComponent['data'],
  incoming: TMessageContentComponent['data'],
): TMessageContentComponent['data'] {
  const previousData = (previous ?? {}) as ComponentStepLike
  const incomingData = omitBy((incoming ?? {}) as ComponentStepLike, isNil)

  return {
    ...previousData,
    ...incomingData,
    type: incomingData.type ?? previousData.type,
    category: incomingData.category ?? previousData.category,
    toolset: incomingData.toolset ?? previousData.toolset,
    toolset_id: incomingData.toolset_id ?? previousData.toolset_id,
    tool: incomingData.tool ?? previousData.tool,
    title: incomingData.title ?? previousData.title,
    message: mergeComponentStepMessage(previousData, incomingData),
    created_date: incomingData.created_date ?? previousData.created_date,
  } as TMessageContentComponent['data']
}

/**
 * Merge repeated component chunks by id without dropping outer metadata such
 * as agent identity, then delegate step-data rules to the data merger.
 */
function mergeMessageComponent(
  previous: TMessageContentComponent,
  incoming: TMessageContentComponent,
): TMessageContentComponent {
  return {
    ...previous,
    ...incoming,
    id: previous.id ?? incoming.id,
    type: previous.type ?? incoming.type,
    agentKey: previous.agentKey ?? incoming.agentKey,
    xpertName: previous.xpertName ?? incoming.xpertName,
    executionId: previous.executionId ?? incoming.executionId,
    parentExecutionId: previous.parentExecutionId ?? incoming.parentExecutionId,
    runId: previous.runId ?? incoming.runId,
    data: mergeComponentStepData(previous.data, incoming.data),
  }
}
