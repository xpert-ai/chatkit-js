import type { ChatkitMessage, TMessageContentComplex, TMessageContentComponent, TMessageContentReasoning, TMessageContentText } from "@xpert-ai/chatkit-types"
import { isNil, omitBy } from "lodash-es"

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
            _content[index] = {
              ..._content[index],
              ...content,
              data: {
                ...(<TMessageContentComponent>_content[index]).data,
                ...omitBy((<TMessageContentComponent>content).data, isNil),
                created_date:
                  (<TMessageContentComponent>_content[index]).data.created_date ||
                  (<TMessageContentComponent>content).data.created_date
              }
            }
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