import type * as React from 'react';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import type { MessagePresentationMode } from '../../../lib/message-presentation';

export type AssistantContentRenderOptions = {
  mode?: MessagePresentationMode;
  hiddenOrders?: Set<number>;
  collapseProcess?: boolean;
  processPrefix?: React.ReactNode;
  isStreaming?: boolean;
  isReasoning?: boolean;
  isThreadRunning?: boolean;
  isThreadPaused?: boolean;
  organizationId?: string;
  apiUrl?: string;
  isAgentOutput?: boolean;
  onOpenExternalAssistant?: (executionId: string) => void;
  mcpApps?: ChatKitOptions['mcpApps'];
};
