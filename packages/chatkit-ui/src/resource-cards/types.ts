import type {
  ResourceCardFile,
  ResourceCardFileReference,
  ResourceCardImage,
  TMessageContentResourceCard,
} from '@xpert-ai/chatkit-types';
import type { XpertViewFileAccessGrantResult } from '@xpert-ai/xpert-sdk';

export type ResourceCardOpenResult =
  | { success: true; status: 'opened' }
  | { success: false; code: string; message?: string };

/** Each capability can be provided without a Workbench, including inline images. */
export type ResourceCardActions = {
  loadResourceCardFileMetadata?: (
    file: ResourceCardFileReference,
    signal: AbortSignal,
  ) => Promise<Pick<XpertViewFileAccessGrantResult, 'mimeType'>>;
  loadResourceCardImage?: (
    image: ResourceCardImage,
    signal: AbortSignal,
  ) => Promise<Blob>;
  downloadResourceCardFile?: (file: ResourceCardFile) => Promise<void>;
  openResourceCardImage?: (image: ResourceCardImage) => void;
  openResourceCard?: (
    card: TMessageContentResourceCard,
    messageId: string,
  ) => Promise<ResourceCardOpenResult>;
};
