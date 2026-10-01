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
  options?: ChatKitOptions | null;
  isClientSecretInitializing?: boolean;
  surface?: 'main' | 'side';
  referenceRequest?: ChatReferenceRequest | null;
  activeProjectId?: string;
  projectSelection?: ProjectSelection;
  projectsEnabled?: boolean;
  connectorsEnabled?: boolean;
  onProjectChange?: (
    projectId: string | null,
    selection?: ProjectSelection,
  ) => void;
  onProjectCreate?: (name: string, projectType?: XpertProjectTypeRef) => void;
  onProjectTypeCreate?: (projectType: XpertProjectTypeRef) => void;
  onConnectorsChange?: (connectorBindingIds: string[]) => void;
};

export type ChatReferenceRequest = {
  id: string;
  reference: ChatKitReference;
};
