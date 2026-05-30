export type WpsRange = {
  Text: string;
  Start?: number;
  End?: number;
  Style?: unknown;
  InsertBefore?(text?: string): void;
  InsertAfter?(text?: string): void;
  Select?(): void;
};

export type WpsCell = {
  Range: WpsRange;
};

export type WpsTable = {
  Range?: WpsRange;
  Cell?(row?: number, column?: number): WpsCell | undefined;
};

export type WpsTables = {
  Count?: number;
  Add?(
    range?: WpsRange,
    rowCount?: number,
    columnCount?: number,
    defaultTableBehavior?: unknown,
    autoFitBehavior?: unknown,
  ): WpsTable | undefined;
};

export type WpsDocument = {
  Name?: string;
  Content?: WpsRange;
  Tables?: WpsTables;
  Range?(start?: number, end?: number): WpsRange;
};

export type WpsSelection = {
  Text: string;
  Range?: WpsRange;
  TypeText?(text?: string): void;
};

export type WpsPluginStorage = {
  getItem(key: string): unknown;
  setItem(key: string, value: unknown): void;
};

export type WpsRibbonUI = {
  Invalidate?(): void;
  InvalidateControl?(id: string): void;
};

export type WpsTaskPane = {
  ID?: string | number;
  Visible: boolean;
  DockPosition?: number;
  Width?: number;
  Height?: number;
  Navigate?(url: string): void;
  Delete?(): void;
};

export type WpsApplication = {
  ActiveDocument?: WpsDocument;
  Selection?: WpsSelection;
  Name?: string;
  Build?: string;
  Version?: string;
  Enum?: {
    msoCTPDockPositionLeft?: number;
    msoCTPDockPositionRight?: number;
  };
  PluginStorage?: WpsPluginStorage;
  ribbonUI?: WpsRibbonUI;
  CreateTaskPane?(url: string, title?: string): WpsTaskPane | undefined;
  GetTaskPane?(id: string | number): WpsTaskPane | undefined;
};

export type WpsNamespace = {
  WpsApplication?(): WpsApplication;
};

type WpsGlobal = typeof globalThis & {
  Application?: WpsApplication;
  wps?: WpsNamespace;
};

declare global {
  interface Window {
    Application?: WpsApplication;
    wps?: WpsNamespace;
    ribbon?: unknown;
  }
}

export function readOptionalWpsApplication(): WpsApplication | undefined {
  const global = globalThis as WpsGlobal;
  const existing = global.Application ?? global.window?.Application;
  if (existing) {
    return existing;
  }

  const application = global.wps?.WpsApplication?.() ?? global.window?.wps?.WpsApplication?.();
  if (application) {
    global.Application = application;
    if (global.window) {
      global.window.Application = application;
    }
  }
  return application;
}

export function getWpsApplication(): WpsApplication {
  const application = readOptionalWpsApplication();
  if (!application) {
    throw new Error('WPS application is not available.');
  }
  return application;
}

export function getActiveDocument(application: WpsApplication): WpsDocument {
  const document = application.ActiveDocument;
  if (!document) {
    throw new Error('No active WPS document is available.');
  }
  return document;
}

export function getActiveSelection(application: WpsApplication): WpsSelection {
  const selection = application.Selection;
  if (!selection) {
    throw new Error('No active WPS selection is available.');
  }
  return selection;
}
