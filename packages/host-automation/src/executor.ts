import {
  HOST_PAGE_AUTOMATION_TOOL_NAMES,
  type ActionExpectation,
  type BrowserActionApprovalReason,
  type BrowserActionRisk,
  type BrowserDocumentDescriptor,
  type BrowserAutomationErrorCode,
  type HostPageAutomationElementSnapshot,
  type HostPageAutomationOptions,
  type HostPageAutomationToolName,
  type HostPageAutomationVisualEffectContext,
  type HostPageReadableContent,
  type HostPageSnapshot,
  type ObservationScope,
  type ObservationTargetDescriptor,
  type TargetDescriptor,
  type TargetResolution,
  type VerificationResult,
} from './types';
import {
  createHostPageReadableContentIndex,
  extractHostPageReadableContent,
  readHostPageReadableContent,
  type HostPageReadParams,
} from './readable-content';

type Point = { x: number; y: number };

type ResolvableTargetParams = {
  pageStateId?: unknown;
  documentRef?: unknown;
  ref?: unknown;
  axRef?: unknown;
  selector?: unknown;
  role?: unknown;
  name?: unknown;
  text?: unknown;
  testId?: unknown;
  x?: unknown;
  y?: unknown;
  coordinateSpace?: unknown;
  targetText?: unknown;
  targetRole?: unknown;
  targetContext?: unknown;
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
  expectedAfterClick?: unknown;
};

type ExpectedAfterClickFieldContains = {
  type: 'field_contains';
  field: string;
  value: string;
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

type ReadParams = {
  blockId?: unknown;
  query?: unknown;
  page?: unknown;
  pageSize?: unknown;
  maxChars?: unknown;
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
  safeClickPoints: Point[];
  occludedBy?: Element;
};

type ElementIdentityFingerprint = {
  tag: string;
  role?: string;
  name?: string;
  testId?: string;
};

type ElementRefEntry = {
  element: Element;
  pageStateId: string;
  documentRef: string;
  fingerprint: ElementIdentityFingerprint;
};

type ObservationResolution =
  | { status: 'not_found' }
  | { status: 'ambiguous' }
  | { status: 'unique'; element: Element };

type ExpectationCheck = {
  matched: boolean;
  terminalFailure?: boolean;
  actual?: string | boolean | null;
};

class HostPageAutomationStructuredError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, unknown>,
  ) {
    super(message);
  }
}

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
const POSTCONDITION_DEFAULT_TIMEOUT_MS = 10_000;
const POSTCONDITION_POLL_INTERVAL_MS = 100;
const ACTION_APPROVAL_TTL_MS = 60_000;
const SNAPSHOT_CACHE_TTL_MS = 2 * 60_000;
const PAGE_STATE_ATTRIBUTE_FILTER = [
  'id',
  'role',
  'aria-label',
  'aria-labelledby',
  'data-testid',
  'data-test-id',
  'data-qa',
  'name',
  'disabled',
  'aria-disabled',
  'hidden',
] as const;

function createPageStateId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

type PendingActionApproval = {
  action: HostPageAutomationToolName;
  actionHash: string;
  expiresAt: number;
  origin: string;
  pageStateId: string;
  risks: BrowserActionRisk[];
  targetHash: string;
  url: string;
};

function canonicalizeActionValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeActionValue);
  }
  if (typeof value !== 'object') {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entry]) => key !== 'actionToken' && entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizeActionValue(entry)]),
  );
}

async function hashActionValue(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify(canonicalizeActionValue(value)),
  );
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function isHostPageAutomationToolName(
  value: string,
): value is HostPageAutomationToolName {
  return AUTOMATION_TOOL_NAME_SET.has(value);
}

function getOwnerDocument(root: Document | ShadowRoot): Document {
  if (root.nodeType === 9) {
    return root as Document;
  }
  if (!root.ownerDocument) {
    throw new Error('Host automation root has no owner document.');
  }
  return root.ownerDocument;
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

function readCoordinateSpace(
  value: unknown,
): 'viewport-css-px' | 'viewport_normalized' {
  return value === 'viewport_normalized'
    ? 'viewport_normalized'
    : 'viewport-css-px';
}

function readPointerAction(value: unknown) {
  return (
    readOptionalEnum(value, ['move', 'down', 'up', 'click'] as const) ?? 'click'
  );
}

function readPoint(
  root: Document | ShadowRoot,
  params: ResolvableTargetParams,
): Point {
  const x = readNumber(params.x, 'x');
  const y = readNumber(params.y, 'y');
  if (readCoordinateSpace(params.coordinateSpace) === 'viewport_normalized') {
    const view = getWindow(root);
    return {
      x: Number((x * view.innerWidth).toFixed(3)),
      y: Number((y * view.innerHeight).toFixed(3)),
    };
  }

  return { x, y };
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

function isInputElement(element: Element): element is HTMLInputElement {
  return element.tagName.toLowerCase() === 'input';
}

function isTextAreaElement(element: Element): element is HTMLTextAreaElement {
  return element.tagName.toLowerCase() === 'textarea';
}

function isSelectElement(element: Element): element is HTMLSelectElement {
  return element.tagName.toLowerCase() === 'select';
}

function isButtonElement(element: Element): element is HTMLButtonElement {
  return element.tagName.toLowerCase() === 'button';
}

function isFrameElement(element: Element): element is HTMLIFrameElement {
  return element.tagName.toLowerCase() === 'iframe';
}

function isHtmlElement(element: Element): element is HTMLElement {
  const constructor = element.ownerDocument.defaultView?.HTMLElement;
  return Boolean(constructor && element instanceof constructor);
}

function isSvgElement(element: Element): element is SVGElement {
  const constructor = element.ownerDocument.defaultView?.SVGElement;
  return Boolean(constructor && element instanceof constructor);
}

function getElementValue(element: Element): string | undefined {
  if (
    isInputElement(element) ||
    isTextAreaElement(element) ||
    isSelectElement(element)
  ) {
    return element.value;
  }

  return undefined;
}

function isChoiceInput(element: Element): element is HTMLInputElement {
  return (
    isInputElement(element) &&
    (element.type === 'checkbox' || element.type === 'radio')
  );
}

function getControlLabels(element: Element): HTMLLabelElement[] {
  if (
    isInputElement(element) ||
    isSelectElement(element) ||
    isTextAreaElement(element)
  ) {
    return Array.from(element.labels ?? []);
  }

  return [];
}

function getTextByElementIds(element: Element, attribute: string): string[] {
  const ids = element.getAttribute(attribute)?.trim().split(/\s+/) ?? [];
  return ids
    .map((id) => element.ownerDocument.getElementById(id))
    .filter((target): target is HTMLElement => Boolean(target))
    .map((target) => getElementText(target))
    .filter((text): text is string => Boolean(text));
}

function getExplicitControlLabel(element: Element): string | undefined {
  const ariaLabelledBy = getTextByElementIds(element, 'aria-labelledby');
  if (ariaLabelledBy.length > 0) {
    return ariaLabelledBy.join(' ').slice(0, 160);
  }

  const labels = getControlLabels(element)
    .map((label) => getElementText(label))
    .filter((text): text is string => Boolean(text));
  if (labels.length > 0) {
    return labels.join(' ').slice(0, 160);
  }

  return undefined;
}

function getAdjacentTextAfter(element: Element): string | undefined {
  const segments: string[] = [];
  let node = element.nextSibling;

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) {
        segments.push(text);
      }
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).tagName.toLowerCase() === 'br'
    ) {
      break;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const siblingElement = node as Element;
      if (
        siblingElement.matches(
          'input,textarea,select,button,a[href],[role="button"],[role="link"]',
        )
      ) {
        break;
      }
      const text = getElementText(siblingElement);
      if (text) {
        segments.push(text);
      }
      break;
    }

    if (segments.join(' ').length >= 120) {
      break;
    }
    node = node.nextSibling;
  }

  const text = segments.join(' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 160) : undefined;
}

function getSameRowText(
  element: Element,
  side: 'left' | 'right',
): string | undefined {
  const doc = element.ownerDocument;
  const body = doc.body;
  if (!body) {
    return undefined;
  }

  const targetRect = element.getBoundingClientRect();
  if (targetRect.width <= 0 || targetRect.height <= 0) {
    return undefined;
  }

  const targetCenterY = targetRect.top + targetRect.height / 2;
  const candidates: Array<{ text: string; score: number }> = [];
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();

  while (node) {
    const candidate = node as Element;
    if (
      candidate !== element &&
      !candidate.contains(element) &&
      isTextOnlyLabelCandidate(candidate)
    ) {
      const rect = candidate.getBoundingClientRect();
      const text = getElementOwnText(candidate) ?? getElementText(candidate);
      if (text) {
        const centerY = rect.top + rect.height / 2;
        const sameRow =
          Math.abs(centerY - targetCenterY) <=
          Math.max(28, targetRect.height * 1.25);
        const distance =
          side === 'left'
            ? targetRect.left - rect.right
            : rect.left - targetRect.right;

        if (sameRow && distance >= -8 && distance <= 240) {
          candidates.push({
            text,
            score: Math.abs(distance) + Math.abs(centerY - targetCenterY),
          });
        }
      }
    }
    node = walker.nextNode();
  }

  return candidates.sort((left, right) => left.score - right.score)[0]?.text;
}

function getControlLabel(element: Element): string | undefined {
  if (
    !(
      isInputElement(element) ||
      isSelectElement(element) ||
      isTextAreaElement(element)
    )
  ) {
    return undefined;
  }

  const explicit = getExplicitControlLabel(element);
  if (explicit) {
    return explicit;
  }

  if (isChoiceInput(element)) {
    return (
      getSameRowText(element, 'right') ??
      getAdjacentTextAfter(element) ??
      getNearbyText(element)[0]
    );
  }

  return getSameRowText(element, 'left') ?? getNearbyText(element)[0];
}

function isWeakControlName(element: Element, name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (isInputElement(element) && element.type === 'radio') {
    return normalized === 'radio' || normalized === 'radio button';
  }
  if (isInputElement(element) && element.type === 'checkbox') {
    return normalized === 'checkbox' || normalized === 'check box';
  }
  if (isSelectElement(element)) {
    return (
      normalized === 'select' ||
      normalized === 'select menu' ||
      normalized === 'combobox' ||
      normalized === 'combo box'
    );
  }
  return false;
}

function getElementName(element: Element): string | undefined {
  const controlLabel = getControlLabel(element);
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel?.trim() && !isWeakControlName(element, ariaLabel)) {
    return ariaLabel.trim();
  }

  const title = element.getAttribute('title');
  if (title?.trim() && !isWeakControlName(element, title)) {
    return title.trim();
  }

  if (controlLabel) {
    return controlLabel;
  }

  const nearbyText = getNearbyText(element)[0];
  if (nearbyText) {
    return nearbyText;
  }

  return getElementText(element);
}

function isTextOnlyLabelCandidate(element: Element): boolean {
  if (!(isHtmlElement(element) || isSvgElement(element))) {
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

function getChoiceGroupLabel(element: Element): string | undefined {
  if (!isChoiceInput(element)) {
    return undefined;
  }

  const fieldset = element.closest('fieldset');
  const legend = fieldset?.querySelector('legend');
  const legendText = legend ? getElementText(legend) : undefined;
  if (legendText) {
    return legendText;
  }

  const doc = element.ownerDocument;
  const body = doc.body;
  if (!body) {
    return undefined;
  }

  const targetRect = element.getBoundingClientRect();
  if (targetRect.width <= 0 || targetRect.height <= 0) {
    return undefined;
  }

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const candidates: Array<{ text: string; score: number }> = [];
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();

  while (node) {
    const candidate = node as Element;
    if (
      candidate !== element &&
      !candidate.contains(element) &&
      candidate.matches('legend,strong,b,[role="heading"],h1,h2,h3,h4,h5,h6') &&
      isTextOnlyLabelCandidate(candidate)
    ) {
      const rect = candidate.getBoundingClientRect();
      const text = getElementOwnText(candidate) ?? getElementText(candidate);
      if (text && rect.bottom <= targetRect.top + 8) {
        const verticalDistance = targetRect.top - rect.bottom;
        const centerX = rect.left + rect.width / 2;
        const aligned =
          verticalDistance <= 160 &&
          centerX >= targetRect.left - 120 &&
          centerX <= targetRect.right + 320;

        if (aligned) {
          candidates.push({
            text,
            score: verticalDistance + Math.abs(centerX - targetCenterX) * 0.25,
          });
        }
      }
    }
    node = walker.nextNode();
  }

  return candidates.sort((left, right) => left.score - right.score)[0]?.text;
}

function getSelectOptions(
  element: Element,
): HostPageAutomationElementSnapshot['options'] | undefined {
  if (!isSelectElement(element)) {
    return undefined;
  }

  const options = Array.from(element.options).map((option) => {
    const label = (option.label || option.textContent || option.value)
      .replace(/\s+/g, ' ')
      .trim();
    return {
      label: (label || option.value).slice(0, 160),
      value: option.value,
      selected: option.selected || undefined,
      disabled: option.disabled || undefined,
    };
  });

  return options.length ? options : undefined;
}

function getSelectedLabel(element: Element): string | undefined {
  if (!isSelectElement(element)) {
    return undefined;
  }

  const selected = element.selectedOptions[0];
  const label = selected
    ? (selected.label || selected.textContent || selected.value)
        .replace(/\s+/g, ' ')
        .trim()
    : undefined;

  return label ? label.slice(0, 160) : undefined;
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
    if (
      candidate !== element &&
      !candidate.contains(element) &&
      isTextOnlyLabelCandidate(candidate)
    ) {
      const rect = candidate.getBoundingClientRect();
      const text = getElementOwnText(candidate) ?? getElementText(candidate);
      if (text) {
        const centerY = rect.top + rect.height / 2;
        const centerX = rect.left + rect.width / 2;
        const sameRow =
          rect.right <= targetRect.left + 12 &&
          Math.abs(centerY - targetCenterY) <=
            Math.max(28, targetRect.height * 1.25);
        const sameRowRight =
          rect.left >= targetRect.right - 8 &&
          rect.left - targetRect.right <= 240 &&
          Math.abs(centerY - targetCenterY) <=
            Math.max(28, targetRect.height * 1.25);
        const above =
          rect.bottom <= targetRect.top + 8 &&
          targetRect.top - rect.bottom <= 80 &&
          centerX >= targetRect.left - 80 &&
          centerX <= targetRect.right + 80;

        if (sameRow || sameRowRight || above) {
          const distance = sameRow
            ? targetRect.left - rect.right + Math.abs(centerY - targetCenterY)
            : sameRowRight
              ? rect.left - targetRect.right + Math.abs(centerY - targetCenterY)
              : targetRect.top -
                rect.bottom +
                Math.abs(centerX - targetCenterX);
          candidates.push({
            text,
            score: distance + (sameRow ? 0 : sameRowRight ? 5 : 100),
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

  if (isInputElement(element)) {
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

function getElementIdentityFingerprint(
  element: Element,
): ElementIdentityFingerprint {
  return {
    tag: element.tagName.toLowerCase(),
    role: inferRole(element),
    name: getElementName(element),
    testId: getElementTestId(element),
  };
}

function hasIdentityConflict(
  expected: ElementIdentityFingerprint,
  element: Element,
): boolean {
  const actual = getElementIdentityFingerprint(element);
  return (
    actual.tag !== expected.tag ||
    actual.role !== expected.role ||
    normalizeSemanticText(actual.name) !==
      normalizeSemanticText(expected.name) ||
    actual.testId !== expected.testId
  );
}

function isDisabled(element: Element): boolean | undefined {
  if (
    isButtonElement(element) ||
    isInputElement(element) ||
    isSelectElement(element) ||
    isTextAreaElement(element)
  ) {
    return element.disabled || undefined;
  }

  return element.getAttribute('aria-disabled') === 'true' || undefined;
}

function isChecked(element: Element): boolean | undefined {
  return isInputElement(element) &&
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
  if (!(isHtmlElement(element) || isSvgElement(element))) {
    return false;
  }

  if (isHtmlElement(element) && element.hidden) {
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
  let current: Element | null = element;
  while (current) {
    if (isDisabled(current) === true) {
      return false;
    }
    current = current.parentElement;
  }

  return true;
}

function isActionableCandidate(element: Element): boolean {
  if (isCandidateElement(element)) {
    return true;
  }

  if (!isHtmlElement(element)) {
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

function getDocumentViewportPoint(doc: Document, point: Point): Point {
  let offsetX = 0;
  let offsetY = 0;
  let frameElement: Element | null = null;

  try {
    frameElement = doc.defaultView?.frameElement ?? null;
  } catch {
    frameElement = null;
  }

  while (frameElement) {
    const frameRect = frameElement.getBoundingClientRect();
    offsetX += frameRect.left;
    offsetY += frameRect.top;
    try {
      frameElement =
        frameElement.ownerDocument.defaultView?.frameElement ?? null;
    } catch {
      frameElement = null;
    }
  }

  return {
    x: point.x - offsetX,
    y: point.y - offsetY,
  };
}

function createSelector(element: Element): string | undefined {
  const escapeSelectorValue = (value: string) =>
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(value)
      : value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

  if (element.getRootNode() !== element.ownerDocument) {
    return undefined;
  }

  const uniqueSelector = (selector: string) => {
    try {
      return element.ownerDocument.querySelectorAll(selector).length === 1
        ? selector
        : undefined;
    } catch {
      return undefined;
    }
  };

  if (element.id) {
    return uniqueSelector(`#${escapeSelectorValue(element.id)}`);
  }

  for (const attribute of ['data-testid', 'data-test-id', 'data-qa']) {
    const testId = element.getAttribute(attribute);
    if (testId) {
      return uniqueSelector(`[${attribute}="${escapeSelectorValue(testId)}"]`);
    }
  }

  const name = element.getAttribute('name');
  if (name) {
    return uniqueSelector(
      `${element.tagName.toLowerCase()}[name="${escapeSelectorValue(name)}"]`,
    );
  }

  return undefined;
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
    if (isActionableCandidate(current) && isElementEnabled(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return element;
}

function getActivationRisks(element: Element): BrowserActionRisk[] {
  const risks = new Set<BrowserActionRisk>();
  let current: Element | null = element;

  while (current) {
    const tag = current.tagName.toLowerCase();
    if (
      (isButtonElement(current) &&
        current.form !== null &&
        current.type === 'submit') ||
      (isInputElement(current) &&
        current.form !== null &&
        (current.type === 'submit' || current.type === 'image'))
    ) {
      risks.add('form_submit');
    }
    if (tag === 'a') {
      const anchor = current as HTMLAnchorElement;
      if (anchor.hasAttribute('download')) {
        risks.add('download');
      }
    }
    current = current.parentElement;
  }

  return Array.from(risks);
}

function normalizeSemanticText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getReceivesEventsPoint(element: Element): Point | undefined {
  return getReceivesEventsPoints(element)[0];
}

function getReceivesEventsPoints(element: Element): Point[] {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return [];
  }

  const doc = element.ownerDocument;
  const points = [
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    {
      x: rect.left + Math.min(8, rect.width / 2),
      y: rect.top + rect.height / 2,
    },
    {
      x: rect.right - Math.min(8, rect.width / 2),
      y: rect.top + rect.height / 2,
    },
    {
      x: rect.left + rect.width / 2,
      y: rect.top + Math.min(8, rect.height / 2),
    },
    {
      x: rect.left + rect.width / 2,
      y: rect.bottom - Math.min(8, rect.height / 2),
    },
  ];

  return points.filter((point) => {
    const hitTarget = getElementsFromPoint(doc, point)[0];
    return hitTarget ? containsOrEquals(element, hitTarget) : false;
  });
}

function getGlobalPoint(element: Element, point: Point): Point {
  const rect = element.getBoundingClientRect();
  const globalRect = getGlobalRect(element);
  return {
    x: point.x + globalRect.x - rect.left,
    y: point.y + globalRect.y - rect.top,
  };
}

function getActionability(element: Element): Actionability {
  const doc = element.ownerDocument;
  const center = getViewportPoint(element);
  const visible = isVisibleCandidate(element) && Boolean(center);
  const enabled = isElementEnabled(element);
  const hitStack = center ? getElementsFromPoint(doc, center) : [];
  const hitTarget = hitStack[0];
  const safeClickPoints = getReceivesEventsPoints(element).map((point) =>
    getGlobalPoint(element, point),
  );
  const receivesEvents = safeClickPoints.length > 0;

  return {
    visible,
    enabled,
    receivesEvents,
    actionable: visible && enabled && receivesEvents,
    center: getElementCenter(element),
    hitTarget,
    hitStack,
    safeClickPoints,
    occludedBy: visible && enabled && !receivesEvents ? hitTarget : undefined,
  };
}

function findBySemanticTarget(
  doc: Document,
  params: ResolvableTargetParams,
): Element[] {
  const testId = readOptionalString(params.testId);
  if (testId) {
    return collectElements(doc).filter(
      (element) =>
        element.ownerDocument === doc && getElementTestId(element) === testId,
    );
  }

  const role = readOptionalString(params.role)?.toLowerCase();
  const name = normalizeSemanticText(readOptionalString(params.name));
  const text = normalizeSemanticText(readOptionalString(params.text));
  if (!role && !name && !text) {
    return [];
  }

  return collectElements(doc)
    .filter((element) => element.ownerDocument === doc)
    .filter((element) => {
      const elementRole = inferRole(element)?.toLowerCase();
      const elementName = normalizeSemanticText(getElementName(element));
      const elementText = normalizeSemanticText(getElementText(element));

      if (role && elementRole !== role) {
        return false;
      }
      if (name && elementName !== name) {
        return false;
      }
      if (text && elementText !== text) {
        return false;
      }
      return true;
    });
}

function isUnsafeSelector(selector: string): boolean {
  const normalized = selector.trim().toLowerCase();
  return (
    normalized === '*' ||
    /^[a-z][a-z0-9-]*$/.test(normalized) ||
    /^\[role(?:=[^\]]+)?\]$/.test(normalized) ||
    /^\.[a-z_-][a-z0-9_-]*$/i.test(normalized)
  );
}

function elementOrAncestorMatchesText(
  element: Element,
  targetText: string,
): boolean {
  const expected = normalizeSemanticText(targetText);
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < 5) {
    const tag = current.tagName.toLowerCase();
    if (tag === 'body' || tag === 'html') {
      return false;
    }

    if (
      [
        getElementName(current),
        getControlLabel(current),
        getChoiceGroupLabel(current),
        getElementText(current),
        getElementValue(current),
      ].some((value) => normalizeSemanticText(value) === expected)
    ) {
      return true;
    }

    current = current.parentElement;
    depth += 1;
  }

  return false;
}

function elementMatchesCoordinateIdentity(
  element: Element,
  targetText: string,
  targetRole?: string,
  targetContext?: string,
): boolean {
  if (
    targetRole &&
    normalizeSemanticText(inferRole(element)) !==
      normalizeSemanticText(targetRole)
  ) {
    return false;
  }
  const expectedText = normalizeSemanticText(targetText);
  const textMatches = [
    getElementName(element),
    getControlLabel(element),
    getElementText(element),
  ].some((value) => normalizeSemanticText(value) === expectedText);
  if (!textMatches) {
    return false;
  }
  if (!targetContext) {
    return true;
  }
  const expectedContext = normalizeSemanticText(targetContext);
  const context = [
    ...getNearbyText(element),
    element.parentElement?.textContent ?? undefined,
  ]
    .map((value) => normalizeSemanticText(value))
    .join(' ');
  return context.includes(expectedContext);
}

function readExpectedAfterClick(
  value: unknown,
): ExpectedAfterClickFieldContains | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.type === 'field_contains' &&
    typeof candidate.field === 'string' &&
    candidate.field.trim() &&
    typeof candidate.value === 'string'
  ) {
    return {
      type: 'field_contains',
      field: candidate.field,
      value: candidate.value,
    };
  }

  return undefined;
}

function readObservationScope(value: unknown): ObservationScope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expectation scope must be an object.');
  }
  const documentScope = Reflect.get(value, 'documentScope');
  if (documentScope === 'current_top') {
    return { documentScope };
  }
  const documentRef = Reflect.get(value, 'documentRef');
  if (
    documentScope === 'same_document' &&
    typeof documentRef === 'string' &&
    documentRef.trim()
  ) {
    return { documentScope, documentRef };
  }
  throw new Error('Expectation scope is invalid.');
}

function readObservationTarget(value: unknown): ObservationTargetDescriptor {
  const scope = readObservationScope(value);
  const kind = Reflect.get(value as object, 'kind');
  if (kind === 'test_id') {
    const testId = Reflect.get(value as object, 'testId');
    if (typeof testId === 'string' && testId.trim()) {
      return { ...scope, kind, testId };
    }
  }
  if (kind === 'selector') {
    const selector = Reflect.get(value as object, 'selector');
    if (typeof selector === 'string' && selector.trim()) {
      return { ...scope, kind, selector };
    }
  }
  if (
    kind === 'semantic' &&
    Reflect.get(value as object, 'match') === 'exact'
  ) {
    const identity = Reflect.get(value as object, 'identity');
    if (identity && typeof identity === 'object' && !Array.isArray(identity)) {
      const role = Reflect.get(identity, 'role');
      const name = Reflect.get(identity, 'name');
      const text = Reflect.get(identity, 'text');
      if (typeof role === 'string' && role.trim()) {
        if (typeof name === 'string' && name.trim() && text === undefined) {
          return {
            ...scope,
            kind,
            match: 'exact',
            identity: { role, name },
          };
        }
        if (typeof text === 'string' && text.trim() && name === undefined) {
          return {
            ...scope,
            kind,
            match: 'exact',
            identity: { role, text },
          };
        }
      }
    }
  }
  throw new Error('Expectation target is invalid.');
}

function readActionExpectation(value: unknown): ActionExpectation | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('expectation must be an object.');
  }
  const type = Reflect.get(value, 'type');
  if (type === 'url_matches') {
    const mode = Reflect.get(value, 'mode');
    const expectedValue = Reflect.get(value, 'value');
    if (
      (mode === 'exact' || mode === 'prefix') &&
      typeof expectedValue === 'string'
    ) {
      return { type, mode, value: expectedValue };
    }
  }
  if (type === 'text_visible') {
    const expectedValue = Reflect.get(value, 'value');
    if (typeof expectedValue === 'string') {
      return {
        type,
        scope: readObservationScope(Reflect.get(value, 'scope')),
        value: expectedValue,
      };
    }
  }
  if (
    type === 'field_contains' ||
    type === 'checked_equals' ||
    type === 'element_visible' ||
    type === 'element_hidden'
  ) {
    const target = readObservationTarget(Reflect.get(value, 'target'));
    if (type === 'field_contains') {
      const expectedValue = Reflect.get(value, 'value');
      if (typeof expectedValue === 'string') {
        return { type, target, value: expectedValue };
      }
    } else if (type === 'checked_equals') {
      const expectedValue = Reflect.get(value, 'value');
      if (typeof expectedValue === 'boolean') {
        return { type, target, value: expectedValue };
      }
    } else {
      return { type, target };
    }
  }
  throw new Error('Unsupported action expectation.');
}

function findFieldByLabel(
  root: Document | ShadowRoot,
  field: string,
): Element | undefined {
  const expected = field.trim().toLowerCase();
  return Array.from(root.querySelectorAll('input,textarea,select')).find(
    (element) => {
      const labels = [
        getControlLabel(element),
        getElementName(element),
        element.getAttribute('name') ?? undefined,
        element.getAttribute('placeholder') ?? undefined,
        ...getNearbyText(element),
      ];
      return labels.some((label) =>
        label?.trim().toLowerCase().includes(expected),
      );
    },
  );
}

function evaluateExpectedAfterClick(
  root: Document | ShadowRoot,
  expected: ExpectedAfterClickFieldContains | undefined,
) {
  if (!expected) {
    return undefined;
  }

  const field = findFieldByLabel(root, expected.field);
  const actual = field ? (getElementValue(field) ?? '') : undefined;
  return {
    ...expected,
    ok:
      typeof actual === 'string' &&
      actual.toLowerCase().includes(expected.value.toLowerCase()),
    actual,
    matchedField: field ? summarizeElement(field) : undefined,
  };
}

function collectElements(root: Document | ShadowRoot | Element): Element[] {
  const doc =
    root.nodeType === 1
      ? (root as Element).ownerDocument
      : getOwnerDocument(root as Document | ShadowRoot);
  const start =
    root.nodeType === 9
      ? ((root as Document).body ?? (root as Document).documentElement)
      : root;
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

      if (isFrameElement(element)) {
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
  if (isHtmlElement(element) || isSvgElement(element)) {
    element.scrollIntoView?.({ block: 'center', inline: 'center' });
  }

  if (isHtmlElement(element)) {
    element.focus?.();
  }
}

function createPointerLikeEvent(type: string, init: MouseEventInit): Event {
  if (typeof PointerEvent === 'function') {
    return new PointerEvent(type, init);
  }

  return new MouseEvent(type.replace('pointer', 'mouse'), init);
}

export class HostPageAutomationExecutor {
  private refs = new Map<string, ElementRefEntry>();
  private nextRef = 1;
  private readableContent?: HostPageReadableContent;
  private pageStateId = '';
  private documentRefs = new Map<Document, string>();
  private documents: BrowserDocumentDescriptor[] = [];
  private lastResolution?: TargetResolution;
  private pageStateInvalidated = false;
  private cachedSnapshot?: HostPageSnapshot;
  private cachedSnapshotCreatedAt = 0;
  private mutationObservers: MutationObserver[] = [];
  private pendingActionApprovals = new Map<string, PendingActionApproval>();

  constructor(private readonly options: HostPageAutomationOptions = {}) {}

  async execute(
    name: HostPageAutomationToolName,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    if (this.options.enabled === false) {
      throw new Error('Host page automation is disabled.');
    }

    if (
      name !== 'host_page_snapshot' &&
      name !== 'host_page_read' &&
      name !== 'host_page_screenshot'
    ) {
      this.assertCurrentPageState(params);
    }

    switch (name) {
      case 'host_page_snapshot':
        return this.snapshot(params);
      case 'host_page_click':
        return this.executeAction(
          () => this.click(params),
          true,
          readActionExpectation(params.expectation),
        );
      case 'host_page_fill':
        return this.executeAction(
          () => this.fill(params),
          true,
          readActionExpectation(params.expectation),
        );
      case 'host_page_press':
        return this.executeAction(
          () => this.press(params),
          true,
          readActionExpectation(params.expectation),
        );
      case 'host_page_select':
        return this.executeAction(
          () => this.select(params),
          true,
          readActionExpectation(params.expectation),
        );
      case 'host_page_scroll':
        return this.executeAction(
          () => this.scroll(params),
          true,
          readActionExpectation(params.expectation),
        );
      case 'host_page_navigate':
        return this.executeAction(
          async () => this.navigate(params),
          true,
          readActionExpectation(params.expectation),
        );
      case 'host_page_hover':
        return this.executeAction(() => this.hover(params), false);
      case 'host_page_focus':
        return this.executeAction(() => this.focus(params), false);
      case 'host_page_pointer':
        return this.executeAction(
          () => this.pointer(params),
          readPointerAction(params.action) === 'click',
          readActionExpectation(params.expectation),
        );
      case 'host_page_screenshot':
        return this.screenshot();
      case 'host_page_read':
        return this.read(params);
      case 'host_page_wait_for':
        return this.waitFor(params);
    }
  }

  snapshot(params: Record<string, unknown> = {}): HostPageSnapshot {
    const requestedPageStateId = readOptionalString(params.pageStateId);
    if (requestedPageStateId) {
      if (
        this.cachedSnapshot &&
        requestedPageStateId === this.pageStateId &&
        !this.pageStateInvalidated &&
        Date.now() - this.cachedSnapshotCreatedAt <= SNAPSHOT_CACHE_TTL_MS &&
        this.cachedSnapshot.url === getWindow(this.getRoot()).location.href
      ) {
        return this.cachedSnapshot;
      }
      this.rejectStalePageState(requestedPageStateId);
    }

    this.refs.clear();
    this.pendingActionApprovals.clear();
    this.nextRef = 1;
    this.disconnectMutationObservers();

    const root = this.getRoot();
    const doc = getOwnerDocument(root);
    const view = getWindow(root);
    this.pageStateId = createPageStateId();
    this.pageStateInvalidated = false;
    this.indexDocuments(doc);
    const elements = collectElements(root).map((element) =>
      this.snapshotElement(element),
    );
    this.readableContent = extractHostPageReadableContent(root);

    const snapshot: HostPageSnapshot = {
      pageStateId: this.pageStateId,
      url: view.location.href,
      title: doc.title,
      capabilities: {
        cdp: false,
        realInput: false,
        screenshot: false,
        accessibility: false,
        networkState: false,
        targetingVersion: 2,
        strictRefs: true,
        strictCoordinates: true,
        freshState: true,
        postconditions: true,
        policyGate: true,
        actionTrace: true,
      },
      documents: this.documents,
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
        focused: doc.activeElement === this.refs.get(element.ref)?.element,
      })),
      readableContent: createHostPageReadableContentIndex(this.readableContent),
      elements,
    };
    this.cachedSnapshot = snapshot;
    this.cachedSnapshotCreatedAt = Date.now();
    this.observePageState();
    return snapshot;
  }

  private getRoot(): Document | ShadowRoot {
    return this.options.root ?? document;
  }

  private indexDocuments(topDocument: Document) {
    this.documentRefs = new Map();
    this.documents = [];
    let nextDocument = 1;
    let nextFrame = 1;

    const visit = (
      doc: Document,
      parentDocumentRef?: string,
      frameRef?: string,
    ) => {
      const documentRef = `d${nextDocument}`;
      nextDocument += 1;
      this.documentRefs.set(doc, documentRef);
      this.documents.push({
        documentRef,
        parentDocumentRef,
        frameRef,
        sameOrigin: true,
      });

      for (const frame of Array.from(doc.querySelectorAll('iframe'))) {
        try {
          const childDocument = frame.contentDocument;
          if (!childDocument) {
            continue;
          }
          const childFrameRef = `f${nextFrame}`;
          nextFrame += 1;
          visit(childDocument, documentRef, childFrameRef);
        } catch {
          // Cross-origin frame documents cannot participate in strict targeting.
        }
      }
    };

    visit(topDocument);
  }

  private disconnectMutationObservers() {
    for (const observer of this.mutationObservers) {
      observer.disconnect();
    }
    this.mutationObservers = [];
  }

  private observePageState() {
    const observedPageStateId = this.pageStateId;
    for (const doc of this.documentRefs.keys()) {
      const MutationObserverConstructor =
        doc.defaultView?.MutationObserver ?? globalThis.MutationObserver;
      if (typeof MutationObserverConstructor !== 'function') {
        continue;
      }
      const observer = new MutationObserverConstructor(() => {
        if (this.pageStateId === observedPageStateId) {
          this.pageStateInvalidated = true;
        }
      });
      const options: MutationObserverInit = {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: [...PAGE_STATE_ATTRIBUTE_FILTER],
      };
      observer.observe(doc.documentElement ?? doc, options);
      for (const element of Array.from(doc.querySelectorAll('*'))) {
        if (element.shadowRoot) {
          observer.observe(element.shadowRoot, options);
        }
      }
      this.mutationObservers.push(observer);
    }
  }

  private invalidateReadableContent() {
    this.readableContent = undefined;
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
    this.refs.set(ref, {
      element,
      pageStateId: this.pageStateId,
      documentRef: this.documentRefs.get(element.ownerDocument) ?? 'd1',
      fingerprint: getElementIdentityFingerprint(element),
    });

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
      isInputElement(element) || isTextAreaElement(element)
        ? element.placeholder || undefined
        : undefined;
    const actionability = getActionability(element);

    return {
      documentRef: this.documentRefs.get(element.ownerDocument) ?? 'd1',
      ref,
      tag: element.tagName.toLowerCase(),
      role: inferRole(element),
      name: getElementName(element),
      label: getControlLabel(element),
      groupLabel: getChoiceGroupLabel(element),
      text: getElementText(element),
      nearbyText: getNearbyText(element),
      testId: getElementTestId(element),
      value: getElementValue(element),
      selectedLabel: getSelectedLabel(element),
      options: getSelectOptions(element),
      placeholder,
      selector: createSelector(element),
      disabled: isDisabled(element),
      enabled: actionability.enabled,
      checked: isChecked(element),
      visible: actionability.visible,
      actionable: actionability.actionable,
      receivesEvents: actionability.receivesEvents,
      occludedBy: actionability.occludedBy
        ? summarizeElement(actionability.occludedBy)
        : undefined,
      safeClickPoints: actionability.safeClickPoints,
      rect: getGlobalRect(element),
      center: actionability.center,
      hitTarget: actionability.hitTarget
        ? summarizeElement(actionability.hitTarget)
        : undefined,
      hitStack: actionability.hitStack.slice(0, 5).map(summarizeElement),
    };
  }

  private resolveElement(params: ResolvableTargetParams): Element {
    const requestedPageStateId = readOptionalString(params.pageStateId);
    if (this.pageStateId && !requestedPageStateId) {
      this.rejectStalePageState(this.pageStateId);
    }
    if (requestedPageStateId && requestedPageStateId !== this.pageStateId) {
      this.rejectStalePageState(requestedPageStateId);
    }
    if (this.documents.length && !readOptionalString(params.documentRef)) {
      this.rejectTarget(
        'unsupported_target_scope',
        'documentRef is required for strict targeting.',
      );
    }

    const requestedDocumentRef =
      readOptionalString(params.documentRef) ??
      this.documents[0]?.documentRef ??
      'legacy';
    const targetDocument = this.documents.length
      ? Array.from(this.documentRefs.entries()).find(
          ([, documentRef]) => documentRef === requestedDocumentRef,
        )?.[0]
      : getOwnerDocument(this.getRoot());
    if (!requestedDocumentRef || !targetDocument) {
      this.rejectTarget(
        'unsupported_target_scope',
        'The requested document scope is not available.',
      );
    }

    const ref = readOptionalString(params.ref);
    const axRef = readOptionalString(params.axRef);
    const selector = readOptionalString(params.selector);
    const testId = readOptionalString(params.testId);
    const role = readOptionalString(params.role);
    const name = readOptionalString(params.name);
    const text = readOptionalString(params.text);
    if (this.pageStateId) {
      const locatorFamilyCount = [
        Boolean(ref),
        Boolean(axRef),
        Boolean(selector),
        Boolean(testId),
        Boolean(role || name || text),
      ].filter(Boolean).length;
      if (locatorFamilyCount !== 1) {
        this.rejectTarget(
          'ambiguous_target',
          'Strict targeting requires exactly one locator family.',
        );
      }
    }
    const resolvedRef = ref ?? axRef;
    if (resolvedRef) {
      const entry = this.refs.get(resolvedRef);
      if (
        !entry ||
        entry.pageStateId !== this.pageStateId ||
        !entry.element.isConnected ||
        this.documentRefs.get(entry.element.ownerDocument) !==
          entry.documentRef ||
        (requestedDocumentRef && requestedDocumentRef !== entry.documentRef) ||
        hasIdentityConflict(entry.fingerprint, entry.element)
      ) {
        throw new HostPageAutomationStructuredError(
          `Element ref ${resolvedRef} is stale. Take a new snapshot.`,
          {
            code: 'stale_target',
            message: `Element ref ${resolvedRef} is stale. Take a new snapshot.`,
            recoverable: true,
            dispatched: false,
            outcome: 'rejected_before_execution',
            requiresFreshSnapshot: true,
            invalidatedPageStateId: requestedPageStateId ?? this.pageStateId,
          },
        );
      }
      if (this.pageStateInvalidated) {
        this.rejectStalePageState(requestedPageStateId ?? this.pageStateId);
      }
      this.lastResolution = {
        requested: ref
          ? {
              kind: 'ref',
              pageStateId: requestedPageStateId ?? this.pageStateId,
              documentRef: entry.documentRef,
              ref,
            }
          : {
              kind: 'ax_ref',
              pageStateId: requestedPageStateId ?? this.pageStateId,
              documentRef: entry.documentRef,
              axRef: axRef as string,
            },
        strategy: ref ? 'ref' : 'ax_ref',
        resolved: this.describeElementDescriptor(entry.element, {
          ref: ref ?? undefined,
          axRef: axRef ?? undefined,
        }),
        pageStateId: this.pageStateId,
      };
      return entry.element;
    }

    if (this.pageStateInvalidated) {
      this.rejectStalePageState(requestedPageStateId ?? this.pageStateId);
    }

    if (selector) {
      const requested: TargetDescriptor = {
        kind: 'selector',
        pageStateId: requestedPageStateId ?? this.pageStateId,
        documentRef: requestedDocumentRef,
        selector,
      };
      const baseResolution: TargetResolution = {
        requested,
        strategy: 'unique_selector',
        pageStateId: this.pageStateId,
      };
      if (isUnsafeSelector(selector)) {
        this.rejectTarget(
          'unsafe_selector',
          `Selector is too broad for strict targeting: ${selector}.`,
          baseResolution,
        );
      }
      let candidates: Element[];
      try {
        candidates = Array.from(targetDocument.querySelectorAll(selector));
      } catch {
        candidates = [];
      }
      if (candidates.length === 0) {
        this.rejectTarget(
          'target_not_found',
          `No element matches selector: ${selector}.`,
          baseResolution,
        );
      }
      if (candidates.length > 1) {
        this.rejectTarget(
          'non_unique_selector',
          `Selector matches ${candidates.length} elements: ${selector}.`,
          {
            ...baseResolution,
            candidates: candidates.map((element) =>
              this.describeElementDescriptor(element),
            ),
          },
        );
      }
      const element = candidates[0] as Element;
      this.lastResolution = {
        ...baseResolution,
        resolved: this.describeElementDescriptor(element),
      };
      return element;
    }

    if (testId || role || name || text) {
      const isTestId = Boolean(testId);
      if (!isTestId && (!role || Boolean(name) === Boolean(text))) {
        this.rejectTarget(
          'target_not_found',
          'Semantic targeting requires role plus exactly one of name or text.',
        );
      }
      const requested: TargetDescriptor = isTestId
        ? {
            kind: 'test_id',
            pageStateId: requestedPageStateId ?? this.pageStateId,
            documentRef: requestedDocumentRef,
            testId: testId as string,
          }
        : {
            kind: 'semantic',
            pageStateId: requestedPageStateId ?? this.pageStateId,
            documentRef: requestedDocumentRef,
            match: 'exact',
            identity: name
              ? { role: role as string, name }
              : { role: role as string, text: text as string },
          };
      const strategy = isTestId ? 'test_id' : 'semantic_exact';
      const candidates = findBySemanticTarget(targetDocument, params);
      const baseResolution: TargetResolution = {
        requested,
        strategy,
        pageStateId: this.pageStateId,
      };
      if (candidates.length === 0) {
        this.rejectTarget(
          'target_not_found',
          'No element matches the strict target.',
          baseResolution,
        );
      }
      if (candidates.length > 1) {
        this.rejectTarget(
          'ambiguous_target',
          `Strict target matches ${candidates.length} elements.`,
          {
            ...baseResolution,
            candidates: candidates.map((element) =>
              this.describeElementDescriptor(element),
            ),
          },
        );
      }
      const element = candidates[0] as Element;
      this.lastResolution = {
        ...baseResolution,
        resolved: this.describeElementDescriptor(element),
      };
      return element;
    }

    if (typeof params.x !== 'undefined' || typeof params.y !== 'undefined') {
      const point = readPoint(this.getRoot(), params);
      const element = getOwnerDocument(this.getRoot()).elementFromPoint(
        point.x,
        point.y,
      );
      if (!element) {
        throw new Error(`No element found at (${point.x}, ${point.y}).`);
      }
      this.lastResolution = {
        requested: {
          kind: 'coordinate',
          pageStateId: requestedPageStateId ?? this.pageStateId,
          documentRef: requestedDocumentRef,
          x: point.x,
          y: point.y,
          coordinateSpace: readCoordinateSpace(params.coordinateSpace),
          targetText: readOptionalString(params.targetText) ?? '',
        },
        strategy: 'coordinate',
        resolved: this.describeElementDescriptor(element),
        point,
        pageStateId: this.pageStateId,
      };
      return element;
    }

    throw new Error(
      'Expected one of ref, selector, role/name/text/testId, or x/y.',
    );
  }

  private rejectStalePageState(invalidatedPageStateId: string): never {
    const message = 'The requested page state is stale. Take a new snapshot.';
    throw new HostPageAutomationStructuredError(message, {
      code: 'stale_page_state',
      message,
      recoverable: true,
      dispatched: false,
      outcome: 'rejected_before_execution',
      requiresFreshSnapshot: true,
      invalidatedPageStateId,
    });
  }

  private assertCurrentPageState(params: Record<string, unknown>) {
    if (!this.pageStateId) return;
    const requestedPageStateId = readOptionalString(params.pageStateId);
    if (
      !requestedPageStateId ||
      requestedPageStateId !== this.pageStateId ||
      this.pageStateInvalidated ||
      Date.now() - this.cachedSnapshotCreatedAt > SNAPSHOT_CACHE_TTL_MS ||
      this.cachedSnapshot?.url !== getWindow(this.getRoot()).location.href
    ) {
      this.rejectStalePageState(requestedPageStateId ?? this.pageStateId);
    }
  }

  private async executeAction(
    action: () => Promise<Record<string, unknown>>,
    invalidatesPageState: boolean,
    expectation?: ActionExpectation,
  ) {
    this.lastResolution = undefined;
    const activePageStateId = this.pageStateId;
    const result = await action();
    await Promise.resolve();
    if (invalidatesPageState && activePageStateId) {
      this.pageStateInvalidated = true;
    }
    const requiresFreshSnapshot =
      Boolean(activePageStateId) &&
      (invalidatesPageState || this.pageStateInvalidated);
    const verification = expectation
      ? await this.verifyExpectation(expectation)
      : undefined;
    const outcome = verification
      ? verification.status === 'passed'
        ? 'verified'
        : 'verification_failed'
      : 'executed_unverified';

    return {
      ...result,
      dispatched: true,
      outcome,
      requiresFreshSnapshot,
      invalidatedPageStateId: requiresFreshSnapshot
        ? activePageStateId
        : undefined,
      ...(this.lastResolution ? { resolution: this.lastResolution } : {}),
      verification,
    };
  }

  private async requireActionApproval(
    action: HostPageAutomationToolName,
    params: Record<string, unknown>,
    risks: BrowserActionRisk[],
    target?: Element,
  ): Promise<void> {
    if (risks.length === 0) {
      return;
    }

    const view = getWindow(this.getRoot());
    const actionHash = await hashActionValue({ action, params });
    const targetHash = await hashActionValue(
      target
        ? {
            documentRef:
              this.documentRefs.get(target.ownerDocument) ?? 'legacy',
            ...getElementIdentityFingerprint(target),
          }
        : null,
    );
    const providedToken = readOptionalString(params.actionToken);
    let approvalReason: BrowserActionApprovalReason = 'approval_required';

    if (providedToken) {
      const pending = this.pendingActionApprovals.get(providedToken);
      this.pendingActionApprovals.delete(providedToken);
      if (!pending) {
        approvalReason = 'invalid_or_used_token';
      } else if (pending.expiresAt <= Date.now()) {
        approvalReason = 'expired_token';
      } else if (
        pending.pageStateId !== this.pageStateId ||
        pending.origin !== view.location.origin ||
        pending.url !== view.location.href
      ) {
        approvalReason = 'state_mismatch';
      } else if (
        pending.action !== action ||
        pending.actionHash !== actionHash ||
        pending.targetHash !== targetHash ||
        pending.risks.join('\0') !== risks.join('\0')
      ) {
        approvalReason = 'action_mismatch';
      } else {
        return;
      }
    }

    for (const [token, pending] of this.pendingActionApprovals) {
      if (pending.expiresAt <= Date.now()) {
        this.pendingActionApprovals.delete(token);
      }
    }
    const actionToken = createPageStateId();
    const expiresAt = Date.now() + ACTION_APPROVAL_TTL_MS;
    this.pendingActionApprovals.set(actionToken, {
      action,
      actionHash,
      expiresAt,
      origin: view.location.origin,
      pageStateId: this.pageStateId,
      risks,
      targetHash,
      url: view.location.href,
    });
    const message = `Action requires user approval: ${risks.join(', ')}.`;
    throw new HostPageAutomationStructuredError(message, {
      code: 'approval_required',
      message,
      recoverable: true,
      dispatched: false,
      outcome: 'rejected_before_execution',
      requiresFreshSnapshot: false,
      actionToken,
      approvalReason,
      expiresAt: new Date(expiresAt).toISOString(),
      risks,
      resolution: this.lastResolution,
    });
  }

  private getObservationDocument(scope: ObservationScope): Document | null {
    if (scope.documentScope === 'current_top') {
      return getOwnerDocument(this.getRoot());
    }
    return (
      Array.from(this.documentRefs.entries()).find(
        ([, documentRef]) => documentRef === scope.documentRef,
      )?.[0] ?? null
    );
  }

  private resolveObservationTarget(
    target: ObservationTargetDescriptor,
  ): ObservationResolution {
    const doc = this.getObservationDocument(target);
    if (!doc) {
      return { status: 'not_found' };
    }

    let candidates: Element[] = [];
    if (target.kind === 'selector') {
      if (isUnsafeSelector(target.selector)) {
        return { status: 'ambiguous' };
      }
      try {
        candidates = Array.from(doc.querySelectorAll(target.selector));
      } catch {
        candidates = [];
      }
    } else if (target.kind === 'test_id') {
      candidates = collectElements(doc).filter(
        (element) =>
          element.ownerDocument === doc &&
          getElementTestId(element) === target.testId,
      );
    } else {
      candidates = findBySemanticTarget(doc, {
        role: target.identity.role,
        ...('name' in target.identity
          ? { name: target.identity.name }
          : { text: target.identity.text }),
      });
    }

    if (candidates.length === 0) {
      return { status: 'not_found' };
    }
    if (candidates.length > 1) {
      return { status: 'ambiguous' };
    }
    return { status: 'unique', element: candidates[0] as Element };
  }

  private checkExpectation(expectation: ActionExpectation): ExpectationCheck {
    if (expectation.type === 'url_matches') {
      const actual = getWindow(this.getRoot()).location.href;
      return {
        matched:
          expectation.mode === 'exact'
            ? actual === expectation.value
            : actual.startsWith(expectation.value),
        actual,
      };
    }

    if (expectation.type === 'text_visible') {
      const doc = this.getObservationDocument(expectation.scope);
      const actual = doc?.body?.innerText ?? doc?.body?.textContent ?? '';
      return {
        matched: normalizeSemanticText(actual).includes(
          normalizeSemanticText(expectation.value),
        ),
        actual,
      };
    }

    const resolution = this.resolveObservationTarget(expectation.target);
    if (resolution.status === 'ambiguous') {
      return { matched: false, terminalFailure: true, actual: null };
    }
    if (resolution.status === 'not_found') {
      return {
        matched: expectation.type === 'element_hidden',
        actual: null,
      };
    }

    const element = resolution.element;
    if (expectation.type === 'field_contains') {
      const actual = getElementValue(element) ?? null;
      return {
        matched:
          typeof actual === 'string' &&
          actual.toLowerCase().includes(expectation.value.toLowerCase()),
        actual,
      };
    }
    if (expectation.type === 'checked_equals') {
      const actual = isChecked(element) ?? null;
      return { matched: actual === expectation.value, actual };
    }
    const visible = isVisibleCandidate(element);
    return {
      matched: expectation.type === 'element_visible' ? visible : !visible,
      actual: visible,
    };
  }

  private async verifyExpectation(
    expectation: ActionExpectation,
  ): Promise<VerificationResult> {
    const startedAt = Date.now();
    let lastActual: string | boolean | null | undefined;

    while (Date.now() - startedAt <= POSTCONDITION_DEFAULT_TIMEOUT_MS) {
      const check = this.checkExpectation(expectation);
      lastActual = check.actual;
      if (check.matched) {
        return {
          status: 'passed',
          expectation,
          elapsedMs: Date.now() - startedAt,
          actual: lastActual,
        };
      }
      if (check.terminalFailure) {
        return {
          status: 'failed',
          expectation,
          elapsedMs: Date.now() - startedAt,
          actual: lastActual,
        };
      }
      if (Date.now() - startedAt >= POSTCONDITION_DEFAULT_TIMEOUT_MS) {
        break;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, POSTCONDITION_POLL_INTERVAL_MS),
      );
    }

    return {
      status: 'timed_out',
      expectation,
      elapsedMs: Date.now() - startedAt,
      actual: lastActual,
    };
  }

  private rejectTarget(
    code: BrowserAutomationErrorCode,
    message: string,
    resolution?: TargetResolution,
  ): never {
    throw new HostPageAutomationStructuredError(message, {
      code,
      message,
      recoverable: code !== 'approval_required',
      dispatched: false,
      outcome: 'rejected_before_execution',
      requiresFreshSnapshot:
        code === 'stale_page_state' || code === 'stale_target',
      resolution,
    });
  }

  private describeElementDescriptor(
    element: Element,
    refs: { ref?: string; axRef?: string } = {},
  ) {
    return {
      documentRef: this.documentRefs.get(element.ownerDocument) ?? 'd1',
      ...refs,
      tag: element.tagName.toLowerCase(),
      role: inferRole(element),
      name: getElementName(element),
      text: getElementText(element),
      testId: getElementTestId(element),
      rect: getGlobalRect(element),
    };
  }

  private async click(params: Record<string, unknown>) {
    const input = normalizeParams(params);
    const requestedElement = this.resolveElement(input);
    const actionability = getActionability(requestedElement);
    const target = findActionableAncestor(requestedElement);
    const targetPoint = getReceivesEventsPoint(target);
    if (!actionability.enabled) {
      this.rejectTarget(
        'target_disabled',
        `Target "${getElementName(requestedElement) ?? requestedElement.tagName.toLowerCase()}" is disabled.`,
        this.lastResolution,
      );
    }
    if (!targetPoint && canHitTest(requestedElement.ownerDocument)) {
      if (this.lastResolution) {
        this.lastResolution = {
          ...this.lastResolution,
          adjustment:
            target === requestedElement ? undefined : 'actionable_ancestor',
          hitTarget: actionability.hitTarget
            ? this.describeElementDescriptor(actionability.hitTarget)
            : undefined,
          hitStack: actionability.hitStack
            .slice(0, 5)
            .map((element) => this.describeElementDescriptor(element)),
        };
      }
      throw new HostPageAutomationStructuredError(
        `Target "${getElementName(requestedElement) ?? requestedElement.tagName.toLowerCase()}" is not receiving pointer events.`,
        {
          code: 'target_occluded',
          reason: 'target_occluded',
          message: `Target "${getElementName(requestedElement) ?? requestedElement.tagName.toLowerCase()}" is not receiving pointer events.`,
          dispatched: false,
          outcome: 'rejected_before_execution',
          requiresFreshSnapshot: false,
          resolution: this.lastResolution,
          target: this.describeElement(requestedElement),
          occluder: actionability.occludedBy
            ? summarizeElement(actionability.occludedBy)
            : undefined,
          targetVisible: actionability.visible,
          targetEnabled: actionability.enabled,
          targetReceivesEvents: actionability.receivesEvents,
          recoverable: true,
          hitStack: actionability.hitStack.slice(0, 5).map(summarizeElement),
          nextActions: [
            {
              tool: 'host_page_press',
              args: { key: 'Escape' },
            },
            {
              tool: 'host_page_screenshot',
              args: {},
            },
          ],
        },
      );
    }

    const latestTargetPoint = getReceivesEventsPoint(target);
    const latestTargetActionability = getActionability(target);
    const clickPoint = latestTargetPoint
      ? getGlobalPoint(target, latestTargetPoint)
      : canHitTest(target.ownerDocument)
        ? undefined
        : (latestTargetActionability.center ?? actionability.center);
    if (this.lastResolution) {
      const resolvedDescriptor = this.describeElementDescriptor(target);
      this.lastResolution = {
        ...this.lastResolution,
        adjustment:
          target === requestedElement ? undefined : 'actionable_ancestor',
        point: clickPoint,
        resolved:
          target === requestedElement
            ? {
                ...this.lastResolution.resolved,
                ...resolvedDescriptor,
              }
            : resolvedDescriptor,
      };
    }
    await this.requireActionApproval(
      'host_page_click',
      input,
      getActivationRisks(target),
      target,
    );
    focusElement(target);
    if (clickPoint) {
      await this.showVisualEffect({
        type: 'click',
        point: clickPoint,
        anchor: 'target',
        target,
        requested: requestedElement,
      });
    }

    const dispatchTargetPoint = getReceivesEventsPoint(target);
    const dispatchTargetActionability = getActionability(target);
    if (!dispatchTargetPoint && canHitTest(target.ownerDocument)) {
      if (this.lastResolution) {
        this.lastResolution = {
          ...this.lastResolution,
          hitTarget: dispatchTargetActionability.hitTarget
            ? this.describeElementDescriptor(
                dispatchTargetActionability.hitTarget,
              )
            : undefined,
          hitStack: dispatchTargetActionability.hitStack
            .slice(0, 5)
            .map((element) => this.describeElementDescriptor(element)),
        };
      }
      this.rejectTarget(
        'target_occluded',
        `Target "${getElementName(requestedElement) ?? requestedElement.tagName.toLowerCase()}" stopped receiving pointer events before dispatch.`,
        this.lastResolution,
      );
    }
    const dispatchPoint = dispatchTargetPoint
      ? getGlobalPoint(target, dispatchTargetPoint)
      : clickPoint;
    const dispatchRequestedActionability = getActionability(requestedElement);
    if (this.lastResolution) {
      this.lastResolution = {
        ...this.lastResolution,
        point: dispatchPoint,
        resolved: {
          ...this.lastResolution.resolved,
          ...this.describeElementDescriptor(target),
        },
      };
    }

    if (isHtmlElement(target)) {
      target.click();
    } else {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    this.invalidateReadableContent();

    return {
      clicked: this.describeElement(target),
      requested: this.describeElement(requestedElement),
      strategy: target === requestedElement ? 'dom' : 'actionable_ancestor',
      point: dispatchPoint,
      actionability: {
        visible: dispatchRequestedActionability.visible,
        enabled: dispatchRequestedActionability.enabled,
        receivesEvents: dispatchRequestedActionability.receivesEvents,
        occludedBy: dispatchRequestedActionability.occludedBy
          ? summarizeElement(dispatchRequestedActionability.occludedBy)
          : undefined,
        safeClickPoints: dispatchRequestedActionability.safeClickPoints,
      },
    };
  }

  private read(params: Record<string, unknown>) {
    const input = normalizeParams(params) as ReadParams;
    const root = this.getRoot();
    const readableContent =
      this.readableContent ?? extractHostPageReadableContent(root);
    this.readableContent = readableContent;
    const readParams: HostPageReadParams = {
      blockId: readOptionalString(input.blockId),
      query: readOptionalString(input.query),
      page: readOptionalInteger(input.page),
      pageSize: readOptionalInteger(input.pageSize),
      maxChars: readOptionalInteger(input.maxChars),
    };
    return readHostPageReadableContent(readableContent, readParams);
  }

  private async fill(params: Record<string, unknown>) {
    const input = normalizeParams(params) as FillParams;
    const value = readString(input.value, 'value');
    const element = this.resolveElement(input);

    await this.requireActionApproval(
      'host_page_fill',
      input,
      isInputElement(element)
        ? element.type === 'password'
          ? ['password_input']
          : element.type === 'file'
            ? ['file_input']
            : []
        : [],
      element,
    );

    focusElement(element);
    if (isInputElement(element) || isTextAreaElement(element)) {
      await this.showVisualEffect({
        type: 'fill',
        target: element,
        requested: element,
        value,
        anchor: 'target',
        point: getActionability(element).center,
      });
      setNativeValue(element, value);
      dispatchInputEvents(element);
      this.invalidateReadableContent();
      return { filled: this.describeElement(element), value };
    }

    if (isHtmlElement(element) && element.isContentEditable) {
      await this.showVisualEffect({
        type: 'fill',
        target: element,
        requested: element,
        value,
        anchor: 'target',
        point: getActionability(element).center,
      });
      element.textContent = value;
      dispatchInputEvents(element);
      this.invalidateReadableContent();
      return { filled: this.describeElement(element), value };
    }

    throw new Error('Target element cannot be filled.');
  }

  private async press(params: Record<string, unknown>) {
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

    await this.requireActionApproval(
      'host_page_press',
      input,
      key === 'Enter' || key === ' ' ? getActivationRisks(element) : [],
      element,
    );

    focusElement(element);
    await this.showVisualEffect({
      type: 'press',
      target: element,
      requested: element,
      key,
      anchor: 'target',
      point: getActionability(element).center,
    });
    const eventInit = { key, bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    if (key.length === 1) {
      element.dispatchEvent(new KeyboardEvent('keypress', eventInit));
    }
    element.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    this.invalidateReadableContent();
    return { pressed: key, target: this.describeElement(element) };
  }

  private async select(params: Record<string, unknown>) {
    const input = normalizeParams(params) as SelectParams;
    const values = readStringList(input.values ?? input.value);
    const element = this.resolveElement(input);

    if (!isSelectElement(element)) {
      throw new Error('Target element is not a select.');
    }

    focusElement(element);
    const valueSet = new Set(values);
    await this.showVisualEffect({
      type: 'select',
      target: element,
      requested: element,
      values,
      anchor: 'target',
      point: getActionability(element).center,
    });
    for (const option of Array.from(element.options)) {
      option.selected = valueSet.has(option.value);
    }

    dispatchInputEvents(element);
    this.invalidateReadableContent();
    return {
      selected: Array.from(element.selectedOptions).map(
        (option) => option.value,
      ),
      target: this.describeElement(element),
    };
  }

  private async scroll(params: Record<string, unknown>) {
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
      if (!isHtmlElement(element)) {
        throw new Error('Target element cannot be scrolled.');
      }
      await this.showVisualEffect({
        type: 'scroll',
        target: element,
        requested: element,
        deltaX,
        deltaY,
        anchor: 'target',
        point: getActionability(element).center,
      });
      if (absolute) {
        element.scrollTo?.(absolute.x, absolute.y);
      } else {
        element.scrollBy?.(deltaX, deltaY);
      }
      this.invalidateReadableContent();
      return {
        scrolled: this.describeElement(element),
        scroll: { x: element.scrollLeft, y: element.scrollTop },
      };
    }

    await this.showVisualEffect({
      type: 'scroll',
      deltaX,
      deltaY,
      point: {
        x: view.innerWidth / 2,
        y: view.innerHeight / 2,
      },
    });
    if (absolute) {
      view.scrollTo?.(absolute.x, absolute.y);
    } else {
      view.scrollBy?.(deltaX, deltaY);
    }
    this.invalidateReadableContent();

    return { scroll: { x: view.scrollX, y: view.scrollY } };
  }

  private async navigate(params: Record<string, unknown>) {
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
    this.invalidateReadableContent();
    view.location.assign(nextUrl.toString());
    return { navigated: nextUrl.toString() };
  }

  private async hover(params: Record<string, unknown>) {
    const input = normalizeParams(params) as HoverParams;
    const element = this.resolveElement(input);
    const point = getActionability(element).center;

    await this.showVisualEffect({
      type: 'hover',
      target: element,
      requested: element,
      anchor: 'target',
      point,
    });
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

  private async focus(params: Record<string, unknown>) {
    const input = normalizeParams(params) as FocusParams;
    const element = this.resolveElement(input);
    focusElement(element);
    await this.showVisualEffect({
      type: 'focus',
      target: element,
      requested: element,
      anchor: 'target',
      point: getActionability(element).center,
    });
    return { focused: this.describeElement(element) };
  }

  private async pointer(params: Record<string, unknown>) {
    const input = normalizeParams(params) as PointerParams;
    const action = readPointerAction(input.action);
    const button = readOptionalInteger(input.button) ?? 0;
    const hasExplicitPoint =
      typeof input.x !== 'undefined' || typeof input.y !== 'undefined';
    const targetText = readOptionalString(input.targetText);
    const targetRole = readOptionalString(input.targetRole);
    const targetContext = readOptionalString(input.targetContext);
    if (action === 'click' && hasExplicitPoint && !targetText) {
      throw new Error(
        'Pointer coordinate clicks require targetText to avoid unintended navigation.',
      );
    }
    let coordinateDocument = getOwnerDocument(this.getRoot());
    let coordinateDocumentRef = this.documents[0]?.documentRef ?? 'legacy';
    if (hasExplicitPoint && this.pageStateId) {
      const requestedPageStateId = readOptionalString(input.pageStateId);
      if (
        !requestedPageStateId ||
        requestedPageStateId !== this.pageStateId ||
        this.pageStateInvalidated
      ) {
        this.rejectStalePageState(requestedPageStateId ?? this.pageStateId);
      }
      const requestedDocumentRef = readOptionalString(input.documentRef);
      if (!requestedDocumentRef) {
        this.rejectTarget(
          'unsupported_target_scope',
          'documentRef is required for coordinate targeting.',
        );
      }
      const scopedDocument = Array.from(this.documentRefs.entries()).find(
        ([, documentRef]) => documentRef === requestedDocumentRef,
      )?.[0];
      if (!scopedDocument) {
        this.rejectTarget(
          'unsupported_target_scope',
          'The requested coordinate document scope is not available.',
        );
      }
      coordinateDocument = scopedDocument;
      coordinateDocumentRef = requestedDocumentRef;
    }
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
      : readPoint(this.getRoot(), input);
    if (!point) {
      throw new Error('Target element has no clickable point.');
    }
    const coordinatePoint = hasExplicitPoint
      ? getDocumentViewportPoint(coordinateDocument, point)
      : point;
    const target =
      element ?? getElementsFromPoint(coordinateDocument, coordinatePoint)[0];

    if (!target) {
      throw new Error(`No element found at (${point.x}, ${point.y}).`);
    }
    if (isFrameElement(target)) {
      const resolution: TargetResolution | undefined = hasExplicitPoint
        ? {
            requested: {
              kind: 'coordinate',
              pageStateId:
                readOptionalString(input.pageStateId) ?? this.pageStateId,
              documentRef: coordinateDocumentRef,
              x: point.x,
              y: point.y,
              coordinateSpace: readCoordinateSpace(input.coordinateSpace),
              targetText: targetText ?? '',
              targetRole,
              targetContext,
            },
            strategy: 'coordinate',
            resolved: this.describeElementDescriptor(target),
            point,
            hitTarget: this.describeElementDescriptor(target),
            hitStack: getElementsFromPoint(coordinateDocument, coordinatePoint)
              .slice(0, 5)
              .map((element) => this.describeElementDescriptor(element)),
            pageStateId: this.pageStateId,
          }
        : this.lastResolution;
      this.rejectTarget(
        'unsupported_target_scope',
        'Coordinate targeting cannot resolve an inaccessible frame document.',
        resolution,
      );
    }

    const targetTextMatched = targetText
      ? elementOrAncestorMatchesText(target, targetText)
      : undefined;
    if (targetText && !targetTextMatched) {
      this.rejectTarget(
        'coordinate_target_mismatch',
        `Pointer target text mismatch: expected exact hit target "${targetText}".`,
      );
    }
    if (targetRole) {
      const actionableTarget = findActionableAncestor(target);
      if (
        normalizeSemanticText(inferRole(actionableTarget)) !==
        normalizeSemanticText(targetRole)
      ) {
        this.rejectTarget(
          'coordinate_target_mismatch',
          `Pointer target role mismatch: expected "${targetRole}".`,
        );
      }
    }

    if (targetText) {
      const candidates = collectElements(coordinateDocument).filter(
        (candidate) =>
          candidate.ownerDocument === coordinateDocument &&
          isElementEnabled(candidate) &&
          isVisibleCandidate(candidate) &&
          Boolean(getReceivesEventsPoint(candidate)) &&
          elementMatchesCoordinateIdentity(
            candidate,
            targetText,
            targetRole,
            targetContext,
          ),
      );
      if (candidates.length > 1) {
        const requested = {
          kind: 'coordinate' as const,
          pageStateId:
            readOptionalString(input.pageStateId) ?? this.pageStateId,
          documentRef: coordinateDocumentRef,
          x: point.x,
          y: point.y,
          coordinateSpace: readCoordinateSpace(input.coordinateSpace),
          targetText,
          targetRole,
          targetContext,
        };
        this.rejectTarget(
          'coordinate_target_ambiguous',
          `Coordinate target matches ${candidates.length} actionable regions.`,
          {
            requested,
            strategy: 'coordinate',
            candidates: candidates.map((candidate) =>
              this.describeElementDescriptor(candidate),
            ),
            point,
            pageStateId: this.pageStateId,
          },
        );
      }
    }

    if (hasExplicitPoint) {
      this.lastResolution = {
        requested: {
          kind: 'coordinate',
          pageStateId:
            readOptionalString(input.pageStateId) ?? this.pageStateId,
          documentRef: coordinateDocumentRef,
          x: point.x,
          y: point.y,
          coordinateSpace: readCoordinateSpace(input.coordinateSpace),
          targetText: targetText ?? '',
          targetRole,
          targetContext,
        },
        strategy: 'coordinate',
        resolved: this.describeElementDescriptor(target),
        point,
        hitTarget: this.describeElementDescriptor(target),
        hitStack: getElementsFromPoint(coordinateDocument, coordinatePoint)
          .slice(0, 5)
          .map((element) => this.describeElementDescriptor(element)),
        pageStateId: this.pageStateId,
      };
    }

    if (action === 'click') {
      await this.requireActionApproval(
        'host_page_pointer',
        input,
        getActivationRisks(target),
        target,
      );
    }

    const eventPoint = hasExplicitPoint
      ? coordinatePoint
      : getDocumentViewportPoint(target.ownerDocument, point);
    const eventInit = {
      bubbles: true,
      cancelable: true,
      clientX: eventPoint.x,
      clientY: eventPoint.y,
      button,
    };

    if (action === 'move') {
      await this.showVisualEffect({
        type: 'pointer',
        action,
        anchor: 'point',
        point,
        target,
      });
      target.dispatchEvent(createPointerLikeEvent('pointermove', eventInit));
      target.dispatchEvent(new MouseEvent('mousemove', eventInit));
    } else if (action === 'down') {
      await this.showVisualEffect({
        type: 'pointer',
        action,
        anchor: 'point',
        point,
        target,
      });
      target.dispatchEvent(createPointerLikeEvent('pointerdown', eventInit));
      target.dispatchEvent(new MouseEvent('mousedown', eventInit));
    } else if (action === 'up') {
      await this.showVisualEffect({
        type: 'pointer',
        action,
        anchor: 'point',
        point,
        target,
      });
      target.dispatchEvent(createPointerLikeEvent('pointerup', eventInit));
      target.dispatchEvent(new MouseEvent('mouseup', eventInit));
    } else {
      await this.showVisualEffect({
        type: 'click',
        anchor: 'point',
        point,
        target,
      });
      let dispatchTarget = target;
      let dispatchPoint = point;
      let dispatchClientPoint = point;
      if (canHitTest(target.ownerDocument)) {
        if (!target.isConnected) {
          this.rejectTarget(
            'stale_target',
            'The coordinate target was replaced before pointer dispatch.',
            this.lastResolution,
          );
        }
        const latestTargetPoint = hasExplicitPoint
          ? coordinatePoint
          : getReceivesEventsPoint(target);
        if (!latestTargetPoint) {
          const latestActionability = getActionability(target);
          if (this.lastResolution) {
            this.lastResolution = {
              ...this.lastResolution,
              hitTarget: latestActionability.hitTarget
                ? this.describeElementDescriptor(latestActionability.hitTarget)
                : undefined,
              hitStack: latestActionability.hitStack
                .slice(0, 5)
                .map((element) => this.describeElementDescriptor(element)),
            };
          }
          this.rejectTarget(
            'target_occluded',
            'The coordinate target stopped receiving pointer events before dispatch.',
            this.lastResolution,
          );
        }
        const latestHitStack = getElementsFromPoint(
          hasExplicitPoint ? coordinateDocument : target.ownerDocument,
          latestTargetPoint,
        );
        const latestHitTarget = latestHitStack[0];
        if (latestHitTarget && isFrameElement(latestHitTarget)) {
          this.rejectTarget(
            'unsupported_target_scope',
            'The coordinate target became an inaccessible frame before pointer dispatch.',
            this.lastResolution,
          );
        }
        const latestActionableTarget = latestHitTarget
          ? findActionableAncestor(latestHitTarget)
          : undefined;
        const originalActionableTarget = findActionableAncestor(target);
        if (this.lastResolution) {
          this.lastResolution = {
            ...this.lastResolution,
            point: dispatchPoint,
            hitTarget: latestHitTarget
              ? this.describeElementDescriptor(latestHitTarget)
              : undefined,
            hitStack: latestHitStack
              .slice(0, 5)
              .map((element) => this.describeElementDescriptor(element)),
          };
        }
        if (
          !latestHitTarget ||
          latestActionableTarget !== originalActionableTarget ||
          (targetText &&
            (!latestActionableTarget ||
              !elementMatchesCoordinateIdentity(
                latestActionableTarget,
                targetText,
                targetRole,
                targetContext,
              )))
        ) {
          this.rejectTarget(
            'coordinate_target_mismatch',
            'The coordinate target identity changed before pointer dispatch.',
            this.lastResolution,
          );
        }
        dispatchTarget = latestHitTarget;
        dispatchClientPoint = latestTargetPoint;
        dispatchPoint = hasExplicitPoint
          ? point
          : getGlobalPoint(target, latestTargetPoint);
        if (this.lastResolution) {
          this.lastResolution = {
            ...this.lastResolution,
            point: dispatchPoint,
            resolved: this.describeElementDescriptor(target),
            hitTarget: this.describeElementDescriptor(latestHitTarget),
            hitStack: latestHitStack
              .slice(0, 5)
              .map((element) => this.describeElementDescriptor(element)),
          };
        }
      }
      const dispatchEventInit = {
        ...eventInit,
        clientX: dispatchClientPoint.x,
        clientY: dispatchClientPoint.y,
      };
      dispatchTarget.dispatchEvent(
        createPointerLikeEvent('pointerdown', dispatchEventInit),
      );
      dispatchTarget.dispatchEvent(
        new MouseEvent('mousedown', dispatchEventInit),
      );
      dispatchTarget.dispatchEvent(
        createPointerLikeEvent('pointerup', dispatchEventInit),
      );
      dispatchTarget.dispatchEvent(
        new MouseEvent('mouseup', dispatchEventInit),
      );
      if (isHtmlElement(dispatchTarget)) {
        dispatchTarget.click();
      } else {
        dispatchTarget.dispatchEvent(
          new MouseEvent('click', dispatchEventInit),
        );
      }
      this.invalidateReadableContent();
      return {
        pointer: action,
        point: dispatchPoint,
        coordinateSpace: 'viewport-css-px',
        target: this.describeElement(dispatchTarget),
        targetTextMatched,
        expectedAfterClick: evaluateExpectedAfterClick(
          this.getRoot(),
          readExpectedAfterClick(input.expectedAfterClick),
        ),
      };
    }

    return {
      pointer: action,
      point,
      coordinateSpace: 'viewport-css-px',
      target: this.describeElement(target),
      targetTextMatched,
      expectedAfterClick: undefined,
    };
  }

  private screenshot() {
    throw new Error(
      'host_page_screenshot requires the browser extension CDP adapter.',
    );
  }

  private async showVisualEffect(
    context: HostPageAutomationVisualEffectContext,
  ) {
    try {
      await this.options.showVisualEffect?.(context);
    } catch {
      // Visual feedback is best-effort and should never block automation.
    }

    if (
      context.type !== 'click' ||
      !context.point ||
      !context.target ||
      this.options.showVisualEffect
    ) {
      return;
    }

    try {
      await this.options.showClickEffect?.({
        point: context.point,
        target: context.target,
        requested: context.requested,
      });
    } catch {
      // Visual feedback is best-effort and should never block automation.
    }
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
      Math.max(
        0,
        (timeoutSeconds ?? WAIT_FOR_DEFAULT_TIMEOUT_MS / 1_000) * 1_000,
      ),
    );
    const startedAt = Date.now();
    const initialElement = this.tryResolveElement(input);

    await this.showVisualEffect({
      type: 'wait_for',
      state,
      target: initialElement ?? undefined,
      requested: initialElement ?? undefined,
      ...(initialElement ? { anchor: 'target' as const } : {}),
      point: initialElement
        ? getActionability(initialElement).center
        : undefined,
    });

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
