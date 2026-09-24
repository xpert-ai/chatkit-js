export const CHAT_MIN_WIDTH = 384;
export const WORKBENCH_MIN_WIDTH = 480;

export function clampPanelWidth(value: number, containerWidth: number) {
  const max = Math.max(WORKBENCH_MIN_WIDTH, containerWidth - CHAT_MIN_WIDTH);
  return Math.min(max, Math.max(WORKBENCH_MIN_WIDTH, Math.round(value)));
}

export function resizeWorkbench(chatWidth: number, containerWidth: number) {
  return {
    collapsed: chatWidth < CHAT_MIN_WIDTH / 2,
    panelWidth: clampPanelWidth(containerWidth - chatWidth, containerWidth),
  };
}
