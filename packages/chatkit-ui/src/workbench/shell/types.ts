import type {
  ChatKitOptions,
  ChatKitWorkbenchClientCommandRequest,
} from '@xpert-ai/chatkit-types';
import type * as React from 'react';
import type { NavigationSession } from '../client-command-payload';

export type WorkbenchAssistantContext = {
  env?: Record<string, string>;
  context?: Record<string, unknown>;
};

export type WorkbenchShellProps = {
  options?: ChatKitOptions | null;
  locale: string;
  children: React.ReactNode;
  onRequestContextChange: (context: Record<string, unknown>) => void;
  onNavigate?: (
    session: NavigationSession,
    request: ChatKitWorkbenchClientCommandRequest,
  ) => void;
  initialNavigation?: ChatKitWorkbenchClientCommandRequest;
  initializing?: boolean;
};
