import * as React from 'react';
import type { ChatKitReference } from '@xpert-ai/chatkit-types';
import { mergeReferences } from '../../../lib/references';
import type { ComposerPart } from '../../../lib/composer-parts';
import { createMessageId } from '../../../lib/utils';
import {
  draftNamespaceKey,
  draftStorageKey,
  mergeDraftParts,
  readDraft,
  writeDraft,
  type DraftContext,
  type StoredDraft,
} from './draft-storage';

type DraftEntry = {
  id: string;
  key: string | null;
  value: StoredDraft;
  recovered: boolean;
};
function loadEntry(key: string | null): DraftEntry {
  const saved = readDraft(key);
  return {
    id: createMessageId(),
    key,
    recovered: !!saved,
    value: {
      version: 1,
      parts: saved
        ? mergeDraftParts([
            ...saved.pending.map((item) => item.parts),
            saved.parts,
          ])
        : [],
      references: saved
        ? mergeReferences(
            saved.pending.flatMap((item) => item.references),
            saved.references,
          )
        : [],
      pending: [],
    },
  };
}

export function useDraftPersistence(
  scope: DraftContext | undefined,
  restore: (parts: ComposerPart[], references: ChatKitReference[]) => void,
) {
  // Thread IDs are branch identities. conversationId resolves asynchronously and may
  // still describe the previous branch during navigation, so it is never a fallback key.
  const key = draftStorageKey(scope);
  const namespace = draftNamespaceKey(scope);
  const scopeId = JSON.stringify([namespace, scope?.threadId ?? null]);
  const entries = React.useRef(new Map<string, DraftEntry>());
  const active = React.useRef<{ scopeId: string; entry: DraftEntry } | null>(
    null,
  );
  const mounted = React.useRef(false);
  const restoreRef = React.useRef(restore);
  restoreRef.current = restore;
  const [contextId, setContextId] = React.useState('');
  const [recovered, setRecovered] = React.useState(false);

  React.useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  React.useLayoutEffect(() => {
    if (active.current?.scopeId === scopeId) return;
    let entry = entries.current.get(scopeId);
    if (!entry) {
      entry = loadEntry(key);
      entries.current.set(scopeId, entry);
    }
    // Every visit to an unbound new chat gets its own in-memory draft. Never keep
    // a shared "new chat" storage bucket that can leak into a different conversation.
    if (active.current && !active.current.entry.key) {
      entries.current.delete(active.current.scopeId);
    }
    active.current = { scopeId, entry };
    restoreRef.current(entry.value.parts, entry.value.references);
    setRecovered(entry.recovered);
    setContextId(entry.id);
  }, [key, scopeId]);

  const save = React.useCallback((parts: ComposerPart[]) => {
    const entry = active.current?.entry;
    if (!entry) return;
    entry.value.parts = parts;
    entry.recovered = false;
    setRecovered(false);
    writeDraft(entry.key, entry.value);
  }, []);

  const saveReferences = React.useCallback((references: ChatKitReference[]) => {
    const entry = active.current?.entry;
    if (!entry) return;
    entry.value.references = references;
    writeDraft(entry.key, entry.value);
  }, []);

  const beginSubmission = React.useCallback(() => {
    const entry = active.current?.entry ?? loadEntry(key);
    const id = createMessageId();
    const submitted = entry.value.parts;
    const submittedReferences = entry.value.references;
    entry.value.pending.push({
      id,
      parts: submitted,
      references: submittedReferences,
    });
    entry.value.parts = [];
    entry.value.references = [];
    writeDraft(entry.key, entry.value);
    let settled = false;
    const isCurrent = () => mounted.current && active.current?.entry === entry;
    return {
      onThreadResolved(threadId: string) {
        if (scope?.threadId || !scope || !isCurrent()) return;
        const resolvedScope = { ...scope, threadId };
        const resolvedId = JSON.stringify([
          draftNamespaceKey(resolvedScope),
          threadId,
        ]);
        entry.key = draftStorageKey(resolvedScope);
        entries.current.delete(scopeId);
        entries.current.set(resolvedId, entry);
        writeDraft(entry.key, entry.value);
      },
      accept() {
        if (settled) return;
        settled = true;
        entry.value.pending = entry.value.pending.filter(
          (item) => item.id !== id,
        );
        // A completion from an unmounted instance must not erase edits saved by its
        // replacement (or another tab). Remove only this submission's stored snapshot.
        const saved = readDraft(entry.key);
        if (saved) {
          saved.pending = saved.pending.filter((item) => item.id !== id);
          writeDraft(entry.key, saved);
        }
      },
      reject() {
        if (settled) return false;
        settled = true;
        entry.value.pending = entry.value.pending.filter(
          (item) => item.id !== id,
        );
        if (!mounted.current) return false;
        if (!scope?.threadId) {
          writeDraft(entry.key, {
            version: 1,
            parts: [],
            references: [],
            pending: [],
          });
          entry.key = null;
          entries.current.set(scopeId, entry);
        }
        entry.value.parts = mergeDraftParts([submitted, entry.value.parts]);
        entry.value.references = mergeReferences(
          submittedReferences,
          entry.value.references,
        );
        writeDraft(entry.key, entry.value);
        if (!isCurrent()) return false;
        restoreRef.current(entry.value.parts, entry.value.references);
        return true;
      },
    };
  }, [scope, scopeId, key]); // Capture the submitting scope, never a later navigation.

  return { save, saveReferences, beginSubmission, recovered, contextId };
}
