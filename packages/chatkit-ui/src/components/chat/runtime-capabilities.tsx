import * as React from 'react';
import { X } from 'lucide-react';
import type { Client } from '@xpert-ai/xpert-sdk';
import { createMessageId } from '../../lib/utils';
import { isRuntimeCapabilitiesSelection } from '../../lib/message-metadata';
import {
  createEmptyRuntimeCapabilitiesSelection,
  createDefaultRuntimeCapabilitiesSelection,
  createRuntimeCapabilitiesForSubmit,
  getRecommendedRuntimeCapabilitiesSelection,
  getRuntimeCapabilityColor,
  getRuntimeCapabilityOptions,
  isRuntimeCapabilitySelected,
  mergeRuntimeCapabilitiesSelections,
  toggleRuntimeCapabilitySelection,
  type RuntimeCapabilitiesSelection,
  type RuntimeCapabilityOption,
} from '../../lib/runtime-capabilities';
import {
  hasMissingRuntimeCapabilityReferences,
  loadConversationRuntimeCapabilities,
  persistConversationRuntimeCapabilities as persistRuntimeCapabilitiesToConversation,
  type MissingRuntimeCapabilityReferences,
} from '../../lib/conversation-runtime-capabilities';
import {
  createComposerCapabilityPart,
  createComposerTextParts,
  getComposerCapabilityKeys,
  getComposerCapabilitySelectionKeys,
  getComposerEditingLength,
  getComposerEditingText,
  getComposerSelectionOffset,
  getRuntimeCapabilityOptionKey,
  removeComposerCapabilityTokens,
  replaceComposerRange,
  type ComposerCapabilityPart,
  type ComposerPart,
} from '../../lib/composer-parts';
import {
  resolveRuntimeCapabilityPalette,
  type RuntimeCapabilitiesWithCommands,
  type RuntimeCapabilityPaletteState,
} from '../../lib/slash-commands';
import { RuntimeCapabilityIcon } from '../runtime-capability-icon';

export type RuntimeCapabilitiesForSubmit = {
  runtimeCapabilitiesForSubmit: RuntimeCapabilitiesSelection | null;
  runtimeCapabilityOptionsForMessage: RuntimeCapabilityOption[];
};

type CommitComposerParts = (
  nextParts: ComposerPart[],
  options?: {
    caretOffset?: number | null;
    resetDom?: boolean;
    syncRemovedCapabilityTokens?: boolean;
  },
) => void;

type RuntimeCapabilitiesStateParams = {
  client: Client<unknown> | null | undefined;
  assistantId: string | null | undefined;
  threadId: string | null | undefined;
  disabled: boolean;
  composerParts: ComposerPart[];
};

type RuntimeCapabilitiesComposerActionsParams = {
  runtimeCapabilities: RuntimeCapabilitiesWithCommands | null;
  runtimeCapabilitiesReady: boolean;
  runtimeCapabilityOptions: RuntimeCapabilityOption[];
  setRunRuntimeCapabilities: React.Dispatch<
    React.SetStateAction<RuntimeCapabilitiesSelection>
  >;
  setRuntimeCapabilityPalette: React.Dispatch<
    React.SetStateAction<RuntimeCapabilityPaletteState | null>
  >;
  applyExternalRuntimeCapabilities: (
    selection: RuntimeCapabilitiesSelection | null,
  ) => void;
  composerInputRef: React.RefObject<HTMLDivElement | null>;
  composerPartsRef: React.MutableRefObject<ComposerPart[]>;
  commitComposerParts: CommitComposerParts;
  focusComposerAt: (position?: number) => void;
};

function createComposerCapabilityInsertionParts(
  options: RuntimeCapabilityOption[],
): ComposerPart[] {
  return options.flatMap((option) => [
    createComposerCapabilityPart(option, createMessageId()),
    ...(option.type === 'skill' ? createComposerTextParts(' ') : []),
  ]);
}

function getHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}

function warnMissingRuntimeCapabilityReferences(
  action: string,
  missing: MissingRuntimeCapabilityReferences,
) {
  if (!hasMissingRuntimeCapabilityReferences(missing)) {
    return;
  }

  console.warn(
    `[Chat] Runtime capabilities ${action} include unavailable references:`,
    missing,
  );
}

export function getRuntimeCapabilityPaletteEmptyLabelKey(
  palette: RuntimeCapabilityPaletteState,
  runtimeCapabilitiesReady: boolean,
): string {
  if (!palette.capabilityTypes || palette.capabilityTypes.length !== 1) {
    return 'composer.capabilities.emptySearch';
  }

  if (!runtimeCapabilitiesReady) {
    return 'composer.slashCommands.empty.loadingCapabilities';
  }

  const hasQuery = palette.query.trim().length > 0;
  const capabilityType = palette.capabilityTypes[0];
  if (capabilityType === 'skill') {
    return hasQuery
      ? 'composer.slashCommands.empty.matchingSkills'
      : 'composer.slashCommands.empty.skills';
  }

  if (capabilityType === 'plugin') {
    return hasQuery
      ? 'composer.slashCommands.empty.matchingPlugins'
      : 'composer.slashCommands.empty.plugins';
  }

  return hasQuery
    ? 'composer.slashCommands.empty.matchingSubAgents'
    : 'composer.slashCommands.empty.subAgents';
}

export function getRuntimeCapabilityOptionsForSelection(
  selection: RuntimeCapabilitiesSelection | null | undefined,
  options: RuntimeCapabilityOption[],
): RuntimeCapabilityOption[] {
  if (!selection) {
    return [];
  }

  return options.filter((option) =>
    isRuntimeCapabilitySelected(selection, option.type, option.id),
  );
}

export function removeComposerCapabilityPartsFromSelection(
  selection: RuntimeCapabilitiesSelection,
  removedCapabilities: ComposerCapabilityPart[],
): RuntimeCapabilitiesSelection {
  let nextSelection = selection;
  for (const part of removedCapabilities) {
    nextSelection = toggleRuntimeCapabilitySelection(
      nextSelection,
      part.capability.type,
      part.capability.id,
      false,
    );
  }
  return nextSelection;
}

export function getRemovedComposerCapabilityParts(
  previousParts: ComposerPart[],
  nextParts: ComposerPart[],
): ComposerCapabilityPart[] {
  const nextKeys = getComposerCapabilityKeys(nextParts);
  return previousParts.filter(
    (part): part is ComposerCapabilityPart =>
      part.type === 'capability' && !nextKeys.has(part.key),
  );
}

export function useRuntimeCapabilitiesState({
  client,
  assistantId,
  threadId,
  disabled,
  composerParts,
}: RuntimeCapabilitiesStateParams) {
  const [runtimeCapabilities, setRuntimeCapabilities] =
    React.useState<RuntimeCapabilitiesWithCommands | null>(null);
  const [runtimeCapabilitiesReady, setRuntimeCapabilitiesReady] =
    React.useState(false);
  const [sessionRuntimeCapabilities, setSessionRuntimeCapabilities] =
    React.useState<RuntimeCapabilitiesSelection>(() =>
      createEmptyRuntimeCapabilitiesSelection(),
    );
  const [runRuntimeCapabilities, setRunRuntimeCapabilities] =
    React.useState<RuntimeCapabilitiesSelection>(() =>
      createEmptyRuntimeCapabilitiesSelection(),
    );
  const [runtimeCapabilityPalette, setRuntimeCapabilityPalette] =
    React.useState<RuntimeCapabilityPaletteState | null>(null);
  const runtimeCapabilityPreferenceLoadRef = React.useRef(0);
  const pendingExternalRuntimeCapabilitiesRef =
    React.useRef<RuntimeCapabilitiesSelection | null>(null);

  const runtimeCapabilityOptions = React.useMemo(
    () => getRuntimeCapabilityOptions(runtimeCapabilities),
    [runtimeCapabilities],
  );

  const effectiveSessionRuntimeCapabilities = React.useMemo(
    () =>
      runtimeCapabilitiesReady && runtimeCapabilities
        ? mergeRuntimeCapabilitiesSelections(
            runtimeCapabilities,
            sessionRuntimeCapabilities,
          )
        : null,
    [runtimeCapabilities, runtimeCapabilitiesReady, sessionRuntimeCapabilities],
  );

  const runRuntimeCapabilityOptions = React.useMemo(
    () =>
      runtimeCapabilityOptions.filter((option) =>
        isRuntimeCapabilitySelected(
          runRuntimeCapabilities,
          option.type,
          option.id,
        ),
      ),
    [runRuntimeCapabilities, runtimeCapabilityOptions],
  );

  const composerRuntimeCapabilitySelectionKeys = React.useMemo(
    () => getComposerCapabilitySelectionKeys(composerParts),
    [composerParts],
  );

  const detachedRunRuntimeCapabilityOptions = React.useMemo(
    () =>
      runRuntimeCapabilityOptions.filter(
        (option) =>
          !composerRuntimeCapabilitySelectionKeys.has(
            getRuntimeCapabilityOptionKey(option),
          ),
      ),
    [composerRuntimeCapabilitySelectionKeys, runRuntimeCapabilityOptions],
  );

  const persistSessionRuntimeCapabilities = React.useCallback(
    async (
      nextThreadId: string,
      selection: RuntimeCapabilitiesSelection | null | undefined,
    ) => {
      if (!runtimeCapabilities || !selection || !client) {
        return;
      }

      try {
        const result = await persistRuntimeCapabilitiesToConversation({
          client,
          threadId: nextThreadId,
          capabilities: runtimeCapabilities,
          selection,
        });
        warnMissingRuntimeCapabilityReferences(
          'persisted selection',
          result.missing,
        );
      } catch (error) {
        console.warn(
          '[Chat] Failed to persist runtime capabilities selection:',
          error,
        );
      }
    },
    [client, runtimeCapabilities],
  );

  const applyExternalRuntimeCapabilities = React.useCallback(
    (selection: RuntimeCapabilitiesSelection | null) => {
      pendingExternalRuntimeCapabilitiesRef.current = selection;
      setRunRuntimeCapabilities(() => {
        const emptySelection =
          createEmptyRuntimeCapabilitiesSelection(runtimeCapabilities);
        if (!selection) {
          return emptySelection;
        }
        if (!runtimeCapabilities) {
          return selection;
        }

        pendingExternalRuntimeCapabilitiesRef.current = null;
        return mergeRuntimeCapabilitiesSelections(
          runtimeCapabilities,
          emptySelection,
          selection,
        );
      });
    },
    [runtimeCapabilities],
  );

  const handleSessionRuntimeCapabilityToggle = React.useCallback(
    (type: RuntimeCapabilityOption['type'], id: string, selected: boolean) => {
      setSessionRuntimeCapabilities((previous) => {
        const nextSelection = toggleRuntimeCapabilitySelection(
          previous,
          type,
          id,
          selected,
        );

        const normalizedThreadId = threadId?.trim();
        if (normalizedThreadId) {
          void persistSessionRuntimeCapabilities(
            normalizedThreadId,
            nextSelection,
          );
        }

        return nextSelection;
      });
    },
    [persistSessionRuntimeCapabilities, threadId],
  );

  const addRunRuntimeCapabilities = React.useCallback(
    (selection: RuntimeCapabilitiesSelection) => {
      setRunRuntimeCapabilities((previous) =>
        runtimeCapabilities
          ? mergeRuntimeCapabilitiesSelections(
              runtimeCapabilities,
              previous,
              selection,
            )
          : previous,
      );
    },
    [runtimeCapabilities],
  );

  const resetRunRuntimeCapabilities = React.useCallback(() => {
    setRunRuntimeCapabilities(
      createEmptyRuntimeCapabilitiesSelection(runtimeCapabilities),
    );
    setRuntimeCapabilityPalette(null);
  }, [runtimeCapabilities]);

  const getRuntimeCapabilitiesForSubmit = React.useCallback(
    (
      recommended?: RuntimeCapabilitiesSelection | null,
    ): RuntimeCapabilitiesForSubmit => {
      const recommendedRuntimeCapabilitiesForSubmit =
        recommended && runtimeCapabilities && runtimeCapabilitiesReady
          ? mergeRuntimeCapabilitiesSelections(
              runtimeCapabilities,
              runRuntimeCapabilities,
              recommended,
            )
          : runRuntimeCapabilities;
      const runtimeCapabilitiesForSubmit =
        runtimeCapabilities && runtimeCapabilitiesReady
          ? createRuntimeCapabilitiesForSubmit({
              capabilities: runtimeCapabilities,
              available: effectiveSessionRuntimeCapabilities,
              recommended: recommendedRuntimeCapabilitiesForSubmit,
            })
          : null;
      const runtimeCapabilityOptionsForMessage =
        getRuntimeCapabilityOptionsForSelection(
          getRecommendedRuntimeCapabilitiesSelection(
            runtimeCapabilitiesForSubmit,
          ),
          runtimeCapabilityOptions,
        );

      return {
        runtimeCapabilitiesForSubmit,
        runtimeCapabilityOptionsForMessage,
      };
    },
    [
      effectiveSessionRuntimeCapabilities,
      runRuntimeCapabilities,
      runtimeCapabilities,
      runtimeCapabilitiesReady,
      runtimeCapabilityOptions,
    ],
  );

  const getRuntimeCapabilitiesForCommand = React.useCallback(
    (recommended?: RuntimeCapabilitiesSelection | null) =>
      runtimeCapabilities && runtimeCapabilitiesReady
        ? createRuntimeCapabilitiesForSubmit({
            capabilities: runtimeCapabilities,
            available: effectiveSessionRuntimeCapabilities,
            recommended,
          })
        : (recommended ?? null),
    [
      effectiveSessionRuntimeCapabilities,
      runtimeCapabilities,
      runtimeCapabilitiesReady,
    ],
  );

  React.useEffect(() => {
    if (disabled || !client || !assistantId) {
      pendingExternalRuntimeCapabilitiesRef.current = null;
      setRuntimeCapabilities(null);
      setRuntimeCapabilitiesReady(false);
      setSessionRuntimeCapabilities(createEmptyRuntimeCapabilitiesSelection());
      setRunRuntimeCapabilities(createEmptyRuntimeCapabilitiesSelection());
      setRuntimeCapabilityPalette(null);
      return;
    }

    const controller = new AbortController();

    setRuntimeCapabilitiesReady(false);
    setRuntimeCapabilities(null);
    setRuntimeCapabilityPalette(null);

    void client.assistants
      .getRuntimeCapabilities(assistantId, {
        signal: controller.signal,
      })
      .then((payload) => {
        setRuntimeCapabilities(payload);
        setRuntimeCapabilitiesReady(true);
        setSessionRuntimeCapabilities(
          createDefaultRuntimeCapabilitiesSelection(payload),
        );
        setRunRuntimeCapabilities(
          createEmptyRuntimeCapabilitiesSelection(payload),
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (getHttpStatus(error) === 404) {
          setRuntimeCapabilities(null);
          setRuntimeCapabilitiesReady(false);
          setSessionRuntimeCapabilities(
            createEmptyRuntimeCapabilitiesSelection(),
          );
          setRunRuntimeCapabilities(createEmptyRuntimeCapabilitiesSelection());
          return;
        }
        console.warn('[Chat] Failed to load runtime capabilities:', error);
        setRuntimeCapabilities(null);
        setRuntimeCapabilitiesReady(false);
        setSessionRuntimeCapabilities(
          createEmptyRuntimeCapabilitiesSelection(),
        );
        setRunRuntimeCapabilities(createEmptyRuntimeCapabilitiesSelection());
      });

    return () => controller.abort();
  }, [assistantId, client, disabled]);

  React.useEffect(() => {
    const emptyRunSelection =
      createEmptyRuntimeCapabilitiesSelection(runtimeCapabilities);
    const pendingExternalSelection =
      pendingExternalRuntimeCapabilitiesRef.current;

    if (pendingExternalSelection && runtimeCapabilities) {
      setRunRuntimeCapabilities(
        mergeRuntimeCapabilitiesSelections(
          runtimeCapabilities,
          emptyRunSelection,
          pendingExternalSelection,
        ),
      );
      pendingExternalRuntimeCapabilitiesRef.current = null;
    } else {
      setRunRuntimeCapabilities(pendingExternalSelection ?? emptyRunSelection);
    }

    if (!runtimeCapabilitiesReady || !runtimeCapabilities || !client) {
      setSessionRuntimeCapabilities(
        createEmptyRuntimeCapabilitiesSelection(runtimeCapabilities),
      );
      return;
    }

    const defaultSelection =
      createDefaultRuntimeCapabilitiesSelection(runtimeCapabilities);
    const normalizedThreadId = threadId?.trim();
    if (!normalizedThreadId) {
      setSessionRuntimeCapabilities(defaultSelection);
      return;
    }

    let cancelled = false;
    const requestId = runtimeCapabilityPreferenceLoadRef.current + 1;
    runtimeCapabilityPreferenceLoadRef.current = requestId;
    setSessionRuntimeCapabilities(defaultSelection);

    void loadConversationRuntimeCapabilities({
      client,
      threadId: normalizedThreadId,
      capabilities: runtimeCapabilities,
    })
      .then(({ selection, missing }) => {
        if (
          cancelled ||
          runtimeCapabilityPreferenceLoadRef.current !== requestId
        ) {
          return;
        }

        warnMissingRuntimeCapabilityReferences('loaded selection', missing);
        setSessionRuntimeCapabilities(selection ?? defaultSelection);
      })
      .catch((error: unknown) => {
        if (
          cancelled ||
          runtimeCapabilityPreferenceLoadRef.current !== requestId
        ) {
          return;
        }
        console.warn(
          '[Chat] Failed to load persisted runtime capabilities selection:',
          error,
        );
        setSessionRuntimeCapabilities(defaultSelection);
      });

    return () => {
      cancelled = true;
    };
  }, [
    client,
    runtimeCapabilities,
    runtimeCapabilitiesReady,
    threadId,
  ]);

  return {
    runtimeCapabilities,
    runtimeCapabilitiesReady,
    runtimeCapabilityOptions,
    effectiveSessionRuntimeCapabilities,
    runRuntimeCapabilities,
    runRuntimeCapabilityOptions,
    detachedRunRuntimeCapabilityOptions,
    runtimeCapabilityPalette,
    setRunRuntimeCapabilities,
    setRuntimeCapabilityPalette,
    applyExternalRuntimeCapabilities,
    handleSessionRuntimeCapabilityToggle,
    addRunRuntimeCapabilities,
    resetRunRuntimeCapabilities,
    getRuntimeCapabilitiesForSubmit,
    getRuntimeCapabilitiesForCommand,
    persistSessionRuntimeCapabilities,
  };
}

export function useRuntimeCapabilityComposerActions({
  runtimeCapabilities,
  runtimeCapabilitiesReady,
  runtimeCapabilityOptions,
  setRunRuntimeCapabilities,
  setRuntimeCapabilityPalette,
  applyExternalRuntimeCapabilities,
  composerInputRef,
  composerPartsRef,
  commitComposerParts,
  focusComposerAt,
}: RuntimeCapabilitiesComposerActionsParams) {
  const pendingExternalRuntimeCapabilityInsertRef = React.useRef<{
    selection: RuntimeCapabilitiesSelection;
    insertAt?: number | null;
  } | null>(null);

  const insertExternalRuntimeCapabilities = React.useCallback(
    (
      selection: RuntimeCapabilitiesSelection | null,
      options?: { insertAt?: number | null },
    ) => {
      applyExternalRuntimeCapabilities(selection);
      if (!selection) {
        pendingExternalRuntimeCapabilityInsertRef.current = null;
        return;
      }

      if (!runtimeCapabilitiesReady || !runtimeCapabilities) {
        pendingExternalRuntimeCapabilityInsertRef.current = {
          selection,
          insertAt: options?.insertAt ?? null,
        };
        return;
      }

      pendingExternalRuntimeCapabilityInsertRef.current = null;
      const existingKeys = getComposerCapabilitySelectionKeys(
        composerPartsRef.current,
      );
      const selectedOptions = runtimeCapabilityOptions.filter(
        (option) =>
          isRuntimeCapabilitySelected(selection, option.type, option.id) &&
          !existingKeys.has(getRuntimeCapabilityOptionKey(option)),
      );

      if (selectedOptions.length === 0) {
        focusComposerAt();
        return;
      }

      const currentParts = composerPartsRef.current;
      const editingLength = getComposerEditingLength(currentParts);
      const insertAt =
        typeof options?.insertAt === 'number'
          ? Math.max(0, Math.min(options.insertAt, editingLength))
          : editingLength;
      const replacementParts =
        createComposerCapabilityInsertionParts(selectedOptions);
      const nextParts = replaceComposerRange(
        currentParts,
        insertAt,
        insertAt,
        replacementParts,
      );
      const nextCaretOffset =
        insertAt + getComposerEditingLength(replacementParts);
      commitComposerParts(nextParts, {
        caretOffset: nextCaretOffset,
        resetDom: true,
        syncRemovedCapabilityTokens: true,
      });
      setRuntimeCapabilityPalette(null);
      focusComposerAt(nextCaretOffset);
    },
    [
      applyExternalRuntimeCapabilities,
      commitComposerParts,
      composerPartsRef,
      focusComposerAt,
      runtimeCapabilities,
      runtimeCapabilitiesReady,
      runtimeCapabilityOptions,
      setRuntimeCapabilityPalette,
    ],
  );

  const applyComposerValueRuntimeCapabilities = React.useCallback(
    (
      payload: {
        runtimeCapabilities?: RuntimeCapabilitiesSelection | null;
        insertRuntimeCapabilities?: boolean;
      },
      options?: { insertAt?: number | null },
    ) => {
      const runtimeCapabilitiesPayload = isRuntimeCapabilitiesSelection(
        payload.runtimeCapabilities,
      )
        ? payload.runtimeCapabilities
        : payload.runtimeCapabilities === null
          ? null
          : undefined;
      if (runtimeCapabilitiesPayload === undefined) {
        return;
      }

      if (payload.insertRuntimeCapabilities === true) {
        insertExternalRuntimeCapabilities(runtimeCapabilitiesPayload, options);
      } else {
        applyExternalRuntimeCapabilities(runtimeCapabilitiesPayload);
      }
    },
    [applyExternalRuntimeCapabilities, insertExternalRuntimeCapabilities],
  );

  const updateRuntimeCapabilityPalette = React.useCallback(
    (parts: ComposerPart[], selectionStart?: number | null) => {
      const input = composerInputRef.current;
      const editingText = getComposerEditingText(parts);
      const nextPalette = resolveRuntimeCapabilityPalette(
        editingText,
        typeof selectionStart === 'number'
          ? selectionStart
          : input
            ? getComposerSelectionOffset(input)
            : getComposerEditingLength(parts),
      );
      setRuntimeCapabilityPalette(nextPalette);
    },
    [composerInputRef, setRuntimeCapabilityPalette],
  );

  const removeRunRuntimeCapability = React.useCallback(
    (option: RuntimeCapabilityOption) => {
      setRunRuntimeCapabilities((previous) =>
        toggleRuntimeCapabilitySelection(
          previous,
          option.type,
          option.id,
          false,
        ),
      );
      commitComposerParts(
        removeComposerCapabilityTokens(composerPartsRef.current, option),
        {
          resetDom: true,
          syncRemovedCapabilityTokens: false,
        },
      );
    },
    [commitComposerParts, composerPartsRef, setRunRuntimeCapabilities],
  );

  const insertComposerCapabilityToken = React.useCallback(
    (
      capability: RuntimeCapabilityOption,
      range?: { start: number; end: number },
    ) => {
      const replacementParts = createComposerCapabilityInsertionParts([
        capability,
      ]);
      const currentParts = composerPartsRef.current;
      const replaceRange = range ?? {
        start: getComposerEditingLength(currentParts),
        end: getComposerEditingLength(currentParts),
      };
      const nextParts = replaceComposerRange(
        currentParts,
        replaceRange.start,
        replaceRange.end,
        replacementParts,
      );
      const nextCaretOffset =
        replaceRange.start + getComposerEditingLength(replacementParts);
      commitComposerParts(nextParts, {
        caretOffset: nextCaretOffset,
        resetDom: true,
        syncRemovedCapabilityTokens: true,
      });
      setRunRuntimeCapabilities((previous) =>
        toggleRuntimeCapabilitySelection(
          previous,
          capability.type,
          capability.id,
          true,
        ),
      );
      setRuntimeCapabilityPalette(null);
      focusComposerAt(nextCaretOffset);
    },
    [
      commitComposerParts,
      composerPartsRef,
      focusComposerAt,
      setRunRuntimeCapabilities,
      setRuntimeCapabilityPalette,
    ],
  );

  React.useEffect(() => {
    if (!runtimeCapabilitiesReady || !runtimeCapabilities) {
      return;
    }

    const pendingSelection = pendingExternalRuntimeCapabilityInsertRef.current;
    if (!pendingSelection) {
      return;
    }

    insertExternalRuntimeCapabilities(pendingSelection.selection, {
      insertAt: pendingSelection.insertAt,
    });
  }, [
    insertExternalRuntimeCapabilities,
    runtimeCapabilities,
    runtimeCapabilitiesReady,
  ]);

  return {
    applyComposerValueRuntimeCapabilities,
    insertExternalRuntimeCapabilities,
    updateRuntimeCapabilityPalette,
    removeRunRuntimeCapability,
    insertComposerCapabilityToken,
  };
}

export function HumanRuntimeCapabilityChips({
  options,
}: {
  options: RuntimeCapabilityOption[];
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {options.map((option) => {
        const color =
          option.type === 'skill'
            ? undefined
            : getRuntimeCapabilityColor(option);
        return (
          <span
            key={`${option.type}:${option.id}`}
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary-foreground/20 px-2 py-1 text-xs font-medium text-primary-foreground"
            style={color ? { color } : undefined}
          >
            <RuntimeCapabilityIcon option={option} variant="chip" />
            <span className="max-w-[9rem] truncate">{option.label}</span>
          </span>
        );
      })}
    </div>
  );
}

export function DetachedRunRuntimeCapabilities({
  options,
  runOnlyLabel,
  removeLabel,
  onRemove,
}: {
  options: RuntimeCapabilityOption[];
  runOnlyLabel: string;
  removeLabel: string;
  onRemove: (option: RuntimeCapabilityOption) => void;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{runOnlyLabel}</span>
      {options.map((option) => {
        const color = getRuntimeCapabilityColor(option);
        return (
          <span
            key={`${option.type}:${option.id}`}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            style={color ? { color } : undefined}
          >
            <RuntimeCapabilityIcon option={option} variant="chip" />
            <span className="max-w-40 truncate">{option.label}</span>
            <button
              type="button"
              onClick={() => onRemove(option)}
              className="rounded-full p-0.5 hover:bg-primary/15"
              title={removeLabel}
              aria-label={removeLabel}
            >
              <X size={11} />
            </button>
          </span>
        );
      })}
    </div>
  );
}

export function ComposerCapabilityToken({
  part,
}: {
  part: ComposerCapabilityPart;
}) {
  const color = getRuntimeCapabilityColor(part.capability);
  return (
    <span
      key={part.key}
      data-composer-capability-key={part.key}
      data-capability-type={part.capability.type}
      data-capability-id={part.capability.id}
      contentEditable={false}
      className="mx-0.5 inline-flex max-w-[14rem] select-none items-center gap-1 text-sm font-semibold text-primary align-baseline"
      style={color ? { color } : undefined}
    >
      <RuntimeCapabilityIcon option={part.capability} variant="chip" />
      <span className="truncate">{part.capability.label}</span>
    </span>
  );
}
