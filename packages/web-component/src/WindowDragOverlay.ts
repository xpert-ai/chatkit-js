import { parseWindowDragRegions } from '@xpert-ai/chatkit-web-shared';

/** Native window hit targets only: no Node access or window-management IPC. */
export class WindowDragOverlay {
  private layer: HTMLDivElement;
  private observer: ResizeObserver;
  private size = { width: 0, height: 0 };
  constructor(
    private wrapper: HTMLElement,
    private enabled: () => boolean,
  ) {
    this.layer = document.createElement('div');
    this.layer.setAttribute('aria-hidden', 'true');
    this.layer.dataset.slot = 'chatkit-window-drag';
    this.layer.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    wrapper.append(this.layer);
    this.observer = new ResizeObserver(() => {
      if (
        this.wrapper.clientWidth !== this.size.width ||
        this.wrapper.clientHeight !== this.size.height
      )
        this.clear();
    });
    this.observer.observe(wrapper);
  }
  update(input: unknown) {
    this.clear();
    if (!this.enabled()) return;
    const value = parseWindowDragRegions(input);
    if (
      !value ||
      Math.abs(value.width - this.wrapper.clientWidth) > 1 ||
      Math.abs(value.height - this.wrapper.clientHeight) > 1
    )
      return;
    this.size = { width: value.width, height: value.height };
    for (const rect of value.regions) {
      const region = document.createElement('div');
      region.style.cssText = `position:absolute;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;pointer-events:auto;user-select:none;-webkit-app-region:drag;`;
      this.layer.append(region);
    }
  }
  clear() {
    this.layer.replaceChildren();
  }
  destroy() {
    this.observer.disconnect();
    this.layer.remove();
  }
}
