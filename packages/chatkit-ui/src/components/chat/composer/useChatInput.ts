import type {
  ChatKitImageReference,
  ToolOption,
} from '@xpert-ai/chatkit-types';
import * as React from 'react';
import {
  createComposerTextParts,
  findAdjacentComposerToken,
  getComposerEditingLength,
  getComposerEditingText,
  getComposerSelectionOffset,
  getComposerSelectionOffsets,
  getComposerTokenPartMap,
  readComposerPartsFromElement,
  replaceComposerRange,
} from '../../../lib/composer-parts';
import { mergeReferences } from '../../../lib/references';
import {
  buildPastedImageReference,
  LONG_TEXT_REFERENCE_THRESHOLD,
  readImageDimensions,
} from '../files/file-utils';
import type { useChatFiles } from '../files/useChatFiles';
import type { useChatGoal } from '../goal/useChatGoal';
import type { useRuntimeCapabilitiesState } from '../runtime-capabilities';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import { getThreadMention } from './draft-utils';
import type { useChatCapabilities } from './useChatCapabilities';
import type { useChatCommands } from './useChatCommands';
import type { useChatDraft } from './useChatDraft';
import type { useChatSubmission } from './useChatSubmission';

type ChatInputOptions = Pick<
  ReturnType<typeof useChatDraft>,
  | 'composerPartsRef'
  | 'commitComposerParts'
  | 'setThreadMention'
  | 'isComposerComposingRef'
  | 'composerInputRef'
  | 'threadMention'
  | 'threadMentionPaletteRef'
  | 'setSelectedTool'
> &
  Pick<
    ReturnType<typeof useRuntimeCapabilitiesState>,
    'setRuntimeCapabilityPalette' | 'runtimeCapabilityPalette'
  > &
  Pick<
    ReturnType<typeof useChatCapabilities>,
    'updateRuntimeCapabilityPalette'
  > &
  Pick<
    ReturnType<typeof useChatCommands>,
    | 'slashPaletteOptions'
    | 'selectSlashPaletteOption'
    | 'executeSlashCommandFromDraft'
  > &
  Pick<ReturnType<typeof useChatEnvironment>, 'stream' | 'composer'> &
  Pick<ReturnType<typeof useChatGoal>, 'submitGoalModeDraft'> &
  Pick<ReturnType<typeof useChatSubmission>, 'submitDraft'> &
  Pick<
    ReturnType<typeof useChatFiles>,
    | 'queueAttachmentFiles'
    | 'references'
    | 'setIsUploadingReferenceImages'
    | 'uploadContextFile'
    | 'setReferences'
  > & {
    isSendDisabled: boolean;
    canUploadAttachments: boolean;
  };

export function useChatInput({
  composerPartsRef,
  commitComposerParts,
  setThreadMention,
  setRuntimeCapabilityPalette,
  updateRuntimeCapabilityPalette,
  isComposerComposingRef,
  composerInputRef,
  threadMention,
  threadMentionPaletteRef,
  runtimeCapabilityPalette,
  slashPaletteOptions,
  selectSlashPaletteOption,
  isSendDisabled,
  stream,
  executeSlashCommandFromDraft,
  submitGoalModeDraft,
  submitDraft,
  canUploadAttachments,
  queueAttachmentFiles,
  composer,
  references,
  setIsUploadingReferenceImages,
  uploadContextFile,
  setReferences,
  setSelectedTool,
}: ChatInputOptions) {
  const syncComposerInputFromElement = React.useCallback(
    (input: HTMLDivElement) => {
      const previousCapabilities = getComposerTokenPartMap(
        composerPartsRef.current,
      );
      const nextParts = readComposerPartsFromElement(
        input,
        previousCapabilities,
      );
      const selectionOffset =
        getComposerSelectionOffsets(input)?.end ??
        getComposerEditingLength(nextParts);
      commitComposerParts(nextParts, {
        caretOffset: selectionOffset,
        resetDom: false,
      });
      const nextMention = getThreadMention(
        getComposerEditingText(nextParts),
        selectionOffset,
      );
      setThreadMention(nextMention);
      if (nextMention) {
        setRuntimeCapabilityPalette(null);
      } else {
        updateRuntimeCapabilityPalette(nextParts, selectionOffset);
      }
    },
    [
      commitComposerParts,
      setRuntimeCapabilityPalette,
      updateRuntimeCapabilityPalette,
    ],
  );

  const handleComposerInput = React.useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      if (isComposerComposingRef.current) return;

      syncComposerInputFromElement(event.currentTarget);
    },
    [syncComposerInputFromElement],
  );

  const handleComposerCompositionStart = React.useCallback(() => {
    isComposerComposingRef.current = true;
  }, []);

  const handleComposerCompositionEnd = React.useCallback(
    (event: React.CompositionEvent<HTMLDivElement>) => {
      isComposerComposingRef.current = false;
      syncComposerInputFromElement(event.currentTarget);
    },
    [syncComposerInputFromElement],
  );

  const handleComposerSelect = React.useCallback(() => {
    const selectionOffset = composerInputRef.current
      ? getComposerSelectionOffset(composerInputRef.current)
      : undefined;
    if (typeof selectionOffset === 'number') {
      const mention = getThreadMention(
        getComposerEditingText(composerPartsRef.current),
        selectionOffset,
      );
      setThreadMention(mention);
      if (mention) {
        setRuntimeCapabilityPalette(null);
        return;
      }
    }
    updateRuntimeCapabilityPalette(composerPartsRef.current, selectionOffset);
  }, [setRuntimeCapabilityPalette, updateRuntimeCapabilityPalette]);

  const handleComposerKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    // Embedded token buttons keep their native keyboard activation.
    if (event.target instanceof Element && event.target.closest('button'))
      return;
    if (event.nativeEvent.isComposing || isComposerComposingRef.current) return;
    if (threadMention) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setThreadMention(null);
        return;
      }

      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Tab'
      ) {
        event.preventDefault();
        threadMentionPaletteRef.current?.moveActive(
          event.key === 'ArrowUp' ? -1 : 1,
        );
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        threadMentionPaletteRef.current?.selectActive();
        return;
      }
    }

    if (runtimeCapabilityPalette) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setRuntimeCapabilityPalette(null);
        return;
      }

      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Tab'
      ) {
        event.preventDefault();
        if (slashPaletteOptions.length === 0) {
          return;
        }
        setRuntimeCapabilityPalette((previous) => {
          if (!previous) {
            return previous;
          }
          const direction = event.key === 'ArrowUp' ? -1 : 1;
          const nextIndex =
            (previous.activeIndex + direction + slashPaletteOptions.length) %
            slashPaletteOptions.length;
          return { ...previous, activeIndex: nextIndex };
        });
        return;
      }

      if (event.key === 'Enter') {
        const option =
          slashPaletteOptions[runtimeCapabilityPalette.activeIndex];
        if (option) {
          event.preventDefault();
          selectSlashPaletteOption(option);
          return;
        }
      }
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      const input = composerInputRef.current;
      const selection = input ? getComposerSelectionOffsets(input) : null;
      if (selection && selection.start === selection.end) {
        const adjacentCapability = findAdjacentComposerToken(
          composerPartsRef.current,
          selection.start,
          event.key === 'Backspace' ? 'before' : 'after',
        );
        if (adjacentCapability) {
          event.preventDefault();
          const nextCaret =
            event.key === 'Backspace'
              ? Math.max(0, selection.start - 1)
              : selection.start;
          commitComposerParts(
            composerPartsRef.current.filter(
              (part) =>
                part.type === 'text' || part.key !== adjacentCapability.key,
            ),
            { caretOffset: nextCaret, resetDom: true },
          );
          setRuntimeCapabilityPalette(null);
          return;
        }
      }
    }

    if (event.key !== 'Enter') {
      return;
    }
    if (event.shiftKey) {
      event.preventDefault();
      const input = composerInputRef.current;
      const selection = input
        ? getComposerSelectionOffsets(input)
        : {
            start: getComposerEditingLength(composerPartsRef.current),
            end: getComposerEditingLength(composerPartsRef.current),
          };
      const start =
        selection?.start ?? getComposerEditingLength(composerPartsRef.current);
      const end =
        selection?.end ?? getComposerEditingLength(composerPartsRef.current);
      const nextParts = replaceComposerRange(
        composerPartsRef.current,
        start,
        end,
        createComposerTextParts('\n'),
      );
      commitComposerParts(nextParts, {
        caretOffset: start + 1,
        resetDom: true,
      });
      updateRuntimeCapabilityPalette(nextParts, start + 1);
      return;
    }
    if (event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (isSendDisabled) {
      return;
    }

    if (stream.isLoading) {
      if (executeSlashCommandFromDraft()) {
        return;
      }
      if (submitGoalModeDraft()) {
        return;
      }
      submitDraft();
      return;
    }

    if (executeSlashCommandFromDraft()) {
      return;
    }
    if (submitGoalModeDraft()) {
      return;
    }
    submitDraft();
  };

  const handleComposerPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      const clipboardFiles = Array.from(clipboardData.files ?? []);
      const pastedFiles = clipboardFiles.length
        ? clipboardFiles
        : Array.from(clipboardData.items ?? [])
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile())
            .filter((item): item is File => Boolean(item));
      const attachmentFiles = pastedFiles.filter(
        (file) => !file.type.startsWith('image/'),
      );
      if (attachmentFiles.length > 0) {
        event.preventDefault();
        if (canUploadAttachments) queueAttachmentFiles(attachmentFiles);
      }
      const imageFiles = pastedFiles.filter((file) =>
        file.type.startsWith('image/'),
      );

      if (imageFiles.length > 0) {
        event.preventDefault();

        const maxCount = composer?.attachments?.maxCount ?? 10;
        const maxSize = composer?.attachments?.maxSize ?? 100 * 1024 * 1024;
        const currentImageReferenceCount = references.filter(
          (reference) => reference.type === 'image',
        ).length;
        const availableSlots = Math.max(
          0,
          maxCount - currentImageReferenceCount,
        );
        const nextFiles = imageFiles
          .filter((file) => file.size <= maxSize)
          .slice(0, availableSlots);

        if (nextFiles.length === 0) {
          return;
        }

        setIsUploadingReferenceImages(true);
        void Promise.allSettled(
          nextFiles.map(async (file) => {
            const [dimensions, uploadedFile] = await Promise.all([
              readImageDimensions(file),
              uploadContextFile(file),
            ]);

            return buildPastedImageReference(file, uploadedFile, dimensions);
          }),
        )
          .then((results) => {
            const nextReferences = results
              .filter(
                (
                  result,
                ): result is PromiseFulfilledResult<ChatKitImageReference> =>
                  result.status === 'fulfilled',
              )
              .map((result) => result.value);

            if (nextReferences.length > 0) {
              setReferences((previous) =>
                mergeReferences(previous, nextReferences),
              );
              composerInputRef.current?.focus();
            }

            results
              .filter(
                (result): result is PromiseRejectedResult =>
                  result.status === 'rejected',
              )
              .forEach((result) => {
                console.warn(
                  '[Chat] Failed to upload pasted image reference:',
                  result.reason,
                );
              });
          })
          .finally(() => {
            setIsUploadingReferenceImages(false);
          });

        return;
      }

      if (attachmentFiles.length > 0) return;

      const pastedText = clipboardData.getData('text/plain');
      if (pastedText.trim().length <= LONG_TEXT_REFERENCE_THRESHOLD) {
        if (!pastedText) {
          return;
        }
        event.preventDefault();
        const input = composerInputRef.current;
        const selection = input
          ? getComposerSelectionOffsets(input)
          : {
              start: getComposerEditingLength(composerPartsRef.current),
              end: getComposerEditingLength(composerPartsRef.current),
            };
        const nextParts = replaceComposerRange(
          composerPartsRef.current,
          selection?.start ??
            getComposerEditingLength(composerPartsRef.current),
          selection?.end ?? getComposerEditingLength(composerPartsRef.current),
          createComposerTextParts(pastedText),
        );
        const caretOffset =
          (selection?.start ??
            getComposerEditingLength(composerPartsRef.current)) +
          pastedText.length;
        commitComposerParts(nextParts, { caretOffset, resetDom: true });
        updateRuntimeCapabilityPalette(nextParts, caretOffset);
        return;
      }

      event.preventDefault();
      setReferences((previous) =>
        mergeReferences(previous, [
          {
            type: 'quote',
            source: 'Pasted text',
            text: pastedText,
          },
        ]),
      );
      composerInputRef.current?.focus();
    },
    [
      canUploadAttachments,
      composer?.attachments?.maxCount,
      composer?.attachments?.maxSize,
      commitComposerParts,
      queueAttachmentFiles,
      references,
      updateRuntimeCapabilityPalette,
      uploadContextFile,
    ],
  );

  const handleToolSelect = (tool: ToolOption) => {
    setSelectedTool((prev) => (prev?.id === tool.id ? null : tool));
  };

  const handlePromptClick = React.useCallback(
    (prompt: string) => {
      submitDraft({ inputText: prompt, displayText: prompt });
    },
    [submitDraft],
  );
  return {
    handlePromptClick,
    handleComposerInput,
    handleComposerCompositionStart,
    handleComposerCompositionEnd,
    handleComposerSelect,
    handleComposerPaste,
    handleComposerKeyDown,
    handleToolSelect,
  };
}
