export function getMessageCompletionStatus(status?: string) {
  switch (status?.toLowerCase()) {
    case 'success':
    case 'completed':
      return 'completed';
    case 'fail':
    case 'failed':
    case 'error':
    case 'timeout':
      return 'failed';
    case 'paused':
    case 'pausing':
    case 'pending':
      return 'paused';
    case 'aborted':
    case 'interrupted':
    case 'canceled':
    case 'cancelled':
      return 'interrupted';
    default:
      return null;
  }
}
