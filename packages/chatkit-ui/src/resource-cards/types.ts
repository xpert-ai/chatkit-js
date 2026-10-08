import type {
  ResourceCardFile,
  ResourceCardImage,
  TMessageContentResourceCard,
} from '@xpert-ai/chatkit-types';

export type ResourceCardOpenResult =
  | { success: true; status: 'opened' }
  | { success: false; code: string; message?: string };

/** Each capability can be provided without a Workbench, including inline images. */
export type ResourceCardActions = {
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
