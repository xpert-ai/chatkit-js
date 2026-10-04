import { PREVIEW_CHANNEL, type PreviewEvent } from './protocol';

// Serialized into an opaque-origin document. Keep dependencies inside this function.
function installPreviewRuntime(channel: string, session: string) {
  const send = (event: PreviewEvent) =>
    parent.postMessage({ channel, session, event }, '*');
  let inspecting = false;
  let selected: Element | null = null;
  let hovered: Element | null = null;
  let overlay: HTMLDivElement | null = null;
  let queued = false;
  const omitted =
    'script,style,template,noscript,input,textarea,select,[contenteditable]';
  const styles = [
    'display',
    'position',
    'width',
    'height',
    'color',
    'background-color',
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'padding',
    'margin',
    'border',
    'border-radius',
    'gap',
    'align-items',
    'justify-content',
  ];
  const shorten = (text: string, limit: number) =>
    text.replace(/\s+/g, ' ').trim().slice(0, limit);
  const selector = (element: Element) => {
    const parts: string[] = [];
    for (
      let node: Element | null = element;
      node && parts.length < 12;
      node = node.parentElement
    ) {
      if (node.id && node.id.length < 160) {
        const id = `#${CSS.escape(node.id)}`;
        if (document.querySelectorAll(id).length === 1) {
          parts.unshift(id);
          break;
        }
      }
      const siblings = node.parentElement
        ? Array.from(node.parentElement.children).filter(
            (child) => child.tagName === node!.tagName,
          )
        : [node];
      parts.unshift(
        `${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`,
      );
    }
    return parts.join(' > ').slice(0, 2400);
  };
  const snapshot = (element: Element) => {
    // Do not send form contents, scripts, URL query strings, or hidden descendants to chat.
    const copy = element.cloneNode(true) as Element;
    copy
      .querySelectorAll(`${omitted},[hidden],[aria-hidden="true"]`)
      .forEach((child) => child.remove());
    if (element.matches(omitted)) copy.replaceChildren();
    for (const node of [copy, ...Array.from(copy.querySelectorAll('*'))]) {
      for (const attribute of Array.from(node.attributes)) {
        if (
          !['id', 'class', 'role', 'aria-label', 'alt'].includes(attribute.name)
        )
          node.removeAttribute(attribute.name);
        else node.setAttribute(attribute.name, attribute.value.slice(0, 160));
      }
    }
    const computed = getComputedStyle(element);
    return {
      selector: selector(element),
      tag: element.tagName.toLowerCase(),
      text: shorten(copy.textContent ?? '', 1600),
      html: copy.outerHTML.slice(0, 4000),
      styles: styles.map((name) => ({
        name,
        value: computed.getPropertyValue(name).slice(0, 2400),
      })),
    };
  };
  const paint = () => {
    queued = false;
    const target = hovered ?? selected;
    if (!inspecting || !target?.isConnected) {
      overlay?.remove();
      overlay = null;
      return;
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.setAttribute('data-chatkit-inspector', '');
      overlay.style.cssText =
        'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:#3b82f61a;box-sizing:border-box;border-radius:3px;';
      document.documentElement.append(overlay);
    }
    const rect = target.getBoundingClientRect();
    Object.assign(overlay.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  };
  const schedule = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(paint);
    }
  };
  const choose = (element: Element) => {
    selected = element;
    hovered = null;
    send({ type: 'selected', element: snapshot(element) });
    schedule();
  };
  addEventListener(
    'pointermove',
    (event) => {
      if (!inspecting || !(event.target instanceof Element)) return;
      hovered = event.target;
      schedule();
    },
    true,
  );
  // Capture before authored scripts so selecting a button does not also activate it.
  for (const type of [
    'pointerdown',
    'pointerup',
    'mousedown',
    'mouseup',
    'click',
    'dblclick',
    'contextmenu',
  ]) {
    addEventListener(
      type,
      (event) => {
        if (!inspecting) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (type === 'click' && event.target instanceof Element)
          choose(event.target);
      },
      true,
    );
  }
  addEventListener(
    'keydown',
    (event) => {
      if (!inspecting) return;
      if (event.key === 'Escape') {
        inspecting = false;
        schedule();
        send({ type: 'escape' });
      }
      // Keep keyboard interactions from altering the page while selecting an element.
      if (event.key !== 'Tab') {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  addEventListener('scroll', schedule, true);
  addEventListener('resize', schedule);
  const observer = new MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          record.target !== overlay &&
          !(
            record.type === 'childList' &&
            [...record.addedNodes, ...record.removedNodes].every(
              (node) =>
                node instanceof Element &&
                node.hasAttribute('data-chatkit-inspector'),
            )
          ),
      )
    )
      schedule();
  });
  addEventListener(
    'DOMContentLoaded',
    () =>
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
      }),
    { once: true },
  );
  addEventListener('message', (event: MessageEvent<unknown>) => {
    if (event.source !== parent) return;
    const value = event.data;
    if (
      !value ||
      typeof value !== 'object' ||
      !('channel' in value) ||
      value.channel !== channel ||
      !('session' in value) ||
      value.session !== session ||
      !('command' in value)
    )
      return;
    const command = value.command;
    if (!command || typeof command !== 'object' || !('type' in command)) return;
    if (command.type === 'connect') send({ type: 'ready' });
    else if (
      command.type === 'inspect' &&
      'active' in command &&
      typeof command.active === 'boolean'
    ) {
      inspecting = command.active;
      hovered = null;
      schedule();
    } else if (command.type === 'parent' && selected?.parentElement)
      choose(selected.parentElement);
    else if (command.type === 'clear') {
      selected = null;
      hovered = null;
      schedule();
    }
  });
  const describe = (value: unknown): string => {
    if (typeof value === 'string') return value.slice(0, 4000);
    if (value instanceof Error)
      return `${value.name}: ${value.message}\n${value.stack ?? ''}`.slice(
        0,
        4000,
      );
    try {
      return (JSON.stringify(value) ?? String(value)).slice(0, 4000);
    } catch {
      return '[Unserializable value]';
    }
  };
  // Bound the bridge as well as the host log buffer when a page is noisy.
  let count = 0;
  const log = (
    level: 'log' | 'info' | 'warn' | 'error' | 'debug',
    text: string,
  ) => {
    if (++count <= 200)
      send({ type: 'console', level, text: text.slice(0, 4000) });
  };
  setInterval(() => {
    count = 0;
  }, 1000);
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      log(level, args.map(describe).join(' '));
    };
  }
  addEventListener('error', (event) =>
    log(
      'error',
      `${event.message} (${event.filename}:${event.lineno}:${event.colno})`,
    ),
  );
  addEventListener('unhandledrejection', (event) =>
    log('error', describe(event.reason)),
  );
  addEventListener('securitypolicyviolation', (event) =>
    log('warn', `Blocked ${event.violatedDirective}: ${event.blockedURI}`),
  );
  // Opaque-origin previews have no persistent storage. Supply frame-local storage
  // so standalone games still run without granting access to ChatKit's origin.
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      void window[name].length;
    } catch {
      const values = new Map<string, string>();
      Object.defineProperty(window, name, {
        value: {
          get length() {
            return values.size;
          },
          getItem: (key: string) => values.get(String(key)) ?? null,
          setItem: (key: string, value: string) => {
            values.set(String(key), String(value));
          },
          removeItem: (key: string) => {
            values.delete(String(key));
          },
          clear: () => values.clear(),
          key: (index: number) => [...values.keys()][index] ?? null,
        },
      });
    }
  }
  send({ type: 'ready' });
}

export function previewRuntimeScript(session: string) {
  return `(${installPreviewRuntime.toString()})(${JSON.stringify(PREVIEW_CHANNEL)},${JSON.stringify(session)});`;
}
