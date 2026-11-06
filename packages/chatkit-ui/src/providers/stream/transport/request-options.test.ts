import { describe, expect, it } from 'vitest';
import { retainResumeStreamOptions } from '../../Stream';
import { mergeStreamRequestContext } from './request-options';

it('advertises form support on every new ChatKit run, including runs without host context', () => {
  expect(mergeStreamRequestContext(undefined, undefined)).toEqual({ supportsUserInput: true });
  expect(mergeStreamRequestContext({ projectId: 'p' }, { supportsUserInput: false })).toEqual({
    projectId: 'p',
    supportsUserInput: true,
  });
});

describe('retainResumeStreamOptions', () => {
  it('keeps request context for HITL and client-tool resume submissions', () => {
    expect(
      retainResumeStreamOptions({
        context: {
          env: {
            workspaceId: 'workspace-1',
          },
          targetXpertId: 'xpert-1',
        },
        config: {
          tags: ['authoring'],
        },
        streamMode: ['messages', 'events'],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: {
          messages: [],
        },
        newThread: true,
      }),
    ).toEqual({
      context: {
        env: {
          workspaceId: 'workspace-1',
        },
        targetXpertId: 'xpert-1',
      },
      config: {
        tags: ['authoring'],
      },
      streamMode: ['messages', 'events'],
      streamSubgraphs: true,
      streamResumable: true,
    });
  });
});
