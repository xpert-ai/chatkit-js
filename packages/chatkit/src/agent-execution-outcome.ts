/** Business outcome reported by a server tool, independent of model/runtime completion. */
export type TAgentExecutionOutcome = {
  status:
    | 'accepted'
    | 'already_completed'
    | 'not_claimed'
    | 'blocked'
    | 'failed'
    | 'incomplete';
  subjectId: string;
  accepted: boolean;
  message?: string;
  versionId?: string;
};

/** Only tool artifacts from this exact invocation may supply its business result. */
export type TAgentExecutionOutcomeArtifact = {
  type: 'agent_execution_outcome';
  executionId: string;
  outcome: TAgentExecutionOutcome;
};
