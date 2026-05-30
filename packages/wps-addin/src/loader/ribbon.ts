import {
  getWpsApplication,
  readOptionalWpsApplication,
  type WpsApplication,
  type WpsRibbonUI,
  type WpsTaskPane,
} from '../wps-api';

type RibbonControl = {
  Id?: string;
};

const TASKPANE_STORAGE_KEY = 'xpertai_chatkit_wps_taskpane_id';
const FALLBACK_DOCK_RIGHT = 2;

let fallbackTaskPane: WpsTaskPane | undefined;

function readTaskPaneUrl(): string {
  return new URL('taskpane.html', window.location.href).toString();
}

function readStoredTaskPaneId(application: WpsApplication): string | number | undefined {
  const value = application.PluginStorage?.getItem(TASKPANE_STORAGE_KEY);
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function storeTaskPaneId(application: WpsApplication, taskPane: WpsTaskPane): void {
  if (taskPane.ID !== undefined) {
    application.PluginStorage?.setItem(TASKPANE_STORAGE_KEY, taskPane.ID);
  }
}

function getStoredTaskPane(application: WpsApplication): WpsTaskPane | undefined {
  const taskPaneId = readStoredTaskPaneId(application);
  if (taskPaneId !== undefined) {
    return application.GetTaskPane?.(taskPaneId);
  }
  return fallbackTaskPane;
}

function createTaskPane(application: WpsApplication): WpsTaskPane {
  const taskPane = application.CreateTaskPane?.(readTaskPaneUrl(), 'XpertAI Copilot');
  if (!taskPane) {
    throw new Error('WPS CreateTaskPane API is not available.');
  }
  taskPane.DockPosition =
    application.Enum?.msoCTPDockPositionRight ?? FALLBACK_DOCK_RIGHT;
  storeTaskPaneId(application, taskPane);
  fallbackTaskPane = taskPane;
  return taskPane;
}

function toggleTaskPane(): void {
  const application = getWpsApplication();
  const existing = getStoredTaskPane(application);
  const taskPane = existing ?? createTaskPane(application);
  taskPane.Visible = !existing || !existing.Visible;
  if (taskPane.Navigate) {
    taskPane.Navigate(readTaskPaneUrl());
  }
}

export const ribbon = {
  OnAddinLoad(ribbonUI: WpsRibbonUI): boolean {
    const application = readOptionalWpsApplication();
    if (application) {
      application.ribbonUI = ribbonUI;
    }
    return true;
  },

  OnAction(control: RibbonControl): boolean {
    if (control.Id === 'btnOpenChatKit') {
      toggleTaskPane();
    }
    return true;
  },

  GetImage(): string {
    return 'assets/icon-32.png';
  },

  OnGetEnabled(): boolean {
    return true;
  },

  OnGetVisible(): boolean {
    return true;
  },
};
