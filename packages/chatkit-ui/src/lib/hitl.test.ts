import { describe, expect, it } from 'vitest';
import { normalizeHITLRequest } from '@xpert-ai/chatkit-types';

import { buildHITLResumeRunInput, collectHITLRequests } from './hitl';

describe('HITL interrupt normalization', () => {
  it('builds an explicit v2 resume request for xpert chat', () => {
    expect(
      buildHITLResumeRunInput({
        response: {
          decisions: [
            { type: 'approve' },
            { type: 'reject', message: 'Keep this one' },
          ],
        },
        conversationId: ' conversation-1 ',
        executionId: ' execution-1 ',
        aiMessageId: ' ai-1 ',
      }),
    ).toEqual({
      action: 'resume',
      conversationId: 'conversation-1',
      target: {
        aiMessageId: 'ai-1',
        executionId: 'execution-1',
      },
      decision: {
        type: 'confirm',
        payload: {
          decisions: [
            { type: 'approve' },
            { type: 'reject', message: 'Keep this one' },
          ],
        },
      },
    });
  });

  it('accepts the Xpert HumanInTheLoopMiddleware camelCase payload', () => {
    const request = {
      actionRequests: [
        {
          name: 'send_email',
          args: {
            to: 'user@example.com',
            subject: 'Hello',
          },
          description: 'Review the outbound email.',
        },
      ],
      reviewConfigs: [
        {
          actionName: 'send_email',
          allowedDecisions: ['approve', 'edit', 'reject'],
          argsSchema: {
            type: 'object',
          },
        },
      ],
    };

    expect(normalizeHITLRequest(request)).toEqual(request);
  });

  it('preserves explicit MCP boolean elicitation metadata', () => {
    const request = {
      elicitation: {
        kind: 'mcp_elicitation',
        actionName: 'MCP Elicitation',
        field: {
          name: 'approved',
          type: 'boolean',
          title: 'Approve',
          required: true,
        },
      },
      actionRequests: [
        {
          name: 'MCP Elicitation',
          args: { approved: false },
          description: 'Approve OAuth MCP tool test',
        },
      ],
      reviewConfigs: [
        {
          actionName: 'MCP Elicitation',
          allowedDecisions: ['approve', 'reject'],
        },
      ],
    };

    expect(normalizeHITLRequest(request)).toEqual(request);
  });

  it.each([
    [
      'string field',
      {
        name: 'reason',
        type: 'string',
        title: 'Reason',
        required: true,
      },
      { reason: '' },
    ],
    [
      'optional boolean field',
      {
        name: 'approved',
        type: 'boolean',
        title: 'Approve',
        required: false,
      },
      { approved: false },
    ],
  ])('preserves HITL requests with an unsupported MCP %s', (_, field, args) => {
    const baseRequest = {
      actionRequests: [
        {
          name: 'MCP Elicitation',
          args,
        },
      ],
      reviewConfigs: [
        {
          actionName: 'MCP Elicitation',
          allowedDecisions: ['approve', 'reject'],
        },
      ],
    };
    const request = {
      ...baseRequest,
      elicitation: {
        kind: 'mcp_elicitation',
        actionName: 'MCP Elicitation',
        field,
      },
    };

    expect(normalizeHITLRequest(request)).toEqual(baseRequest);

    const requests = collectHITLRequests({
      tasks: [
        {
          id: 'task-1',
          interrupts: [{ id: 'interrupt-1', value: request }],
        },
      ],
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.request).toEqual(baseRequest);
  });

  it('normalizes the LangChain snake_case HITL payload shape', () => {
    expect(
      normalizeHITLRequest({
        action_requests: [
          {
            name: 'send_email',
            arguments: {
              to: 'user@example.com',
            },
          },
        ],
        review_configs: [
          {
            action_name: 'send_email',
            allowed_decisions: ['approve', 'respond'],
            args_schema: {
              type: 'object',
            },
          },
        ],
      }),
    ).toEqual({
      actionRequests: [
        {
          name: 'send_email',
          args: {
            to: 'user@example.com',
          },
        },
      ],
      reviewConfigs: [
        {
          actionName: 'send_email',
          allowedDecisions: ['approve', 'respond'],
          argsSchema: {
            type: 'object',
          },
        },
      ],
    });
  });

  it('collects HITL requests from LangGraph interrupt payloads', () => {
    const requests = collectHITLRequests({
      tasks: [
        {
          id: 'task-1',
          name: 'human_review',
          path: ['__pregel_pull', 'human_review'],
          interrupts: [
            {
              id: 'interrupt-1',
              value: {
                actionRequests: [
                  {
                    name: 'execute_sql',
                    args: {
                      query: 'delete from accounts',
                    },
                  },
                ],
                reviewConfigs: [
                  {
                    actionName: 'execute_sql',
                    allowedDecisions: ['approve', 'reject'],
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      id: 'interrupt-1',
      interruptId: 'interrupt-1',
      taskId: 'task-1',
      request: {
        actionRequests: [
          {
            name: 'execute_sql',
          },
        ],
      },
    });
  });

  it('collects HITL requests from persisted conversation operation tasks', () => {
    const requests = collectHITLRequests(
      {
        messageId: 'message-1',
        tasks: [
          {
            id: 'task-1',
            name: 'human_review',
            interrupts: [
              {
                id: 'interrupt-1',
                value: {
                  action_requests: [
                    {
                      name: 'deleteSkill',
                      arguments: {
                        skillName: 'multi-skill-chaining',
                      },
                    },
                    {
                      name: 'deleteSkill',
                      arguments: {
                        skillName: 'skill-error-handling',
                      },
                    },
                  ],
                  review_configs: [
                    {
                      action_name: 'deleteSkill',
                      allowed_decisions: ['approve', 'reject'],
                    },
                    {
                      action_name: 'deleteSkill',
                      allowed_decisions: ['approve', 'edit', 'reject'],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      { executionId: 'run-1' },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      id: 'interrupt-1',
      interruptId: 'interrupt-1',
      taskId: 'task-1',
      executionId: 'run-1',
      request: {
        actionRequests: [
          {
            name: 'deleteSkill',
            args: {
              skillName: 'multi-skill-chaining',
            },
          },
          {
            name: 'deleteSkill',
            args: {
              skillName: 'skill-error-handling',
            },
          },
        ],
      },
    });
  });
});
