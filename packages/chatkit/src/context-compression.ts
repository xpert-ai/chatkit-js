/** Reason codes emitted by context-compression events. */
export type ContextCompressionReason =
  | 'no_messages'
  | 'no_unprotected_history'
  | 'no_token_gain'
  | 'summary_invalid'
  | 'summary_input_budget'
  | 'summary_output_budget'
  | 'summary_work_limit'
  | 'summary_constraints_lost'
  | 'summary_service_error'
  | 'retry_deferred'
  | 'context_budget_exceeded'
  | 'context_validation_failed';
