import type {
  ChatKitOptions,
  ChatKitReference,
  ProjectSelection,
} from '@xpert-ai/chatkit-types';
import type { XpertProjectTypeRef } from '@xpert-ai/xpert-sdk';

export type ChatProps = {
  className?: string;
  title?: string;
  placeholder?: string;
  clientSecret?: string;
  refreshClientSecret?: () => Promise<{
    secret: string;
    organizationId?: string;
  }>;
  options?: ChatKitOptions | null;
  isClientSecretInitializing?: boolean;
  surface?: 'main' | 'side';
  /** Side-chat transcript boundary only; never trims the stream or execution context. */
  inheritedMessagesEndId?: string;
  referenceRequest?: ChatReferenceRequest | null;
  activeProjectId?: string;
  projectSelection?: ProjectSelection;
  projectsEnabled?: boolean;
  connectorsEnabled?: boolean;
  onProjectChange?: (
    projectId: string | null,
    selection?: ProjectSelection,
    navigation?: { resumeLatestConversation: boolean },
  ) => void;
  onProjectCreate?: (name: string, projectType?: XpertProjectTypeRef) => void;
  onProjectTypeCreate?: (projectType: XpertProjectTypeRef) => void;
  onConnectorsChange?: (connectorBindingIds: string[]) => void;
};

export type ChatReferenceRequest = {
  id: string;
  reference: ChatKitReference;
  references?: ChatKitReference[];
};
