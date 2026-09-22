import type { RuntimeResourceCatalogItem } from '@xpert-ai/xpert-sdk';

/** Client-side verification states, never sent as part of a resource selection. */
export type ResourceVerificationStatus =
  | 'checking'
  | 'unverified'
  | 'previous_version';

export type ResourceDisplayItem = Omit<RuntimeResourceCatalogItem, 'status'> & {
  status: RuntimeResourceCatalogItem['status'] | ResourceVerificationStatus;
};
