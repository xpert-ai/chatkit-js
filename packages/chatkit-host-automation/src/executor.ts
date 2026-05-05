import {
  HOST_PAGE_AUTOMATION_TOOL_NAMES,
  type HostPageAutomationElementSnapshot,
  type HostPageAutomationOptions,
  type HostPageAutomationToolName,
  type HostPageSnapshot,
} from './types';

type Point = { x: number; y: number };

type ResolvableTargetParams = {
  ref?: unknown;
  selector?: unknown;
  x?: unknown;
  y?: unknown;
};

type FillParams = ResolvableTargetParams & {
  value?: unknown;
};

type PressParams = ResolvableTargetParams & {
  key?: unknown;
};

type SelectParams = ResolvableTargetParams & {
  value?: unknown;
  values?: unknown;
};

type ScrollParams = ResolvableTargetParams & {
  deltaX?: unknown;
  deltaY?: unknown;
  x?: unknown;
  y?: unknown;
};

type NavigateParams = {
  url?: unknown;
};

const AUTOMATION_TOOL_NAME_SET = new Set<string>(
  HOST_PAGE_AUTOMATION_TOOL_NAMES,
);

const CANDIDATE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
  'summary',
  '[role]',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[aria-label]',
  '[data-testid]',
].join(',');

const MAX_SNAPSHOT_ELEMENTS = 100;

export function isHostPageAutomationToolName(
  value: string,
): value is HostPageAutomationToolName {
  return AUTOMATION_TOOL_NAME_SET.has(value);
}

function getOwnerDocument(root: Document | ShadowRoot): Document {
  return root instanceof Document ? root : root.ownerDocument;
}

function getWindow(root: Document | ShadowRoot): Window {
  return getOwnerDocument(root).defaultView ?? window;
}

function normalizeParams(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number.`);
  }

  return value;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === 'string')
  ) {
    return value;
  }

  throw new Error('value or values must be a string or an array of strings.');
}

function getElementText(element: Element): string | undefined {
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 160) : undefined;
}

function getElementValue(element: Element): string | undefined {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return element.value;
  }

  return undefined;
}

function getElementName(element: Element): string | undefined {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel?.trim()) {
    return ariaLabel.trim();
  }

  const title = element.getAttribute('title');
  if (title?.trim()) {
    return title.trim();
  }

  if (element instanceof HTMLInputElement) {
    const labels = Array.from(element.labels ?? [])
      .map((label) => getElementText(label))
      .filter(Boolean);
    if (labels.length > 0) {
      return labels.join(' ').slice(0, 160);
    }
  }

  return getElementText(element);
}

function inferRole(element: Element): string | undefined {
  const explicitRole = element.getAttribute('role');
  if (explicitRole?.trim()) {
    return explicitRole.trim();
  }

  const tag = element.tagName.toLowerCase();
  if (tag === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'select') return 'combobox';
  if (tag === 'summary') return 'button';

  if (element instanceof HTMLInputElement) {
    switch (element.type) {
      case 'checkbox':
        return 'checkbox';
      case 'radio':
        return 'radio';
      case 'button':
      case 'submit':
      case 'reset':
        return 'button';
      default:
        return 'textbox';
    }
  }

  return undefined;
}

function isDisabled(element: Element): boolean | undefined {
  if (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return element.disabled || undefined;
  }

  return element.getAttribute('aria-disabled') === 'true' || undefined;
}

function isChecked(element: Element): boolean | undefined {
  return element instanceof HTMLInputElement &&
    (element.type === 'checkbox' || element.type === 'radio')
    ? element.checked
    : undefined;
}

function isVisibleCandidate(element: Element): boolean {
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
    return false;
  }

  if (element instanceof HTMLElement && element.hidden) {
    return false;
  }

  const view = element.ownerDocument.defaultView;
  const style = view?.getComputedStyle(element);
  if (
    style &&
    (style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0')
  ) {
    return false;
  }

  return true;
}

function isCandidateElement(element: Element): boolean {
  return element.matches(CANDIDATE_SELECTOR) && isVisibleCandidate(element);
}

function getGlobalRect(element: Element) {
  const rect = element.getBoundingClientRect();
  let x = rect.left;
  let y = rect.top;
  let frameElement: Element | null = null;

  try {
    frameElement = element.ownerDocument.defaultView?.frameElement ?? null;
  } catch {
    frameElement = null;
  }

  while (frameElement) {
    const frameRect = frameElement.getBoundingClientRect();
    x += frameRect.left;
    y += frameRect.top;
    try {
      frameElement =
        frameElement.ownerDocument.defaultView?.frameElement ?? null;
    } catch {
      frameElement = null;
    }
  }

  return {
    x,
    y,
    width: rect.width,
    height: rect.height,
  };
}

function createSelector(element: Element): string | undefined {
  const escapeSelectorValue = (value: string) =>
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(value)
      : value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

  if (element.id) {
    return `#${escapeSelectorValue(element.id)}`;
  }

  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${escapeSelectorValue(testId)}"]`;
  }

  const name = element.getAttribute('name');
  if (name) {
    return `${element.tagName.toLowerCase()}[name="${escapeSelectorValue(
      name,
    )}"]`;
  }

  return element.tagName.toLowerCase();
}

function collectElements(root: Document | ShadowRoot): Element[] {
  const doc = getOwnerDocument(root);
  const start =
    root instanceof Document ? (root.body ?? root.documentElement) : root;
  if (!start) {
    return [];
  }

  const collected: Element[] = [];

  const visitRoot = (currentRoot: Document | ShadowRoot | Element) => {
    const walker = doc.createTreeWalker(currentRoot, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();

    while (node) {
      const element = node as Element;
      if (isCandidateElement(element)) {
        collected.push(element);
      }

      const shadowRoot = element.shadowRoot;
      if (shadowRoot) {
        visitRoot(shadowRoot);
      }

      if (element instanceof HTMLIFrameElement) {
        try {
          if (element.contentDocument) {
            visitRoot(element.contentDocument);
          }
        } catch {
          // Cross-origin frames are intentionally skipped.
        }
      }

      if (collected.length >= MAX_SNAPSHOT_ELEMENTS) {
        return;
      }

      node = walker.nextNode();
    }
  };

  visitRoot(start);
  return collected.slice(0, MAX_SNAPSHOT_ELEMENTS);
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype = Object.getPrototypeOf(element) as
    | HTMLInputElement
    | HTMLTextAreaElement;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
}

function dispatchInputEvents(element: Element) {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function focusElement(element: Element) {
  if (element instanceof HTMLElement || element instanceof SVGElement) {
    element.scrollIntoView?.({ block: 'center', inline: 'center' });
  }

  if (element instanceof HTMLElement) {
    element.focus?.();
  }
}

export class HostPageAutomationExecutor {
  private refs = new Map<string, Element>();
  private nextRef = 1;

  constructor(private readonly options: HostPageAutomationOptions = {}) {}

  async execute(
    name: HostPageAutomationToolName,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    if (this.options.enabled === false) {
      throw new Error('Host page automation is disabled.');
    }

    switch (name) {
      case 'host_page_snapshot':
        return this.snapshot();
      case 'host_page_click':
        return this.click(params);
      case 'host_page_fill':
        return this.fill(params);
      case 'host_page_press':
        return this.press(params);
      case 'host_page_select':
        return this.select(params);
      case 'host_page_scroll':
        return this.scroll(params);
      case 'host_page_navigate':
        return this.navigate(params);
    }
  }

  snapshot(): HostPageSnapshot {
    this.refs.clear();
    this.nextRef = 1;

    const root = this.getRoot();
    const doc = getOwnerDocument(root);
    const view = getWindow(root);
    const elements = collectElements(root).map((element) =>
      this.snapshotElement(element),
    );

    return {
      url: view.location.href,
      title: doc.title,
      viewport: {
        width: view.innerWidth,
        height: view.innerHeight,
      },
      scroll: {
        x: view.scrollX,
        y: view.scrollY,
      },
      elements,
    };
  }

  private getRoot(): Document | ShadowRoot {
    return this.options.root ?? document;
  }

  private snapshotElement(element: Element): HostPageAutomationElementSnapshot {
    const ref = `e${this.nextRef}`;
    this.nextRef += 1;
    this.refs.set(ref, element);

    const placeholder =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
        ? element.placeholder || undefined
        : undefined;

    return {
      ref,
      tag: element.tagName.toLowerCase(),
      role: inferRole(element),
      name: getElementName(element),
      text: getElementText(element),
      value: getElementValue(element),
      placeholder,
      selector: createSelector(element),
      disabled: isDisabled(element),
      checked: isChecked(element),
      rect: getGlobalRect(element),
    };
  }

  private resolveElement(params: ResolvableTargetParams): Element {
    const ref = readOptionalString(params.ref);
    if (ref) {
      const element = this.refs.get(ref);
      if (!element) {
        throw new Error(`Unknown element ref: ${ref}. Take a new snapshot.`);
      }
      return element;
    }

    const selector = readOptionalString(params.selector);
    if (selector) {
      const element = this.getRoot().querySelector(selector);
      if (!element) {
        throw new Error(`No element matches selector: ${selector}.`);
      }
      return element;
    }

    if (typeof params.x !== 'undefined' || typeof params.y !== 'undefined') {
      const point = {
        x: readNumber(params.x, 'x'),
        y: readNumber(params.y, 'y'),
      };
      const element = getOwnerDocument(this.getRoot()).elementFromPoint(
        point.x,
        point.y,
      );
      if (!element) {
        throw new Error(`No element found at (${point.x}, ${point.y}).`);
      }
      return element;
    }

    throw new Error('Expected one of ref, selector, or x/y.');
  }

  private click(params: Record<string, unknown>) {
    const element = this.resolveElement(normalizeParams(params));
    focusElement(element);

    if (element instanceof HTMLElement) {
      element.click();
    } else {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    return { clicked: this.describeElement(element) };
  }

  private fill(params: Record<string, unknown>) {
    const input = normalizeParams(params) as FillParams;
    const value = readString(input.value, 'value');
    const element = this.resolveElement(input);

    focusElement(element);
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      setNativeValue(element, value);
      dispatchInputEvents(element);
      return { filled: this.describeElement(element), value };
    }

    if (element instanceof HTMLElement && element.isContentEditable) {
      element.textContent = value;
      dispatchInputEvents(element);
      return { filled: this.describeElement(element), value };
    }

    throw new Error('Target element cannot be filled.');
  }

  private press(params: Record<string, unknown>) {
    const input = normalizeParams(params) as PressParams;
    const key = readString(input.key, 'key');
    const element =
      input.ref ||
      input.selector ||
      (input.x !== undefined && input.y !== undefined)
        ? this.resolveElement(input)
        : (getOwnerDocument(this.getRoot()).activeElement ??
          getOwnerDocument(this.getRoot()).body);

    if (!element) {
      throw new Error('No target element is available for key press.');
    }

    focusElement(element);
    const eventInit = { key, bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    if (key.length === 1) {
      element.dispatchEvent(new KeyboardEvent('keypress', eventInit));
    }
    element.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    return { pressed: key, target: this.describeElement(element) };
  }

  private select(params: Record<string, unknown>) {
    const input = normalizeParams(params) as SelectParams;
    const values = readStringList(input.values ?? input.value);
    const element = this.resolveElement(input);

    if (!(element instanceof HTMLSelectElement)) {
      throw new Error('Target element is not a select.');
    }

    const valueSet = new Set(values);
    for (const option of Array.from(element.options)) {
      option.selected = valueSet.has(option.value);
    }

    dispatchInputEvents(element);
    return {
      selected: Array.from(element.selectedOptions).map(
        (option) => option.value,
      ),
      target: this.describeElement(element),
    };
  }

  private scroll(params: Record<string, unknown>) {
    const input = normalizeParams(params) as ScrollParams;
    const absolute: Point | null =
      input.x !== undefined || input.y !== undefined
        ? {
            x: readOptionalNumber(input.x) ?? 0,
            y: readOptionalNumber(input.y) ?? 0,
          }
        : null;
    const deltaX = readOptionalNumber(input.deltaX) ?? 0;
    const deltaY = readOptionalNumber(input.deltaY) ?? 0;
    const root = this.getRoot();
    const view = getWindow(root);

    if (input.ref || input.selector) {
      const element = this.resolveElement(input);
      if (!(element instanceof HTMLElement)) {
        throw new Error('Target element cannot be scrolled.');
      }
      if (absolute) {
        element.scrollTo?.(absolute.x, absolute.y);
      } else {
        element.scrollBy?.(deltaX, deltaY);
      }
      return {
        scrolled: this.describeElement(element),
        scroll: { x: element.scrollLeft, y: element.scrollTop },
      };
    }

    if (absolute) {
      view.scrollTo?.(absolute.x, absolute.y);
    } else {
      view.scrollBy?.(deltaX, deltaY);
    }

    return { scroll: { x: view.scrollX, y: view.scrollY } };
  }

  private navigate(params: Record<string, unknown>) {
    if (this.options.allowNavigation === false) {
      throw new Error('Navigation is disabled for host page automation.');
    }

    const input = normalizeParams(params) as NavigateParams;
    const root = this.getRoot();
    const view = getWindow(root);
    const rawUrl = readString(input.url, 'url');
    const nextUrl = new URL(rawUrl, view.location.href);
    if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
      throw new Error('Navigation only supports HTTP(S) URLs.');
    }

    this.refs.clear();
    view.location.assign(nextUrl.toString());
    return { navigated: nextUrl.toString() };
  }

  private describeElement(element: Element) {
    return {
      tag: element.tagName.toLowerCase(),
      role: inferRole(element),
      name: getElementName(element),
      selector: createSelector(element),
    };
  }
}
