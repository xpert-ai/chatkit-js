import type {
  FileChangeResource,
  FileChangeSetResource,
  FileChangeReport,
} from '@xpert-ai/chatkit-types';

export type FileReviewEntry = {
  key: string;
  path: string;
  report?: FileChangeReport;
};
export type FileChangeReviewOptions = {
  selected: FileChangeResource | FileChangeSetResource;
  openFile?: (entry: FileReviewEntry) => void;
  load: (
    scope: 'selected' | 'conversation',
    signal: AbortSignal,
  ) => Promise<FileReviewEntry[]>;
};
