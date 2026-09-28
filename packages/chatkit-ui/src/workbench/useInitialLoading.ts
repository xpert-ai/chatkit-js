import { useEffect, useState } from 'react';

/** A mounted session reveals once; ordinary background refreshes do not hide it. */
export function useInitialLoading(scope: string | null, pending: boolean) {
  const [revealedScope, setRevealedScope] = useState<string | null>();
  useEffect(() => {
    if (!pending) setRevealedScope(scope);
  }, [scope, pending]);
  return revealedScope !== scope && pending;
}
