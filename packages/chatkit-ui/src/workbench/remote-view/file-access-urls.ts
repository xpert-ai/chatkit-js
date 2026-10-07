import type {
  Client,
  XpertViewFileAccessGrantResult,
} from '@xpert-ai/xpert-sdk';

/** Materialize previews and downloads in the host without exposing session cookies. */
export class FileAccessUrls {
  private epoch = 0;

  constructor(
    private readonly client: Pick<Client['viewHosts'], 'readFileAccess'>,
  ) {}

  async create(grant: XpertViewFileAccessGrantResult, signal: AbortSignal) {
    const epoch = this.epoch;
    const blob = await this.client.readFileAccess(grant.url, { signal });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    signal.throwIfAborted();
    const remaining = Date.parse(grant.expiresAt) - Date.now();
    if (epoch !== this.epoch || !Number.isFinite(remaining) || remaining <= 0) {
      throw new Error('Remote view file access session is no longer active.');
    }
    // Parent-owned blob: URLs are also blocked by Chromium's storage partitioning
    // in an opaque-origin iframe. A data URL is self-contained and works with
    // existing remote views, including download anchors; the grant expiry remains
    // available to their refresh logic.
    // Do not cache the bytes here or log the resulting URL (it is private file content).
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return {
      ...grant,
      url: `data:${blob.type || grant.mimeType};base64,${btoa(binary)}`,
    };
  }

  clear() {
    this.epoch += 1;
  }
}
