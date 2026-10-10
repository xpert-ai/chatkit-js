import type {
  ChatKitThreadReference,
  ToolOption,
} from '@xpert-ai/chatkit-types';
import * as React from 'react';
import {
  createComposerTextParts,
  getComposerEditingLength,
  getComposerPlainText,
  normalizeComposerParts,
  replaceComposerRange,
  setComposerSelectionOffset,
  type ComposerPart,
} from '../../../lib/composer-parts';
import { getReferenceKey } from '../../../lib/references';
import type { RuntimeCapabilityOption } from '../../../lib/runtime-capabilities';
import type { ThreadMentionPaletteHandle } from '../../composer/ThreadMentionPalette';
import {
  getRemovedComposerCapabilityParts,
  removeComposerCapabilityPartsFromSelection,
  type useRuntimeCapabilitiesState,
} from '../runtime-capabilities';
import type { ThreadMentionState } from './draft-utils';

type ChatDraftOptions = Partial<
  Pick<
    ReturnType<typeof useRuntimeCapabilitiesState>,
    'setRunRuntimeCapabilities' | 'setRuntimeCapabilityPalette'
  >
>;

export function useChatDraft({
  setRunRuntimeCapabilities,
  setRuntimeCapabilityPalette,
}: ChatDraftOptions = {}) {
  const [composerParts, setComposerParts] = React.useState<ComposerPart[]>([]);
  const [renderedComposerParts, setRenderedComposerParts] = React.useState<
    ComposerPart[]
  >([]);

  const [composerDomVersion, setComposerDomVersion] = React.useState(0);
  const [selectedTool, setSelectedTool] = React.useState<ToolOption | null>(
    null,
  );

  const [threadMention, setThreadMention] =
    React.useState<ThreadMentionState | null>(null);

  const composerInputRef = React.useRef<HTMLDivElement>(null);
  const isComposerComposingRef = React.useRef(false);
  const threadMentionPaletteRef =
    React.useRef<ThreadMentionPaletteHandle>(null);

  const composerPartsRef = React.useRef<ComposerPart[]>([]);
  const pendingComposerCaretOffsetRef = React.useRef<number | null>(null);
  const draft = React.useMemo(
    () => getComposerPlainText(composerParts),
    [composerParts],
  );

  const trimmedDraft = draft.trim();
  const onComposerCapabilityRemovedRef = React.useRef<
    (option: RuntimeCapabilityOption) => void
  >(() => undefined);

  const commitComposerParts = React.useCallback(
    (
      nextParts: ComposerPart[],
      options?: {
        caretOffset?: number | null;
        resetDom?: boolean;
        syncRemovedCapabilityTokens?: boolean;
      },
    ) => {
      const normalized = normalizeComposerParts(nextParts);
      const previous = composerPartsRef.current;
      composerPartsRef.current = normalized;

      if (typeof options?.caretOffset === 'number') {
        pendingComposerCaretOffsetRef.current = options.caretOffset;
      }

      if (options?.syncRemovedCapabilityTokens ?? true) {
        const removedCapabilities = getRemovedComposerCapabilityParts(
          previous,
          normalized,
        );

        if (removedCapabilities.length > 0) {
          removedCapabilities.forEach((part) =>
            onComposerCapabilityRemovedRef.current(part.capability),
          );
          setRunRuntimeCapabilities?.((selection) =>
            removeComposerCapabilityPartsFromSelection(
              selection,
              removedCapabilities,
            ),
          );
        }
      }

      setComposerParts(normalized);
      if (options?.resetDom) {
        setRenderedComposerParts(normalized);
        setComposerDomVersion((version) => version + 1);
      }
    },
    [setRunRuntimeCapabilities],
  );

  const setComposerText = React.useCallback(
    (text: string, caretOffset = text.length) => {
      commitComposerParts(createComposerTextParts(text), {
        caretOffset,
        resetDom: true,
        syncRemovedCapabilityTokens: true,
      });
    },
    [commitComposerParts],
  );

  const focusComposerAt = React.useCallback((position?: number) => {
    const nextPosition =
      position ?? getComposerEditingLength(composerPartsRef.current);
    pendingComposerCaretOffsetRef.current = nextPosition;
    requestAnimationFrame(() => {
      const input = composerInputRef.current;
      if (!input) {
        return;
      }
      pendingComposerCaretOffsetRef.current = null;
      setComposerSelectionOffset(input, nextPosition);
    });
  }, []);

  React.useLayoutEffect(() => {
    composerPartsRef.current = composerParts;
    const caretOffset = pendingComposerCaretOffsetRef.current;
    if (typeof caretOffset === 'number') {
      pendingComposerCaretOffsetRef.current = null;
      const input = composerInputRef.current;
      if (input) {
        setComposerSelectionOffset(input, caretOffset);
      }
    }
  }, [composerDomVersion, composerParts]);

  const selectThreadMention = React.useCallback(
    (reference: ChatKitThreadReference) => {
      const mention = threadMention;
      if (!mention) return;
      const part: ComposerPart = {
        type: 'thread',
        key: getReferenceKey(reference),
        reference,
      };
      commitComposerParts(
        replaceComposerRange(
          composerPartsRef.current,
          mention.start,
          mention.end,
          [part, ...createComposerTextParts(' ')],
        ),
        {
          caretOffset: mention.start + 2,
          resetDom: true,
        },
      );
      setThreadMention(null);
      setRuntimeCapabilityPalette?.(null);
      focusComposerAt(mention.start + 2);
    },
    [
      threadMention,
      commitComposerParts,
      setRuntimeCapabilityPalette,
      focusComposerAt,
    ],
  );

  const removeThreadToken = React.useCallback(
    (key: string) => {
      commitComposerParts(
        composerPartsRef.current.filter(
          (part) => part.type !== 'thread' || part.key !== key,
        ),
        { resetDom: true },
      );
      focusComposerAt();
    },
    [commitComposerParts, focusComposerAt],
  );
  return {
    selectedTool,
    composerParts,
    composerPartsRef,
    commitComposerParts,
    setThreadMention,
    setSelectedTool,
    composerInputRef,
    focusComposerAt,
    setComposerText,
    trimmedDraft,
    isComposerComposingRef,
    draft,
    onComposerCapabilityRemovedRef,
    threadMention,
    threadMentionPaletteRef,
    selectThreadMention,
    composerDomVersion,
    renderedComposerParts,
    removeThreadToken,
  };
}
