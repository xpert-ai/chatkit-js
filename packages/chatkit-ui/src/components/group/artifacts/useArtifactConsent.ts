import { useMemo, useState } from 'react';
import type {
  Client,
  ChatGroupSnapshot,
  GroupArtifactGrant,
} from '@xpert-ai/xpert-sdk';

type ConsentKind = 'analysis' | 'delegatedResults';
type Consent = Record<ConsentKind, boolean> & { revision: number };

/** Consent belongs to the displayed grant revision and the current credential/owner context.
 * A new context invalidates selections during render, including a return to a previous Client.
 * Refreshing an unchanged grant preserves the user's selections. */
export function useArtifactConsent(
  client: Client,
  group: ChatGroupSnapshot,
  owner: boolean,
) {
  const scope = useMemo(
    () => Symbol('artifact-consent'),
    [client, group.id, group.viewerParticipantId, owner],
  );
  const [state, setState] = useState<{
    scope: symbol;
    values: Record<string, Consent>;
  }>({
    scope,
    values: {},
  });

  function checked(grant: GroupArtifactGrant, kind: ConsentKind): boolean {
    const value = state.values[grant.id];
    return (
      state.scope === scope && value?.revision === grant.revision && value[kind]
    );
  }

  function setChecked(
    grant: GroupArtifactGrant,
    kind: ConsentKind,
    checked: boolean,
  ) {
    setState((previous) => {
      const values = previous.scope === scope ? previous.values : {};
      const current = values[grant.id];
      return {
        scope,
        values: {
          ...values,
          [grant.id]: {
            revision: grant.revision,
            analysis: current?.revision === grant.revision && current.analysis,
            delegatedResults:
              current?.revision === grant.revision && current.delegatedResults,
            [kind]: checked,
          },
        },
      };
    });
  }

  return { checked, setChecked };
}
