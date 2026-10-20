import type { XpertViewRuntimeScopeInput } from '@xpert-ai/xpert-sdk';
import type { ViewFileClient } from '../../lib/files/view-file-access';

export type ResourceFileClient = ViewFileClient;

export type ResourceFileAccessOptions = {
  client: ResourceFileClient;
  assistantId: string;
  runtimeScope: XpertViewRuntimeScopeInput;
  available: boolean;
};
