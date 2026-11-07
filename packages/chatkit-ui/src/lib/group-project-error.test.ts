import { describe, expect, it } from 'vitest';
import { getGroupProjectRequiredError } from './group-project-error';

const body = {
  statusCode: 400,
  error: 'Bad Request',
  code: 'GROUP_PROJECT_REQUIRED',
  message: 'Choose a Project',
  groupId: 'group',
  participantIds: ['assistant'],
};
describe('group Project required error boundary', () => {
  it('recognizes the server contract through the SDK HTTPError shape', () => {
    expect(
      getGroupProjectRequiredError({ status: 400, text: JSON.stringify(body) }),
    ).toEqual(body);
    expect(getGroupProjectRequiredError(body)).toEqual(body);
  });
  it.each([
    new Error('This Assistant requires a Project workspace'),
    { status: 403, text: JSON.stringify(body) },
    { status: 400, text: 'invalid json' },
    { ...body, code: 'FORBIDDEN' },
    { ...body, groupId: null },
    { ...body, participantIds: [] },
    { ...body, participantIds: [42] },
  ])('does not treat other errors as Project setup: %j', (error) => {
    expect(getGroupProjectRequiredError(error)).toBeNull();
  });
});
