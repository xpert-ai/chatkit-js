import type { Client, XpertViewRuntimeScopeInput } from '@xpert-ai/xpert-sdk';

export type ResourceFileClient = Pick<
  Client['viewHosts'],
  | 'createFileAccessSession'
  | 'createFileAccessGrant'
  | 'readFileAccess'
  | 'revokeFileAccessSession'
>;

export type ResourceFileAccessOptions = {
  client: ResourceFileClient;
  assistantId: string;
  runtimeScope: XpertViewRuntimeScopeInput;
  available: boolean;
};
