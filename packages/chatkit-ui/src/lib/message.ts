import type {
  ChatkitMessage,
  TMessageContentComplex,
  TMessageContentComponent,
  TMessageComponentStep,
  TMessageContentReasoning,
  TMessageContentText,
} from "@xpert-ai/chatkit-types"
import { isNil, omitBy } from "lodash-es"

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
export function appendMessageContent(aiMessage: ChatkitMessage, content: string | TMessageContentComplex) {
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
          text: content
        })
      }
    } else {
      aiMessage.content = content
    }
  } else {
    if ((<TMessageContentReasoning>content).type === 'reasoning') {
      const reasoning = <TMessageContentReasoning>content
      aiMessage.reasoning ??= []
      if (aiMessage.reasoning[aiMessage.reasoning.length - 1]?.id === reasoning.id) {
        aiMessage.reasoning[aiMessage.reasoning.length - 1].text += reasoning.text
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
          const index = _content.findIndex((_) => _.type === 'text' && _.id === content.id)
          if (index > -1) {
            _content[index] = {
              ..._content[index],
              text: (<TMessageContentText>_content[index]).text + content.text
            }
          } else {
            _content.push(content)
          }
        } else {
          const index = _content.findIndex((_) => _.type === 'component' && _.id === content.id)
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
            text: _content
          },
          content
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

function mergeComponentStepData(
  previous: TMessageContentComponent['data'],
  incoming: TMessageContentComponent['data'],
): TMessageContentComponent['data'] {
  const previousData = (previous ?? {}) as ComponentStepLike
  const incomingData = omitBy((incoming ?? {}) as ComponentStepLike, isNil)

  return {
    ...previousData,
    ...incomingData,
    type: previousData.type ?? incomingData.type,
    category: previousData.category ?? incomingData.category,
    toolset: previousData.toolset ?? incomingData.toolset,
    toolset_id: previousData.toolset_id ?? incomingData.toolset_id,
    tool: previousData.tool ?? incomingData.tool,
    title: previousData.title ?? incomingData.title,
    created_date: previousData.created_date ?? incomingData.created_date,
  } as TMessageContentComponent['data']
}

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
    data: mergeComponentStepData(previous.data, incoming.data),
  }
}
