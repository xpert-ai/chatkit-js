import { useEffect, useRef, useState } from 'react';
import type { Client, ChatGroupCandidate } from '@xpert-ai/xpert-sdk';

const PAGE_SIZE = 50;

/** Search and membership changes invalidate the whole page sequence, including late responses. */
export function useGroupCandidates({
  client,
  groupId,
  kind,
  search,
  membershipKey,
  enabled,
  onError,
}: {
  client: Client;
  groupId: string;
  kind: 'user' | 'assistant';
  search: string;
  membershipKey: string;
  enabled: boolean;
  onError: (error: unknown) => void;
}) {
  const [candidates, setCandidates] = useState<ChatGroupCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestNext = useRef<(() => void) | null>(null);
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  useEffect(() => {
    const controller = new AbortController();
    let offset = 0;
    let inFlight = false;
    let accumulated: ChatGroupCandidate[] = [];
    setCandidates([]);
    setHasMore(false);
    setFailed(false);
    setLoading(enabled);
    setLoadingMore(false);
    requestNext.current = null;
    if (!enabled) return;

    const load = async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      setFailed(false);
      if (offset) setLoadingMore(true);
      else setLoading(true);
      try {
        const query = { kind, search, groupId, limit: PAGE_SIZE + 1, offset };
        const rows = await client.groups.candidates(query, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const page = rows.slice(0, PAGE_SIZE);
        const known = new Set(
          accumulated.map((item) => `${item.kind}:${item.subjectId}`),
        );
        const fresh = page.filter(
          (item) => !known.has(`${item.kind}:${item.subjectId}`),
        );
        accumulated = [...accumulated, ...fresh];
        offset += page.length;
        setCandidates(accumulated);
        setHasMore(rows.length > PAGE_SIZE && fresh.length > 0);
      } catch (error) {
        if (!controller.signal.aborted) {
          setFailed(true);
          errorHandler.current(error);
        }
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };
    requestNext.current = () => {
      void load();
    };
    const timer = setTimeout(() => void load(), 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
      requestNext.current = null;
    };
  }, [client, groupId, kind, search, membershipKey, enabled]);

  return {
    candidates,
    loading,
    loadingMore,
    hasMore,
    failed,
    loadMore: () => requestNext.current?.(),
  };
}
