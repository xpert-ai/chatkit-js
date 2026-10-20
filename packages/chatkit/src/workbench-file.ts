/** ChatKit's resource form of `workbench.file.open`, resolved in the invoking View. */
export type ChatKitWorkbenchFileResource = {
  fileKey: string;
  targetId?: string;
};

/** The host supplies identity, scope, authorization and canonical file metadata. */
export type ChatKitWorkbenchResourceFileOpen = {
  resource: ChatKitWorkbenchFileResource;
};
