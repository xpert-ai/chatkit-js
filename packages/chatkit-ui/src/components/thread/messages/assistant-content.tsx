import * as React from 'react';
import type {
  ChatkitMessage,
  TMessageContentReasoning,
} from '@xpert-ai/chatkit-types';
import {
  buildAssistantRenderTree,
  type AssistantContentEntry,
  type AssistantRenderUnit,
} from '../../../lib/agent-run-render-tree';
import {
  getAssistantPresentation,
  needsProcessAttention,
} from '../../../lib/assistant-presentation';
import { getBubbleContentKind } from '../../../lib/message-presentation';
import { AgentRunGroup } from './agent-run-group';
import { ExternalAssistantRunRow } from './external-assistant-run-row';
import {
  buildToolComponentRenderUnits,
  ToolComponentGroup,
  type ToolComponentRenderUnit,
} from './tool-component-group';
import { getRequestUserInputResultCardData } from './request-user-input-result-card';
import {
  isReasoningContent,
  isComponentContent,
  isMcpAppComponent,
  renderContentItem,
  ReasoningBlock,
} from './assistant-blocks';
import { AssistantProcess } from './assistant-process';
import { MessageBubble } from './message-bubble';
import { BubbleToolResults, hasBubbleToolResult } from './bubble-tool-results';
import type { AssistantContentRenderOptions } from './assistant-content-types';

type MessageRenderUnit =
  | ToolComponentRenderUnit
  | {
      type: 'reasoning-group';
      items: TMessageContentReasoning[];
      startIndex: number;
    };

function groupAdjacentReasoning(
  units: ToolComponentRenderUnit[],
): MessageRenderUnit[] {
  const groups: MessageRenderUnit[] = [];
  for (const unit of units) {
    if (
      unit.type === 'item' &&
      typeof unit.item !== 'string' &&
      isReasoningContent(unit.item)
    ) {
      const previous = groups[groups.length - 1];
      if (previous?.type === 'reasoning-group') {
        previous.items.push(unit.item);
      } else {
        groups.push({
          type: 'reasoning-group',
          items: [unit.item],
          startIndex: unit.index,
        });
      }
    } else {
      groups.push(unit);
    }
  }
  return groups;
}

function renderContentUnit(
  unit: MessageRenderUnit,
  message: ChatkitMessage,
  lookupMessages: ChatkitMessage[],
  hasFollowingItem: boolean,
  options?: AssistantContentRenderOptions,
): React.ReactNode {
  const mode = options?.mode;
  const bubbles = mode === 'bubbles';
  if (unit.type === 'reasoning-group') {
    if (bubbles) return null;
    return (
      <div
        hidden={bubbles}
        key={`reasoning-group-${unit.items[0]?.id ?? unit.startIndex}`}
      >
        {!bubbles && (
          <ReasoningBlock
            reasoning={unit.items}
            isReasoning={
              options?.isReasoning &&
              !hasFollowingItem &&
              !options?.isAgentOutput
            }
          />
        )}
      </div>
    );
  }
  if (unit.type === 'item') {
    const content = unit.item;
    const kind =
      typeof content !== 'string' &&
      isComponentContent(content) &&
      getRequestUserInputResultCardData(content, lookupMessages)
        ? 'rich'
        : getBubbleContentKind(content);
    const hidden = bubbles && (kind === 'process' || kind === 'omitted');
    if (hidden) return null;
    const key =
      typeof content === 'string'
        ? `text-${unit.index}`
        : (content.id ?? `item-${unit.index}`);
    return (
      <MessageBubble
        key={key}
        mode={mode}
        hidden={hidden}
        kind={kind === 'text' || kind === 'media' ? kind : 'rich'}
        data-source-block-id={
          typeof content === 'string' ? undefined : content.id
        }
        data-source-index={unit.index}
      >
        {!hidden &&
          renderContentItem(content, unit.index, message, lookupMessages, {
            ...options,
            isReasoning:
              options?.isReasoning &&
              !hasFollowingItem &&
              !options?.isAgentOutput,
          })}
      </MessageBubble>
    );
  }
  if (bubbles && !unit.items.some(hasBubbleToolResult)) return null;
  return (
    <div
      key={`tool-group-${unit.items[0]?.id ?? unit.startIndex}`}
      className={bubbles ? 'space-y-3 empty:hidden' : undefined}
    >
      {bubbles ? (
        <BubbleToolResults items={unit.items} messageStatus={message.status} />
      ) : (
        <ToolComponentGroup
          items={unit.items}
          hasFollowingItem={hasFollowingItem}
          isThreadRunning={options?.isThreadRunning}
          isThreadPaused={options?.isThreadPaused}
          organizationId={options?.organizationId}
          apiUrl={options?.apiUrl}
        />
      )}
    </div>
  );
}

function renderEntryBatch(
  entries: AssistantContentEntry[],
  message: ChatkitMessage,
  lookupMessages: ChatkitMessage[],
  hasFollowingItem: boolean,
  options?: AssistantContentRenderOptions,
) {
  if (entries.length === 0) return [];

  const renderUnits = groupAdjacentReasoning(
    buildToolComponentRenderUnits(
      entries.map((entry) => entry.item),
      {
        shouldGroupComponent: (item) =>
          getRequestUserInputResultCardData(item, lookupMessages) === null &&
          !isMcpAppComponent(item),
      },
    ),
  );

  return renderUnits.map((unit, index) => {
    const entry = entries[unit.type === 'item' ? unit.index : unit.startIndex];
    const sourceIndex = entry.index;
    const mapped =
      unit.type === 'item'
        ? { ...unit, index: sourceIndex }
        : { ...unit, startIndex: sourceIndex };
    const key =
      unit.type === 'item'
        ? `entry-${entry.source}-${typeof unit.item === 'string' ? sourceIndex : (unit.item.id ?? sourceIndex)}`
        : `${unit.type}-${entry.source}-${unit.items[0]?.id ?? sourceIndex}`;
    return (
      <div
        key={key}
        hidden={options?.hiddenOrders?.has(entry.order)}
        className="empty:hidden"
      >
        {renderContentUnit(
          mapped,
          message,
          lookupMessages,
          index < renderUnits.length - 1 || hasFollowingItem,
          options,
        )}
      </div>
    );
  });
}

function renderAssistantRenderUnits(
  units: AssistantRenderUnit[],
  message: ChatkitMessage,
  lookupMessages: ChatkitMessage[],
  options?: AssistantContentRenderOptions,
  depth = 0,
) {
  const rendered: React.ReactNode[] = [];
  let entryBatch: AssistantContentEntry[] = [];

  const flushEntries = (hasFollowingItem: boolean) => {
    if (entryBatch.length === 0) return;
    const batch = entryBatch;
    entryBatch = [];
    // Keep content as siblings: late reasoning or an agent boundary must not
    // replace the parent of a mounted Widget / MCP App.
    rendered.push(
      ...renderEntryBatch(batch, message, lookupMessages, hasFollowingItem, {
        ...options,
        isAgentOutput: depth > 0,
      }),
    );
  };

  units.forEach((unit, index) => {
    const hasFollowingItem = index < units.length - 1;
    if (unit.type === 'entry') {
      entryBatch.push(unit.entry);
      if (!hasFollowingItem) {
        flushEntries(false);
      }
      return;
    }

    flushEntries(true);
    if (
      unit.node.info.invocationKind === 'external_assistant' &&
      options?.onOpenExternalAssistant
    ) {
      rendered.push(
        <MessageBubble
          key={unit.node.id}
          mode={options.mode}
          hidden={options.hiddenOrders?.has(unit.order)}
        >
          <ExternalAssistantRunRow
            info={unit.node.info}
            onOpen={options.onOpenExternalAssistant}
          />
        </MessageBubble>,
      );
      return;
    }
    rendered.push(
      <MessageBubble
        key={unit.node.id}
        mode={options?.mode}
        hidden={options?.hiddenOrders?.has(unit.order)}
        data-quote-source={unit.node.info.xpertName ?? unit.node.info.title}
      >
        <AgentRunGroup
          mode={options?.mode}
          node={unit.node}
          hasFollowingItem={hasFollowingItem}
          depth={depth}
          renderUnits={(childUnits, nextDepth) =>
            renderAssistantRenderUnits(
              childUnits,
              message,
              lookupMessages,
              options,
              nextDepth,
            )
          }
        />
      </MessageBubble>,
    );
  });

  return rendered;
}

/** One keyed tree for both modes: switching presentation must not remount apps. */
export function AssistantContent({
  message,
  lookupMessages,
  options,
}: {
  message: ChatkitMessage;
  lookupMessages: ChatkitMessage[];
  options: AssistantContentRenderOptions;
}) {
  const tree = buildAssistantRenderTree(message);
  const presentation = getAssistantPresentation(message);
  const canSeparate =
    options.mode !== 'bubbles' &&
    options.collapseProcess &&
    presentation.canSeparate &&
    Boolean(presentation.process.length || options.processPrefix);
  return (
    <AssistantProcess
      enabled={Boolean(canSeparate)}
      running={Boolean(options.isStreaming)}
      forceExpanded={
        needsProcessAttention(message) ||
        (message.status !== 'success' && !options.isStreaming) ||
        Boolean(options.isThreadPaused && message.status !== 'success')
      }
      durationMs={presentation.durationMs}
      process={options.processPrefix}
      renderContent={(expanded) =>
        renderAssistantRenderUnits(tree.units, message, lookupMessages, {
          ...options,
          hiddenOrders:
            canSeparate && !expanded
              ? new Set(presentation.process.map((unit) => unit.order))
              : undefined,
        })
      }
    />
  );
}
