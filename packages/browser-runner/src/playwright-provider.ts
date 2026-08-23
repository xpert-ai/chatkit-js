import { createHash, randomUUID } from 'node:crypto';

import {
  chromium,
  type BrowserContext,
  type ElementHandle,
  type Frame,
  type Page,
} from 'playwright-core';

import { addBrowserActionEvidence } from './action-evidence.js';
import type {
  IsolatedBrowserLaunchOptions,
  IsolatedBrowserSession,
} from './runner.js';
import type {
  ActionExpectation,
  BrowserActionRisk,
  ClientToolMessageInput,
  HostPageAutomationClientToolCall,
  TargetResolution,
  VerificationResult,
} from './types.js';

const ACTION_APPROVAL_TTL_MS = 60_000;
const SNAPSHOT_CACHE_TTL_MS = 2 * 60_000;
const ACTION_TOOLS = new Set([
  'host_page_click',
  'host_page_fill',
  'host_page_press',
  'host_page_select',
  'host_page_scroll',
  'host_page_navigate',
  'host_page_hover',
  'host_page_focus',
  'host_page_pointer',
]);
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
const WEAK_SELECTOR = /^(?:\*|[a-z][a-z0-9-]*|\[role(?:=|\]))$/i;

type ElementFingerprint = {
  tag: string;
  role?: string;
  name?: string;
  text?: string;
  testId?: string;
};

type StoredTarget = {
  ref: string;
  documentRef: string;
  frame: Frame;
  handle: ElementHandle<Element>;
  fingerprint: ElementFingerprint;
};

type SnapshotState = {
  pageStateId: string;
  createdAt: number;
  invalidated: boolean;
  targets: Map<string, StoredTarget>;
  documents: Map<string, Frame>;
};

type PendingApproval = {
  action: string;
  actionHash: string;
  pageStateId: string;
  url: string;
  targetFingerprint?: string;
  risks: BrowserActionRisk[];
  expiresAt: number;
};

class RunnerAutomationError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, unknown>,
  ) {
    super(message);
  }
}

function normalizeParams(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function createToolMessage(
  call: HostPageAutomationClientToolCall,
  status: 'success' | 'error',
  content: unknown,
  artifact?: unknown,
): ClientToolMessageInput {
  return {
    tool_call_id: call.tool_call_id ?? call.id,
    name: call.name,
    status,
    content: JSON.stringify(content),
    ...(artifact === undefined ? {} : { artifact }),
  };
}

function structuredError(
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): RunnerAutomationError {
  return new RunnerAutomationError(message, {
    code,
    message,
    recoverable: true,
    dispatched: false,
    outcome: 'rejected_before_execution',
    ...extra,
  });
}

function canonicalActionValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalActionValue);
  if (!value || typeof value !== 'object') return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entry]) => key !== 'actionToken' && entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalActionValue(entry)]),
  );
}

function hashAction(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalActionValue(value)))
    .digest('hex');
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function describeElementInPage(element: Element): ElementFingerprint {
  const getRole = () => {
    const explicit = element.getAttribute('role')?.trim().toLowerCase();
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'input') {
      const type = (element as HTMLInputElement).type;
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (['button', 'submit', 'reset'].includes(type)) return 'button';
      return 'textbox';
    }
    return undefined;
  };
  const text = element.textContent?.replace(/\s+/g, ' ').trim() || undefined;
  const name =
    element.getAttribute('aria-label')?.trim() ||
    element.getAttribute('title')?.trim() ||
    text;
  return {
    tag: element.tagName.toLowerCase(),
    role: getRole(),
    name,
    text,
    testId:
      element.getAttribute('data-testid') ??
      element.getAttribute('data-test-id') ??
      element.getAttribute('data-qa') ??
      undefined,
  };
}

async function describeStoredTarget(target: StoredTarget) {
  const [fingerprint, rect] = await Promise.all([
    target.handle.evaluate(describeElementInPage),
    target.handle.boundingBox(),
  ]);
  return {
    documentRef: target.documentRef,
    ref: target.ref,
    ...fingerprint,
    rect: rect ?? { x: 0, y: 0, width: 0, height: 0 },
  };
}

async function fingerprintHandle(
  handle: ElementHandle<Element>,
): Promise<ElementFingerprint> {
  return handle.evaluate(describeElementInPage);
}

function fingerprintsMatch(
  left: ElementFingerprint,
  right: ElementFingerprint,
) {
  return (
    left.tag === right.tag &&
    normalizeText(left.role) === normalizeText(right.role) &&
    normalizeText(left.name) === normalizeText(right.name) &&
    normalizeText(left.text) === normalizeText(right.text) &&
    left.testId === right.testId
  );
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function targetRequestFromParams(
  params: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const pageStateId = readString(params.pageStateId);
  const documentRef = readString(params.documentRef);
  if (!pageStateId || !documentRef) return undefined;
  if (readString(params.ref)) {
    return { kind: 'ref', pageStateId, documentRef, ref: params.ref };
  }
  if (readString(params.axRef)) {
    return { kind: 'ax_ref', pageStateId, documentRef, axRef: params.axRef };
  }
  if (readString(params.testId)) {
    return {
      kind: 'test_id',
      pageStateId,
      documentRef,
      testId: params.testId,
    };
  }
  if (readString(params.selector)) {
    return {
      kind: 'selector',
      pageStateId,
      documentRef,
      selector: params.selector,
    };
  }
  const role = readString(params.role);
  const name = readString(params.name);
  const text = readString(params.text);
  if (role && Boolean(name) !== Boolean(text)) {
    return {
      kind: 'semantic',
      pageStateId,
      documentRef,
      match: 'exact',
      identity: name ? { role, name } : { role, text },
    };
  }
  return undefined;
}

class PlaywrightBrowserSession implements IsolatedBrowserSession {
  private state?: SnapshotState;
  private readonly pendingApprovals = new Map<string, PendingApproval>();
  private readonly manualListeners = new Set<() => void>();
  private readonly closeListeners = new Set<() => void>();
  private agentActionDepth = 0;
  private closed = false;

  constructor(
    private readonly context: BrowserContext,
    private page: Page,
  ) {}

  static async create(
    context: BrowserContext,
    page: Page,
  ): Promise<PlaywrightBrowserSession> {
    const session = new PlaywrightBrowserSession(context, page);
    await session.installStateMonitors();
    session.observePage(page);
    context.on('page', (nextPage) => {
      session.page = nextPage;
      session.observePage(nextPage);
    });
    return session;
  }

  onManualIntervention(listener: () => void) {
    this.manualListeners.add(listener);
  }

  onClosed(listener: () => void) {
    this.closeListeners.add(listener);
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.context.close();
  }

  async execute(
    call: HostPageAutomationClientToolCall,
  ): Promise<ClientToolMessageInput> {
    try {
      const params = normalizeParams(call.params);
      const result = await this.run(call.name, params);
      const traced = ACTION_TOOLS.has(call.name)
        ? addBrowserActionEvidence(call.name, this.page.url(), result)
        : result;
      const failed =
        traced &&
        typeof traced === 'object' &&
        !Array.isArray(traced) &&
        Reflect.get(traced, 'outcome') === 'verification_failed';
      return createToolMessage(call, failed ? 'error' : 'success', {
        ok: !failed,
        result: traced,
      });
    } catch (error) {
      if (error instanceof RunnerAutomationError) {
        const details = addBrowserActionEvidence(
          call.name,
          this.page.url(),
          error.details,
        );
        return createToolMessage(call, 'error', {
          ok: false,
          ...(details as Record<string, unknown>),
        });
      }
      return createToolMessage(call, 'error', {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async installStateMonitors() {
    await this.context.exposeBinding(
      '__xpertChatKitRunnerStateChanged',
      (_source, kind: unknown) => {
        if (kind === 'manual' && this.agentActionDepth === 0) {
          this.invalidateState(true);
        } else if (kind === 'structure') {
          this.invalidateState(false);
        }
      },
    );
    await this.context.addInitScript({
      content: `(${installPageMonitor.toString()})()`,
    });
    await Promise.all(
      this.page
        .frames()
        .map((frame) =>
          frame.evaluate(installPageMonitor).catch(() => undefined),
        ),
    );
  }

  private observePage(page: Page) {
    page.on('close', () => {
      if (this.context.pages().length === 0) {
        this.closed = true;
        for (const listener of this.closeListeners) listener();
      }
    });
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && this.agentActionDepth === 0) {
        this.invalidateState(true);
      }
    });
  }

  private invalidateState(manual: boolean) {
    if (this.state) this.state.invalidated = true;
    this.pendingApprovals.clear();
    if (manual) {
      for (const listener of this.manualListeners) listener();
    }
  }

  private assertCurrentState(params: Record<string, unknown>) {
    const pageStateId = readString(params.pageStateId);
    if (
      !pageStateId ||
      !this.state ||
      this.state.invalidated ||
      Date.now() - this.state.createdAt > SNAPSHOT_CACHE_TTL_MS ||
      this.state.pageStateId !== pageStateId
    ) {
      throw structuredError(
        'stale_page_state',
        'The requested isolated browser page state is stale. Take a fresh snapshot.',
        {
          requiresFreshSnapshot: true,
          ...(pageStateId ? { invalidatedPageStateId: pageStateId } : {}),
        },
      );
    }
  }

  private async run(name: string, params: Record<string, unknown>) {
    if (name === 'host_page_snapshot') return this.snapshot();
    if (name === 'host_page_read') return this.readPage(params);
    if (name === 'host_page_screenshot') return this.screenshot(params);
    if (name === 'host_page_navigate') {
      this.assertCurrentState(params);
      const rawUrl = readString(params.url);
      if (!rawUrl) throw new Error('url must be a non-empty string.');
      const url = new URL(rawUrl, this.page.url());
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Navigation only supports HTTP(S) URLs.');
      }
      await this.withAgentAction(() => this.page.goto(url.toString()));
      return this.completeAction(
        { navigated: url.toString(), strategy: 'playwright_page' },
        undefined,
        true,
        params,
      );
    }
    if (name === 'host_page_pointer') {
      this.assertCurrentState(params);
      return this.pointer(params);
    }
    if (name === 'host_page_press' && !targetRequestFromParams(params)) {
      this.assertCurrentState(params);
      const key = readString(params.key);
      if (!key) throw new Error('key must be a non-empty string.');
      await this.withAgentAction(() => this.page.keyboard.press(key));
      return this.completeAction(
        { pressed: key, strategy: 'playwright_keyboard' },
        undefined,
        true,
        params,
      );
    }
    if (name === 'host_page_scroll' && !targetRequestFromParams(params)) {
      this.assertCurrentState(params);
      const deltaX = typeof params.deltaX === 'number' ? params.deltaX : 0;
      const deltaY = typeof params.deltaY === 'number' ? params.deltaY : 0;
      await this.withAgentAction(() => this.page.mouse.wheel(deltaX, deltaY));
      return this.completeAction(
        { scrolled: 'page', strategy: 'playwright_mouse' },
        undefined,
        true,
        params,
      );
    }

    this.assertCurrentState(params);
    const target = await this.resolveTarget(params);
    const risks = await this.inspectTargetRisks(target);
    await this.requireApproval(name, params, target, risks);
    const resolution = await this.createResolution(params, target);
    let result: Record<string, unknown>;
    let invalidate = false;
    switch (name) {
      case 'host_page_click':
        await this.withAgentAction(() => target.handle.click());
        result = {
          clicked: await describeStoredTarget(target),
          strategy: 'playwright_mouse',
        };
        invalidate = true;
        break;
      case 'host_page_fill': {
        const value = typeof params.value === 'string' ? params.value : '';
        await this.withAgentAction(() => target.handle.fill(value));
        result = {
          filled: await describeStoredTarget(target),
          strategy: 'playwright_fill',
        };
        invalidate = true;
        break;
      }
      case 'host_page_press': {
        const key = readString(params.key);
        if (!key) throw new Error('key must be a non-empty string.');
        await this.withAgentAction(() => target.handle.press(key));
        result = { pressed: key, strategy: 'playwright_keyboard' };
        invalidate = true;
        break;
      }
      case 'host_page_select': {
        const values = Array.isArray(params.values)
          ? params.values.filter(
              (value): value is string => typeof value === 'string',
            )
          : readString(params.value)
            ? [String(params.value)]
            : [];
        await this.withAgentAction(() => target.handle.selectOption(values));
        result = { selected: values.length, strategy: 'playwright_select' };
        invalidate = true;
        break;
      }
      case 'host_page_hover':
        await this.withAgentAction(() => target.handle.hover());
        result = {
          hovered: await describeStoredTarget(target),
          strategy: 'playwright_mouse',
        };
        break;
      case 'host_page_focus':
        await this.withAgentAction(() => target.handle.focus());
        result = {
          focused: await describeStoredTarget(target),
          strategy: 'playwright_focus',
        };
        break;
      case 'host_page_scroll': {
        const deltaX = typeof params.deltaX === 'number' ? params.deltaX : 0;
        const deltaY = typeof params.deltaY === 'number' ? params.deltaY : 0;
        await this.withAgentAction(() =>
          target.handle.evaluate(
            (element, delta) => element.scrollBy(delta.x, delta.y),
            { x: deltaX, y: deltaY },
          ),
        );
        result = {
          scrolled: await describeStoredTarget(target),
          strategy: 'playwright_dom',
        };
        invalidate = true;
        break;
      }
      case 'host_page_wait_for': {
        const state =
          params.state === 'attached' ||
          params.state === 'hidden' ||
          params.state === 'detached'
            ? params.state
            : 'visible';
        await target.handle.waitForElementState(
          state === 'attached'
            ? 'stable'
            : state === 'detached'
              ? 'hidden'
              : state,
          {
            timeout:
              typeof params.timeoutMs === 'number' ? params.timeoutMs : 10_000,
          },
        );
        return { state, matched: true };
      }
      default:
        throw new Error(`Unknown isolated browser automation tool: ${name}`);
    }
    return this.completeAction(result, resolution, invalidate, params);
  }

  private async snapshot() {
    const pageStateId = randomUUID();
    const targets = new Map<string, StoredTarget>();
    const documents = new Map<string, Frame>();
    const elements: Array<Record<string, unknown>> = [];
    const frames = this.page.frames();

    for (const [frameIndex, frame] of frames.entries()) {
      const documentRef = `d${frameIndex + 1}`;
      documents.set(documentRef, frame);
      const handles = await frame.locator(CANDIDATE_SELECTOR).elementHandles();
      for (const handle of handles.slice(0, 500)) {
        const ref = `e${targets.size + 1}`;
        const target: StoredTarget = {
          ref,
          documentRef,
          frame,
          handle: handle as ElementHandle<Element>,
          fingerprint: await fingerprintHandle(
            handle as ElementHandle<Element>,
          ),
        };
        targets.set(ref, target);
        const descriptor = await describeStoredTarget(target);
        const [visible, enabled] = await Promise.all([
          target.handle.isVisible(),
          target.handle.isEnabled().catch(() => true),
        ]);
        elements.push({ ...descriptor, visible, enabled, disabled: !enabled });
      }
    }

    this.state = {
      pageStateId,
      createdAt: Date.now(),
      invalidated: false,
      targets,
      documents,
    };
    this.pendingApprovals.clear();
    await this.page.evaluate(installPageMonitor).catch(() => undefined);
    const viewport = this.page.viewportSize() ?? { width: 0, height: 0 };
    const scroll = await this.page
      .evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
      .catch(() => ({ x: 0, y: 0 }));
    const topOrigin = safeOrigin(this.page.url());
    const readableContent = await this.page
      .locator('body')
      .innerText()
      .then((text) => text.slice(0, 24_000))
      .catch(() => '');

    return {
      pageStateId,
      url: this.page.url(),
      title: await this.page.title(),
      capabilities: {
        cdp: true,
        realInput: true,
        screenshot: true,
        accessibility: false,
        networkState: true,
        targetingVersion: 2,
        strictRefs: true,
        strictCoordinates: true,
        freshState: true,
        postconditions: true,
        policyGate: true,
        actionTrace: true,
      },
      documents: frames.map((frame, index) => ({
        documentRef: `d${index + 1}`,
        ...(frame === this.page.mainFrame()
          ? {}
          : { frameRef: `frame-${index}`, parentDocumentRef: 'd1' }),
        sameOrigin: safeOrigin(frame.url()) === topOrigin,
      })),
      viewport: { ...viewport, devicePixelRatio: 1 },
      scroll,
      page: { readyState: await this.page.evaluate(() => document.readyState) },
      readableContent: { text: readableContent },
      elements,
    };
  }

  private async readPage(params: Record<string, unknown>) {
    const maxChars =
      typeof params.maxChars === 'number'
        ? Math.max(1, Math.min(100_000, Math.floor(params.maxChars)))
        : 24_000;
    const text = await this.page
      .locator('body')
      .innerText()
      .catch(() => '');
    return {
      url: this.page.url(),
      title: await this.page.title(),
      text: text.slice(0, maxChars),
    };
  }

  private async screenshot(params: Record<string, unknown>) {
    const type = params.format === 'png' ? 'png' : 'jpeg';
    const buffer = await this.page.screenshot({
      type,
      quality:
        type === 'jpeg'
          ? typeof params.quality === 'number'
            ? params.quality
            : 60
          : undefined,
    });
    const mimeType = type === 'png' ? 'image/png' : 'image/jpeg';
    return {
      mimeType,
      data: buffer.toString('base64'),
      viewport: this.page.viewportSize() ?? undefined,
      coordinateSpace: 'viewport-css-px',
    };
  }

  private async resolveTarget(
    params: Record<string, unknown>,
  ): Promise<StoredTarget> {
    const request = targetRequestFromParams(params);
    if (!request || !this.state) {
      throw structuredError(
        'target_not_found',
        'A strict isolated browser target is required.',
      );
    }
    const documentRef = String(request.documentRef);
    const frame = this.state.documents.get(documentRef);
    if (!frame) {
      throw structuredError(
        'unsupported_target_scope',
        'The requested document scope is unavailable.',
      );
    }

    if (request.kind === 'ref') {
      const target = this.state.targets.get(String(request.ref));
      if (!target || target.documentRef !== documentRef) {
        throw structuredError(
          'stale_target',
          'The requested target ref is stale.',
        );
      }
      const connected = await target.handle
        .evaluate((element) => element.isConnected)
        .catch(() => false);
      const fingerprint = connected
        ? await fingerprintHandle(target.handle)
        : undefined;
      if (
        !connected ||
        !fingerprint ||
        !fingerprintsMatch(target.fingerprint, fingerprint)
      ) {
        throw structuredError(
          'stale_target',
          'The requested target ref no longer identifies the same element.',
        );
      }
      await this.assertActionable(target);
      return target;
    }

    let handles: Array<ElementHandle<Element>> = [];
    if (request.kind === 'test_id') {
      const value = String(request.testId);
      handles = (await frame
        .locator('[data-testid], [data-test-id], [data-qa]')
        .elementHandles()) as Array<ElementHandle<Element>>;
      handles = (
        await Promise.all(
          handles.map(async (handle) =>
            (await handle.evaluate(
              (element, expected) =>
                (element.getAttribute('data-testid') ??
                  element.getAttribute('data-test-id') ??
                  element.getAttribute('data-qa')) === expected,
              value,
            ))
              ? handle
              : null,
          ),
        )
      ).filter((handle): handle is ElementHandle<Element> => Boolean(handle));
    } else if (request.kind === 'selector') {
      const selector = String(request.selector);
      if (WEAK_SELECTOR.test(selector.trim())) {
        throw structuredError(
          'unsafe_selector',
          'The requested selector is too broad for strict execution.',
        );
      }
      handles = (await frame.locator(selector).elementHandles()) as Array<
        ElementHandle<Element>
      >;
    } else if (request.kind === 'semantic') {
      const identity = request.identity as {
        role: string;
        name?: string;
        text?: string;
      };
      const candidates = (await frame
        .locator(CANDIDATE_SELECTOR)
        .elementHandles()) as Array<ElementHandle<Element>>;
      handles = (
        await Promise.all(
          candidates.map(async (handle) => {
            const fingerprint = await fingerprintHandle(handle);
            const matches =
              normalizeText(fingerprint.role) ===
                normalizeText(identity.role) &&
              (identity.name
                ? normalizeText(fingerprint.name) ===
                  normalizeText(identity.name)
                : normalizeText(fingerprint.text) ===
                  normalizeText(identity.text));
            return matches ? handle : null;
          }),
        )
      ).filter((handle): handle is ElementHandle<Element> => Boolean(handle));
    } else {
      throw structuredError(
        'target_not_found',
        'Accessibility refs are not exposed by the isolated runner.',
      );
    }

    if (handles.length !== 1) {
      throw structuredError(
        handles.length === 0 ? 'target_not_found' : 'ambiguous_target',
        handles.length === 0
          ? 'The strict target was not found.'
          : `The strict target matched ${handles.length} elements.`,
      );
    }
    const handle = handles[0]!;
    const target: StoredTarget = {
      ref: `resolved-${randomUUID()}`,
      documentRef,
      frame,
      handle,
      fingerprint: await fingerprintHandle(handle),
    };
    await this.assertActionable(target);
    return target;
  }

  private async assertActionable(target: StoredTarget) {
    if (!(await target.handle.isVisible())) {
      throw structuredError(
        'target_not_found',
        'The requested target is not visible.',
      );
    }
    if (!(await target.handle.isEnabled().catch(() => true))) {
      throw structuredError(
        'target_disabled',
        'The requested target is disabled.',
      );
    }
    if (!(await target.handle.boundingBox())) {
      throw structuredError(
        'target_occluded',
        'The requested target has no safe input point.',
      );
    }
  }

  private async createResolution(
    params: Record<string, unknown>,
    target: StoredTarget,
  ): Promise<TargetResolution> {
    const requested = targetRequestFromParams(
      params,
    ) as TargetResolution['requested'];
    const strategy: TargetResolution['strategy'] =
      requested.kind === 'selector'
        ? 'unique_selector'
        : requested.kind === 'semantic'
          ? 'semantic_exact'
          : requested.kind === 'test_id'
            ? 'test_id'
            : requested.kind === 'ax_ref'
              ? 'ax_ref'
              : 'ref';
    return {
      requested,
      strategy,
      pageStateId: requested.pageStateId,
      resolved: await describeStoredTarget(target),
    };
  }

  private async inspectTargetRisks(
    target: StoredTarget,
  ): Promise<BrowserActionRisk[]> {
    return target.handle.evaluate((element) => {
      const risks: BrowserActionRisk[] = [];
      const tag = element.tagName.toLowerCase();
      if (tag === 'input' && (element as HTMLInputElement).type === 'password')
        risks.push('password_input');
      if (tag === 'input' && (element as HTMLInputElement).type === 'file')
        risks.push('file_input');
      if (
        (tag === 'button' &&
          (element as HTMLButtonElement).type === 'submit') ||
        (tag === 'input' &&
          ['submit', 'image'].includes((element as HTMLInputElement).type))
      ) {
        risks.push('form_submit');
      }
      if (tag === 'a') {
        const anchor = element as HTMLAnchorElement;
        if (anchor.download) risks.push('download');
      }
      return risks;
    });
  }

  private async requireApproval(
    action: string,
    params: Record<string, unknown>,
    target: StoredTarget | undefined,
    risks: BrowserActionRisk[],
  ) {
    if (!risks.length || !this.state) return;
    const actionHash = hashAction(params);
    const targetFingerprint = target
      ? hashAction(target.fingerprint)
      : undefined;
    const token = readString(params.actionToken);
    if (token) {
      const pending = this.pendingApprovals.get(token);
      this.pendingApprovals.delete(token);
      const reason = !pending
        ? 'invalid_or_used_token'
        : pending.expiresAt < Date.now()
          ? 'expired_token'
          : pending.pageStateId !== this.state.pageStateId ||
              pending.url !== this.page.url()
            ? 'state_mismatch'
            : pending.action !== action ||
                pending.actionHash !== actionHash ||
                pending.targetFingerprint !== targetFingerprint
              ? 'action_mismatch'
              : undefined;
      if (!reason) return;
      throw structuredError(
        'approval_required',
        'The isolated browser approval token is invalid.',
        {
          approvalReason: reason,
          risks,
        },
      );
    }
    const actionToken = randomUUID();
    const expiresAt = Date.now() + ACTION_APPROVAL_TTL_MS;
    this.pendingApprovals.set(actionToken, {
      action,
      actionHash,
      pageStateId: this.state.pageStateId,
      url: this.page.url(),
      targetFingerprint,
      risks,
      expiresAt,
    });
    throw structuredError(
      'approval_required',
      'The isolated browser action requires approval.',
      {
        actionToken,
        approvalReason: 'approval_required',
        expiresAt: new Date(expiresAt).toISOString(),
        risks,
      },
    );
  }

  private async pointer(params: Record<string, unknown>) {
    if (!this.state)
      throw structuredError('stale_page_state', 'Take a fresh snapshot.');
    const pageStateId = readString(params.pageStateId);
    const documentRef = readString(params.documentRef);
    const targetText = readString(params.targetText);
    const coordinateSpace = params.coordinateSpace;
    const x = typeof params.x === 'number' ? params.x : NaN;
    const y = typeof params.y === 'number' ? params.y : NaN;
    if (
      !pageStateId ||
      documentRef !== 'd1' ||
      !targetText ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      (coordinateSpace !== 'viewport-css-px' &&
        coordinateSpace !== 'viewport_normalized')
    ) {
      throw structuredError(
        documentRef && documentRef !== 'd1'
          ? 'unsupported_target_scope'
          : 'coordinate_target_mismatch',
        'Strict runner coordinates require top-document pageStateId, documentRef, coordinateSpace, x/y and targetText.',
      );
    }
    const viewport = this.page.viewportSize() ?? { width: 0, height: 0 };
    const point = {
      x: coordinateSpace === 'viewport_normalized' ? x * viewport.width : x,
      y: coordinateSpace === 'viewport_normalized' ? y * viewport.height : y,
    };
    const action = readString(params.action) ?? 'click';
    const inspected = await this.page.evaluate(
      ({
        point,
        targetText,
        targetRole,
        targetContext,
        candidateSelector,
        action,
      }) => {
        const normalize = (value: string | undefined) =>
          (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
        const role = (element: Element) => {
          const explicit = element.getAttribute('role')?.trim().toLowerCase();
          if (explicit) return explicit;
          const tag = element.tagName.toLowerCase();
          if (tag === 'button' || tag === 'summary') return 'button';
          if (tag === 'a') return 'link';
          if (tag === 'textarea') return 'textbox';
          if (tag === 'select') return 'combobox';
          if (tag === 'input') {
            const type = (element as HTMLInputElement).type;
            if (type === 'checkbox') return 'checkbox';
            if (type === 'radio') return 'radio';
            if (['button', 'submit', 'reset'].includes(type)) return 'button';
            return 'textbox';
          }
          return undefined;
        };
        const name = (element: Element) =>
          element.getAttribute('aria-label')?.trim() ||
          element.getAttribute('title')?.trim() ||
          element.textContent?.replace(/\s+/g, ' ').trim() ||
          undefined;
        const matches = (element: Element) => {
          const identityMatches =
            (!targetRole ||
              normalize(role(element)) === normalize(targetRole)) &&
            (normalize(name(element)) === normalize(targetText) ||
              normalize(element.textContent ?? '') === normalize(targetText));
          if (!identityMatches || !targetContext) return identityMatches;
          let current = element.parentElement;
          for (
            let depth = 0;
            current && depth < 4;
            depth += 1, current = current.parentElement
          ) {
            if (
              normalize(current.textContent ?? '').includes(
                normalize(targetContext),
              )
            )
              return true;
          }
          return false;
        };
        const describe = (element: Element) => ({
          tag: element.tagName.toLowerCase(),
          role: role(element),
          name: name(element),
          text: element.textContent?.replace(/\s+/g, ' ').trim() || undefined,
          testId:
            element.getAttribute('data-testid') ??
            element.getAttribute('data-test-id') ??
            element.getAttribute('data-qa') ??
            undefined,
        });
        const risks = (element: Element) => {
          const entries: BrowserActionRisk[] = [];
          const tag = element.tagName.toLowerCase();
          if (
            tag === 'input' &&
            (element as HTMLInputElement).type === 'password'
          )
            entries.push('password_input');
          if (tag === 'input' && (element as HTMLInputElement).type === 'file')
            entries.push('file_input');
          if (action === 'click') {
            if (
              (tag === 'button' &&
                (element as HTMLButtonElement).type === 'submit') ||
              (tag === 'input' &&
                ['submit', 'image'].includes(
                  (element as HTMLInputElement).type,
                ))
            ) {
              entries.push('form_submit');
            }
            if (tag === 'a') {
              const anchor = element as HTMLAnchorElement;
              if (anchor.download) entries.push('download');
            }
          }
          return entries;
        };
        const candidates = Array.from(
          document.querySelectorAll(candidateSelector),
        ).filter(matches);
        const hitStack = document.elementsFromPoint(point.x, point.y);
        let hit: Element | undefined;
        for (const element of hitStack) {
          let current: Element | null = element;
          for (
            let depth = 0;
            current && depth < 5;
            depth += 1, current = current.parentElement
          ) {
            if (matches(current)) {
              hit = current;
              break;
            }
          }
          if (hit) break;
        }
        return {
          candidateCount: candidates.length,
          hit: hit ? describe(hit) : undefined,
          risks: hit ? risks(hit) : [],
          hitStack: hitStack.slice(0, 8).map(describe),
        };
      },
      {
        point,
        targetText,
        targetRole: readString(params.targetRole),
        targetContext: readString(params.targetContext),
        candidateSelector: CANDIDATE_SELECTOR,
        action,
      },
    );
    if (inspected.candidateCount > 1) {
      throw structuredError(
        'coordinate_target_ambiguous',
        'The coordinate identity is ambiguous.',
      );
    }
    if (inspected.candidateCount !== 1 || !inspected.hit) {
      throw structuredError(
        'coordinate_target_mismatch',
        'The coordinate hit target does not match the requested identity.',
      );
    }
    const requested = {
      kind: 'coordinate' as const,
      pageStateId,
      documentRef,
      x,
      y,
      coordinateSpace,
      targetText,
      ...(readString(params.targetRole)
        ? { targetRole: readString(params.targetRole)! }
        : {}),
      ...(readString(params.targetContext)
        ? { targetContext: readString(params.targetContext)! }
        : {}),
    };
    const resolution: TargetResolution = {
      requested,
      strategy: 'coordinate',
      pageStateId,
      point,
      hitTarget: {
        documentRef,
        ...inspected.hit,
        rect: { x: point.x, y: point.y, width: 0, height: 0 },
      },
      hitStack: inspected.hitStack.map((entry) => ({
        documentRef,
        ...entry,
        rect: { x: point.x, y: point.y, width: 0, height: 0 },
      })),
    };
    await this.requireApproval(
      'host_page_pointer',
      params,
      undefined,
      inspected.risks,
    );
    await this.withAgentAction(async () => {
      if (action === 'move') await this.page.mouse.move(point.x, point.y);
      else if (action === 'down') await this.page.mouse.down();
      else if (action === 'up') await this.page.mouse.up();
      else await this.page.mouse.click(point.x, point.y);
    });
    return this.completeAction(
      { pointer: action, point, strategy: 'playwright_mouse' },
      resolution,
      action === 'click',
      params,
    );
  }

  private async completeAction(
    result: Record<string, unknown>,
    resolution: TargetResolution | undefined,
    invalidate: boolean,
    params: Record<string, unknown>,
  ) {
    const activePageStateId = this.state?.pageStateId;
    const verification = params.expectation
      ? await this.verifyExpectation(params.expectation as ActionExpectation)
      : undefined;
    await this.page.waitForTimeout(0);
    const requiresFreshSnapshot =
      invalidate || Boolean(this.state?.invalidated);
    if (requiresFreshSnapshot && this.state) this.state.invalidated = true;
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
      ...(requiresFreshSnapshot && activePageStateId
        ? { invalidatedPageStateId: activePageStateId }
        : {}),
      ...(resolution ? { resolution } : {}),
      ...(verification ? { verification } : {}),
    };
  }

  private async verifyExpectation(
    expectation: ActionExpectation,
  ): Promise<VerificationResult> {
    const startedAt = Date.now();
    let actual: string | boolean | null = null;
    while (Date.now() - startedAt <= 10_000) {
      const check = await this.checkExpectation(expectation);
      actual = check.actual;
      if (check.matched) {
        return {
          status: 'passed',
          expectation,
          elapsedMs: Date.now() - startedAt,
          actual,
        };
      }
      if (check.terminal) {
        return {
          status: 'failed',
          expectation,
          elapsedMs: Date.now() - startedAt,
          actual,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return {
      status: 'timed_out',
      expectation,
      elapsedMs: Date.now() - startedAt,
      actual,
    };
  }

  private async checkExpectation(expectation: ActionExpectation): Promise<{
    matched: boolean;
    terminal?: boolean;
    actual: string | boolean | null;
  }> {
    if (expectation.type === 'url_matches') {
      const actual = this.page.url();
      return {
        matched:
          expectation.mode === 'exact'
            ? actual === expectation.value
            : actual.startsWith(expectation.value),
        actual,
      };
    }
    if (expectation.type === 'text_visible') {
      const actual = await this.page
        .locator('body')
        .innerText()
        .catch(() => '');
      return {
        matched: normalizeText(actual).includes(
          normalizeText(expectation.value),
        ),
        actual,
      };
    }
    const documentRef =
      expectation.target.documentScope === 'current_top'
        ? 'd1'
        : expectation.target.documentRef;
    const frame =
      this.state?.documents.get(documentRef) ??
      (documentRef === 'd1' ? this.page.mainFrame() : undefined);
    if (!frame) return { matched: false, terminal: true, actual: null };
    let locator;
    if (expectation.target.kind === 'test_id') {
      const value = expectation.target.testId.replaceAll('"', '\\"');
      locator = frame.locator(
        `[data-testid="${value}"], [data-test-id="${value}"], [data-qa="${value}"]`,
      );
    } else if (expectation.target.kind === 'selector') {
      if (WEAK_SELECTOR.test(expectation.target.selector)) {
        return { matched: false, terminal: true, actual: null };
      }
      locator = frame.locator(expectation.target.selector);
    } else {
      const candidates = frame.locator(CANDIDATE_SELECTOR);
      const matches = await candidates.evaluateAll((elements, identity) => {
        const normalize = (value: string | undefined) =>
          (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
        const role = (element: Element) => {
          const explicit = element.getAttribute('role')?.trim().toLowerCase();
          if (explicit) return explicit;
          const tag = element.tagName.toLowerCase();
          if (tag === 'button' || tag === 'summary') return 'button';
          if (tag === 'a') return 'link';
          if (tag === 'textarea') return 'textbox';
          if (tag === 'select') return 'combobox';
          if (tag === 'input') {
            const type = (element as HTMLInputElement).type;
            if (type === 'checkbox') return 'checkbox';
            if (type === 'radio') return 'radio';
            if (['button', 'submit', 'reset'].includes(type)) return 'button';
            return 'textbox';
          }
          return undefined;
        };
        return elements
          .map((element, index) => ({ element, index }))
          .filter(({ element }) => {
            const text =
              element.textContent?.replace(/\s+/g, ' ').trim() || undefined;
            const name =
              element.getAttribute('aria-label')?.trim() ||
              element.getAttribute('title')?.trim() ||
              text;
            return (
              normalize(role(element)) === normalize(identity.role) &&
              ('name' in identity
                ? normalize(name) === normalize(identity.name)
                : normalize(text) === normalize(identity.text))
            );
          })
          .map(({ index }) => index);
      }, expectation.target.identity);
      if (matches.length !== 1)
        return { matched: false, terminal: matches.length > 1, actual: null };
      locator = candidates.nth(matches[0]!);
    }
    const count = await locator.count();
    if (count > 1) return { matched: false, terminal: true, actual: null };
    if (count === 0)
      return { matched: expectation.type === 'element_hidden', actual: null };
    if (
      expectation.type === 'element_visible' ||
      expectation.type === 'element_hidden'
    ) {
      const actual = await locator.isVisible();
      return {
        matched: expectation.type === 'element_visible' ? actual : !actual,
        actual,
      };
    }
    if (expectation.type === 'checked_equals') {
      const actual = await locator.isChecked().catch(() => false);
      return { matched: actual === expectation.value, actual };
    }
    const actual = await locator.inputValue().catch(() => '');
    return { matched: actual.includes(expectation.value), actual };
  }

  private async withAgentAction<T>(action: () => Promise<T>): Promise<T> {
    this.agentActionDepth += 1;
    await this.page
      .evaluate(() => {
        Reflect.set(globalThis, '__xpertChatKitAgentAction', true);
      })
      .catch(() => undefined);
    try {
      return await action();
    } finally {
      await this.page
        .evaluate(() => {
          Reflect.set(globalThis, '__xpertChatKitAgentAction', false);
        })
        .catch(() => undefined);
      this.agentActionDepth -= 1;
    }
  }
}

function safeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function installPageMonitor() {
  const runnerGlobal = globalThis as typeof globalThis & {
    __xpertChatKitRunnerMonitorInstalled?: boolean;
    __xpertChatKitAgentAction?: boolean;
    __xpertChatKitRunnerStateChanged?: (kind: 'manual' | 'structure') => void;
  };
  if (runnerGlobal.__xpertChatKitRunnerMonitorInstalled) return;
  runnerGlobal.__xpertChatKitRunnerMonitorInstalled = true;
  const notify = (kind: 'manual' | 'structure') => {
    if (kind === 'structure' || !runnerGlobal.__xpertChatKitAgentAction) {
      void runnerGlobal.__xpertChatKitRunnerStateChanged?.(kind);
    }
  };
  for (const eventName of ['pointerdown', 'keydown', 'input', 'change']) {
    addEventListener(
      eventName,
      (event) => {
        if (event.isTrusted) notify('manual');
      },
      true,
    );
  }
  const observedRoots = new WeakSet<Node>();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type !== 'childList') continue;
      for (const node of Array.from(record.addedNodes)) {
        if (!(node instanceof Element)) continue;
        if (node.shadowRoot) observeRoot(node.shadowRoot);
        for (const element of Array.from(node.querySelectorAll('*'))) {
          if (element.shadowRoot) observeRoot(element.shadowRoot);
        }
      }
    }
    const changed = records.some(
      (record) =>
        record.type === 'childList' ||
        (record.type === 'attributes' &&
          [
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
            'src',
          ].includes(record.attributeName ?? '')),
    );
    if (changed) notify('structure');
  });
  const observeRoot = (root: Document | ShadowRoot) => {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
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
        'src',
      ],
    });
    for (const element of Array.from(root.querySelectorAll('*'))) {
      if (element.shadowRoot) observeRoot(element.shadowRoot);
    }
  };
  observeRoot(document);
  const nativeAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function attachShadow(init) {
    const root = nativeAttachShadow.call(this, init);
    if (init.mode === 'open') observeRoot(root);
    return root;
  };
}

export async function launchPlaywrightBrowserSession(
  options: IsolatedBrowserLaunchOptions,
): Promise<IsolatedBrowserSession> {
  const executablePath =
    process.env.CHATKIT_BROWSER_RUNNER_EXECUTABLE_PATH?.trim();
  const channel =
    process.env.CHATKIT_BROWSER_RUNNER_CHANNEL?.trim() || 'chrome';
  const context = await chromium.launchPersistentContext(options.profileDir, {
    headless: options.headless,
    acceptDownloads: true,
    downloadsPath: options.downloadsDir,
    ...(executablePath ? { executablePath } : { channel }),
  });
  const page = context.pages()[0] ?? (await context.newPage());
  if (options.startUrl) {
    const url = new URL(options.startUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      await context.close();
      throw new Error('The isolated browser start URL must use HTTP(S).');
    }
    await page.goto(url.toString());
  }
  return PlaywrightBrowserSession.create(context, page);
}
