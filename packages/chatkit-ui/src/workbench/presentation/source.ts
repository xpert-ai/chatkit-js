import type {
  ArtifactPresentation,
  ArtifactPresentationQuery,
} from '@xpert-ai/xpert-sdk';

/**
 * Authorized presentation transport, independent of groups and source projects.
 * Implementations bind credentials and resource scope and revalidate access for
 * every read/query; opening a tab does not grant lasting access to its resource.
 */
export interface PresentationSource {
  /** Load the authorized entry; honor cancellation when its tab or context closes. */
  read(signal: AbortSignal): Promise<ArtifactPresentation>;
  /**
   * Execute a presentation query within this source's scope. The server validates
   * the request and returns provider-specific data; the iframe cannot choose a
   * different credential, resource, or project through the request payload.
   */
  query(
    request: ArtifactPresentationQuery,
    signal: AbortSignal,
  ): Promise<unknown>;
}
