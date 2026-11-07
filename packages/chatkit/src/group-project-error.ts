/** HTTP 400 contract shared with Xpert's ChatGroupProjectRequiredError. No message was accepted. */
export type GroupProjectRequiredError = {
  statusCode: 400;
  error: 'Bad Request';
  code: 'GROUP_PROJECT_REQUIRED';
  message: string;
  groupId: string;
  participantIds: string[];
};
