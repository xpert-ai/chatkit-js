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
  axRef?: unknown;
  selector?: unknown;
  role?: unknown;
  name?: unknown;
  text?: unknown;
  testId?: unknown;
  x?: unknown;
  y?: unknown;
};

type FillParams = ResolvableTargetParams & {
  value?: unknown;
};

type PressParams = ResolvableTargetParams & {
  key?: unknown;
};

type HoverParams = ResolvableTargetParams;

type FocusParams = ResolvableTargetParams;

type PointerParams = ResolvableTargetParams & {
  action?: unknown;
  toX?: unknown;
  toY?: unknown;
  button?: unknown;
};

type WaitForParams = ResolvableTargetParams & {
  state?: unknown;
  timeoutSeconds?: unknown;
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

type Actionability = {
  visible: boolean;
  enabled: boolean;
  receivesEvents: boolean;
  actionable: boolean;
  center?: Point;
  hitTarget?: Element;
  hitStack: Element[];
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
  '[data-test-id]',
  '[data-qa]',
].join(',');

const MAX_SNAPSHOT_ELEMENTS = 100;
const WAIT_FOR_DEFAULT_TIMEOUT_MS = 10_000;
const WAIT_FOR_MAX_TIMEOUT_MS = 60_000;

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

function readOptionalInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value)
    ? value
    : undefined;
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

function readOptionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
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

function getElementOwnText(element: Element): string | undefined {
  const text = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
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

  const nearbyText = getNearbyText(element)[0];
  if (nearbyText) {
    return nearbyText;
  }

  return getElementText(element);
}

function isTextOnlyLabelCandidate(element: Element): boolean {
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
    return false;
  }

  if (!isVisibleCandidate(element)) {
    return false;
  }

  if (
    element.matches(
      'input,textarea,select,button,a[href],[role="button"],[role="link"]',
    )
  ) {
    return false;
  }

  const text = getElementOwnText(element) ?? getElementText(element);
  return Boolean(text && text.length <= 120);
}

function getNearbyText(element: Element): string[] {
  const doc = element.ownerDocument;
  const body = doc.body;
  if (!body) {
    return [];
  }

  const targetRect = element.getBoundingClientRect();
  if (targetRect.width <= 0 || targetRect.height <= 0) {
    return [];
  }

  const targetCenterY = targetRect.top + targetRect.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const candidates: Array<{ text: string; score: number }> = [];
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();

  while (node) {
    const candidate = node as Element;
    if (candidate !== element && isTextOnlyLabelCandidate(candidate)) {
      const rect = candidate.getBoundingClientRect();
      const text = getElementOwnText(candidate) ?? getElementText(candidate);
      if (text) {
        const centerY = rect.top + rect.height / 2;
        const centerX = rect.left + rect.width / 2;
        const sameRow =
          rect.right <= targetRect.left + 12 &&
          Math.abs(centerY - targetCenterY) <=
            Math.max(28, targetRect.height * 1.25);
        const above =
          rect.bottom <= targetRect.top + 8 &&
          targetRect.top - rect.bottom <= 80 &&
          centerX >= targetRect.left - 80 &&
          centerX <= targetRect.right + 80;

        if (sameRow || above) {
          const distance = sameRow
            ? targetRect.left - rect.right + Math.abs(centerY - targetCenterY)
            : targetRect.top - rect.bottom + Math.abs(centerX - targetCenterX);
          candidates.push({
            text,
            score: distance + (sameRow ? 0 : 100),
          });
        }
      }
    }

    node = walker.nextNode();
  }

  const seen = new Set<string>();
  return candidates
    .sort((left, right) => left.score - right.score)
    .map((candidate) => candidate.text)
    .filter((text) => {
      if (seen.has(text)) {
        return false;
      }
      seen.add(text);
      return true;
    })
    .slice(0, 4);
}

function getElementTestId(element: Element): string | undefined {
  return (
    element.getAttribute('data-testid') ??
    element.getAttribute('data-test-id') ??
    element.getAttribute('data-qa') ??
    undefined
  );
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

function getElementCenter(element: Element): Point | undefined {
  const rect = getGlobalRect(element);
  if (rect.width <= 0 || rect.height <= 0) {
    return undefined;
  }

  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function summarizeElement(element: Element) {
  return {
    tag: element.tagName.toLowerCase(),
    role: inferRole(element),
    name: getElementName(element),
    selector: createSelector(element),
  };
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

function isElementEnabled(element: Element): boolean {
  return isDisabled(element) !== true;
}

function isActionableCandidate(element: Element): boolean {
  if (isCandidateElement(element)) {
    return true;
  }

  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style?.cursor === 'pointer') {
    return isVisibleCandidate(element);
  }

  return Boolean(element.onclick) && isVisibleCandidate(element);
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

  for (const attribute of ['data-testid', 'data-test-id', 'data-qa']) {
    const testId = element.getAttribute(attribute);
    if (testId) {
      return `[${attribute}="${escapeSelectorValue(testId)}"]`;
    }
  }

  const name = element.getAttribute('name');
  if (name) {
    return `${element.tagName.toLowerCase()}[name="${escapeSelectorValue(
      name,
    )}"]`;
  }

  return element.tagName.toLowerCase();
}

function getViewportPoint(element: Element): Point | undefined {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return undefined;
  }

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getElementsFromPoint(doc: Document, point: Point): Element[] {
  if (typeof doc.elementsFromPoint === 'function') {
    return doc.elementsFromPoint(point.x, point.y);
  }

  if (typeof doc.elementFromPoint !== 'function') {
    return [];
  }

  const element = doc.elementFromPoint(point.x, point.y);
  return element ? [element] : [];
}

function canHitTest(doc: Document): boolean {
  return (
    typeof doc.elementsFromPoint === 'function' ||
    typeof doc.elementFromPoint === 'function'
  );
}

function containsOrEquals(parent: Element, child: Element): boolean {
  return parent === child || parent.contains(child);
}

function findActionableAncestor(element: Element): Element {
  let current: Element | null = element;
  while (current) {
    if (isActionableCandidate(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return element;
}

function normalizeSemanticText(value: string | undefined): string {
  return (value ?? '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function getReceivesEventsPoint(element: Element): Point | undefined {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return undefined;
  }

  const doc = element.ownerDocument;
  const points = [
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    { x: rect.left + Math.min(8, rect.width / 2), y: rect.top + rect.height / 2 },
    { x: rect.right - Math.min(8, rect.width / 2), y: rect.top + rect.height / 2 },
    { x: rect.left + rect.width / 2, y: rect.top + Math.min(8, rect.height / 2) },
    { x: rect.left + rect.width / 2, y: rect.bottom - Math.min(8, rect.height / 2) },
  ];

  return points.find((point) =>
    getElementsFromPoint(doc, point).some(
      (hit) => containsOrEquals(element, hit) || containsOrEquals(hit, element),
    ),
  );
}

function findSemanticVisibleFallback(
  root: Document | ShadowRoot,
  requested: Element,
): Element | null {
  const requestedRole = inferRole(requested);
  const requestedName = normalizeSemanticText(getElementName(requested));
  if (!requestedName) {
    return null;
  }

  const candidates = collectElements(root)
    .filter((candidate) => candidate !== requested)
    .filter((candidate) => {
      const candidateRole = inferRole(candidate);
      const candidateName = normalizeSemanticText(getElementName(candidate));
      if (requestedRole && candidateRole && requestedRole !== candidateRole) {
        return false;
      }

      return (
        candidateName.includes(requestedName) ||
        requestedName.includes(candidateName)
      );
    })
    .map((candidate) => ({
      candidate,
      point: getReceivesEventsPoint(candidate),
      rect: getGlobalRect(candidate),
    }))
    .filter((entry): entry is { candidate: Element; point: Point; rect: ReturnType<typeof getGlobalRect> } =>
      Boolean(entry.point),
    )
    .sort((left, right) => right.rect.y - left.rect.y);

  return candidates[0]?.candidate ?? null;
}

function getActionability(element: Element): Actionability {
  const doc = element.ownerDocument;
  const center = getViewportPoint(element);
  const visible = isVisibleCandidate(element) && Boolean(center);
  const enabled = isElementEnabled(element);
  const hitStack = center ? getElementsFromPoint(doc, center) : [];
  const hitTarget = hitStack[0];
  const receivesEvents = Boolean(
    hitTarget &&
      (containsOrEquals(element, hitTarget) ||
        containsOrEquals(hitTarget, element)),
  );

  return {
    visible,
    enabled,
    receivesEvents,
    actionable: visible && enabled && receivesEvents,
    center: getElementCenter(element),
    hitTarget,
    hitStack,
  };
}

function findBySemanticTarget(
  root: Document | ShadowRoot,
  params: ResolvableTargetParams,
): Element | null {
  const testId = readOptionalString(params.testId);
  if (testId) {
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(testId)
        : testId.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    const element = root.querySelector(
      `[data-testid="${escaped}"],[data-test-id="${escaped}"],[data-qa="${escaped}"]`,
    );
    if (element) {
      return element;
    }
  }

  const role = readOptionalString(params.role)?.toLowerCase();
  const name = readOptionalString(params.name)?.toLowerCase();
  const text = readOptionalString(params.text)?.toLowerCase();
  if (!role && !name && !text) {
    return null;
  }

  const elements = collectElements(root);
  return (
    elements.find((element) => {
      const elementRole = inferRole(element)?.toLowerCase();
      const elementName = getElementName(element)?.toLowerCase();
      const elementText = getElementText(element)?.toLowerCase();

      if (role && elementRole !== role) {
        return false;
      }
      if (name && !elementName?.includes(name)) {
        return false;
      }
      if (text && !elementText?.includes(text)) {
        return false;
      }
      return true;
    }) ?? null
  );
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

function createPointerLikeEvent(
  type: string,
  init: MouseEventInit,
): Event {
  if (typeof PointerEvent === 'function') {
    return new PointerEvent(type, init);
  }

  return new MouseEvent(type.replace('pointer', 'mouse'), init);
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
      case 'host_page_hover':
        return this.hover(params);
      case 'host_page_focus':
        return this.focus(params);
      case 'host_page_pointer':
        return this.pointer(params);
      case 'host_page_screenshot':
        return this.screenshot();
      case 'host_page_wait_for':
        return this.waitFor(params);
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
      capabilities: {
        cdp: false,
        realInput: false,
        screenshot: false,
        accessibility: false,
        networkState: false,
      },
      viewport: {
        width: view.innerWidth,
        height: view.innerHeight,
        devicePixelRatio: view.devicePixelRatio,
      },
      scroll: {
        x: view.scrollX,
        y: view.scrollY,
      },
      page: {
        readyState: doc.readyState,
        visibilityState: doc.visibilityState,
        focusedElement:
          doc.activeElement && doc.activeElement !== doc.body
            ? this.snapshotElementWithoutRef(doc.activeElement)
            : undefined,
        selection: doc.getSelection?.()?.toString() || undefined,
      },
      navigation: this.getNavigationState(view),
      frames: this.getFrameState(doc),
      accessibility: elements.map((element) => ({
        ref: element.ref,
        role: element.role,
        name: element.name,
        value: element.value,
        disabled: element.disabled,
        checked: element.checked,
        focused: doc.activeElement === this.refs.get(element.ref),
      })),
      elements,
    };
  }

  private getRoot(): Document | ShadowRoot {
    return this.options.root ?? document;
  }

  private getNavigationState(view: Window): HostPageSnapshot['navigation'] {
    const navigation = view.performance?.getEntriesByType?.('navigation')?.[0];
    if (
      typeof PerformanceNavigationTiming !== 'function' ||
      !(navigation instanceof PerformanceNavigationTiming)
    ) {
      return undefined;
    }

    return {
      type: navigation.type,
      duration: navigation.duration,
      domContentLoaded:
        navigation.domContentLoadedEventEnd - navigation.startTime,
      loadEventEnd: navigation.loadEventEnd - navigation.startTime,
    };
  }

  private getFrameState(doc: Document): HostPageSnapshot['frames'] {
    return Array.from(doc.querySelectorAll('iframe')).map((frame) => {
      const rect = getGlobalRect(frame);
      try {
        return {
          url: frame.contentWindow?.location.href,
          title: frame.contentDocument?.title,
          sameOrigin: true,
          rect,
        };
      } catch {
        return {
          url: frame.getAttribute('src') ?? undefined,
          sameOrigin: false,
          rect,
        };
      }
    });
  }

  private snapshotElement(element: Element): HostPageAutomationElementSnapshot {
    const ref = `e${this.nextRef}`;
    this.nextRef += 1;
    this.refs.set(ref, element);

    return this.createElementSnapshot(element, ref);
  }

  private snapshotElementWithoutRef(
    element: Element,
  ): HostPageAutomationElementSnapshot {
    return this.createElementSnapshot(element, '');
  }

  private createElementSnapshot(
    element: Element,
    ref: string,
  ): HostPageAutomationElementSnapshot {

    const placeholder =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
        ? element.placeholder || undefined
        : undefined;
    const actionability = getActionability(element);

    return {
      ref,
      tag: element.tagName.toLowerCase(),
      role: inferRole(element),
      name: getElementName(element),
      text: getElementText(element),
      nearbyText: getNearbyText(element),
      testId: getElementTestId(element),
      value: getElementValue(element),
      placeholder,
      selector: createSelector(element),
      disabled: isDisabled(element),
      enabled: actionability.enabled,
      checked: isChecked(element),
      visible: actionability.visible,
      actionable: actionability.actionable,
      rect: getGlobalRect(element),
      center: actionability.center,
      hitTarget: actionability.hitTarget
        ? summarizeElement(actionability.hitTarget)
        : undefined,
      hitStack: actionability.hitStack.slice(0, 5).map(summarizeElement),
    };
  }

  private resolveElement(params: ResolvableTargetParams): Element {
    const ref = readOptionalString(params.ref) ?? readOptionalString(params.axRef);
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

    const semanticElement = findBySemanticTarget(this.getRoot(), params);
    if (semanticElement) {
      return semanticElement;
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

    throw new Error(
      'Expected one of ref, selector, role/name/text/testId, or x/y.',
    );
  }

  private click(params: Record<string, unknown>) {
    const input = normalizeParams(params);
    const requestedElement = this.resolveElement(input);
    const actionability = getActionability(requestedElement);
    const fallback = actionability.actionable
      ? null
      : findSemanticVisibleFallback(this.getRoot(), requestedElement);
    const target = fallback ?? findActionableAncestor(requestedElement);
    const targetPoint = getReceivesEventsPoint(target);
    if (
      !targetPoint &&
      !actionability.actionable &&
      canHitTest(requestedElement.ownerDocument)
    ) {
      throw new Error(
        `Target "${getElementName(requestedElement) ?? requestedElement.tagName.toLowerCase()}" is not receiving pointer events. Take a screenshot or use host_page_pointer coordinates.`,
      );
    }

    focusElement(target);

    if (target instanceof HTMLElement) {
      target.click();
    } else {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    return {
      clicked: this.describeElement(target),
      requested: this.describeElement(requestedElement),
      strategy:
        target === requestedElement ? 'dom' : 'semantic_visible_fallback',
      point: targetPoint ?? actionability.center,
      actionability: {
        visible: actionability.visible,
        enabled: actionability.enabled,
        receivesEvents: actionability.receivesEvents,
      },
    };
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

    if (
      input.ref ||
      input.selector ||
      input.role ||
      input.name ||
      input.text ||
      input.testId
    ) {
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

  private hover(params: Record<string, unknown>) {
    const input = normalizeParams(params) as HoverParams;
    const element = this.resolveElement(input);
    const point = getActionability(element).center;

    element.dispatchEvent(
      new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        clientX: point?.x,
        clientY: point?.y,
      }),
    );
    element.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: point?.x,
        clientY: point?.y,
      }),
    );

    return { hovered: this.describeElement(element), point };
  }

  private focus(params: Record<string, unknown>) {
    const input = normalizeParams(params) as FocusParams;
    const element = this.resolveElement(input);
    focusElement(element);
    return { focused: this.describeElement(element) };
  }

  private pointer(params: Record<string, unknown>) {
    const input = normalizeParams(params) as PointerParams;
    const action =
      readOptionalEnum(input.action, ['move', 'down', 'up', 'click'] as const) ??
      'click';
    const button = readOptionalInteger(input.button) ?? 0;
    const element =
      input.ref ||
      input.selector ||
      input.role ||
      input.name ||
      input.text ||
      input.testId
        ? this.resolveElement(input)
        : null;
    const point = element
      ? getActionability(element).center
      : {
          x: readNumber(input.x, 'x'),
          y: readNumber(input.y, 'y'),
        };
    if (!point) {
      throw new Error('Target element has no clickable point.');
    }
    const target =
      element ??
      getOwnerDocument(this.getRoot()).elementFromPoint(point.x, point.y);

    if (!target) {
      throw new Error(`No element found at (${point.x}, ${point.y}).`);
    }

    const eventInit = {
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      button,
    };

    if (action === 'move') {
      target.dispatchEvent(createPointerLikeEvent('pointermove', eventInit));
      target.dispatchEvent(new MouseEvent('mousemove', eventInit));
    } else if (action === 'down') {
      target.dispatchEvent(createPointerLikeEvent('pointerdown', eventInit));
      target.dispatchEvent(new MouseEvent('mousedown', eventInit));
    } else if (action === 'up') {
      target.dispatchEvent(createPointerLikeEvent('pointerup', eventInit));
      target.dispatchEvent(new MouseEvent('mouseup', eventInit));
    } else {
      target.dispatchEvent(createPointerLikeEvent('pointerdown', eventInit));
      target.dispatchEvent(new MouseEvent('mousedown', eventInit));
      target.dispatchEvent(createPointerLikeEvent('pointerup', eventInit));
      target.dispatchEvent(new MouseEvent('mouseup', eventInit));
      if (target instanceof HTMLElement) {
        target.click();
      } else {
        target.dispatchEvent(new MouseEvent('click', eventInit));
      }
    }

    return {
      pointer: action,
      point,
      target: this.describeElement(target),
    };
  }

  private screenshot() {
    throw new Error(
      'host_page_screenshot requires the browser extension CDP adapter.',
    );
  }

  private async waitFor(params: Record<string, unknown>) {
    const input = normalizeParams(params) as WaitForParams;
    const state =
      readOptionalEnum(input.state, [
        'attached',
        'visible',
        'hidden',
        'detached',
      ] as const) ?? 'visible';
    const timeoutSeconds = readOptionalNumber(input.timeoutSeconds);
    const timeoutMs = Math.min(
      WAIT_FOR_MAX_TIMEOUT_MS,
      Math.max(0, (timeoutSeconds ?? WAIT_FOR_DEFAULT_TIMEOUT_MS / 1_000) * 1_000),
    );
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const element = this.tryResolveElement(input);
      const matched =
        state === 'attached'
          ? Boolean(element)
          : state === 'detached'
            ? !element
            : state === 'hidden'
              ? !element || !isVisibleCandidate(element)
              : Boolean(element && isVisibleCandidate(element));

      if (matched) {
        return {
          waitedFor: state,
          elapsedMs: Date.now() - startedAt,
          target: element ? this.describeElement(element) : undefined,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timed out waiting for target to become ${state}.`);
  }

  private tryResolveElement(params: ResolvableTargetParams): Element | null {
    try {
      return this.resolveElement(params);
    } catch {
      return null;
    }
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
