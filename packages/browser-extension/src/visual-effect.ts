type VisualEffectArgs = {
  type?: unknown;
  action?: unknown;
  key?: unknown;
  value?: unknown;
  values?: unknown;
  state?: unknown;
  point?: {
    x?: unknown;
    y?: unknown;
  };
  anchor?: unknown;
  rect?: {
    x?: unknown;
    y?: unknown;
    width?: unknown;
    height?: unknown;
  };
  target?: unknown;
  deltaX?: unknown;
  deltaY?: unknown;
};

type VisualEffectType =
  | 'click'
  | 'fill'
  | 'select'
  | 'press'
  | 'scroll'
  | 'hover'
  | 'focus'
  | 'pointer'
  | 'wait_for'
  | 'screenshot';

export async function showHostAutomationEffect(
  rawArgs: unknown,
): Promise<void> {
  const preActionDelayMs = 250;
  const totalDurationMs = 1_400;
  const fadeOutDelayMs = 900;
  const wait = (durationMs: number) =>
    new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, durationMs);
    });
  const args =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as VisualEffectArgs)
      : {};
  const root = document.body ?? document.documentElement;
  if (!root) {
    return;
  }

  const getFiniteNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const isElement = (value: unknown): value is Element =>
    typeof Element === 'function' && value instanceof Element;
  const getFrameOffset = (doc: Document) => {
    let x = 0;
    let y = 0;
    let view = doc.defaultView;
    while (view?.frameElement) {
      const frameRect = view.frameElement.getBoundingClientRect();
      x += frameRect.left;
      y += frameRect.top;
      view = view.frameElement.ownerDocument.defaultView;
    }
    return { x, y };
  };
  const getGlobalRect = (element: Element) => {
    const rect = element.getBoundingClientRect();
    const offset = getFrameOffset(element.ownerDocument);
    return {
      x: rect.left + offset.x,
      y: rect.top + offset.y,
      width: rect.width,
      height: rect.height,
    };
  };
  const getStoredTarget = () => {
    const store = (
      globalThis as typeof globalThis & {
        __xpertaiChatKitHostAutomation?: {
          lastResolved?: Element;
        };
      }
    ).__xpertaiChatKitHostAutomation;
    return isElement(store?.lastResolved) ? store.lastResolved : undefined;
  };
  const normalizeType = (value: unknown): VisualEffectType =>
    value === 'fill' ||
    value === 'select' ||
    value === 'press' ||
    value === 'scroll' ||
    value === 'hover' ||
    value === 'focus' ||
    value === 'pointer' ||
    value === 'wait_for' ||
    value === 'screenshot'
      ? value
      : 'click';
  const rawPoint = args.point;
  const rawRect = args.rect;
  const explicitPoint =
    getFiniteNumber(rawPoint?.x) !== undefined &&
    getFiniteNumber(rawPoint?.y) !== undefined
      ? {
          x: getFiniteNumber(rawPoint?.x) ?? 0,
          y: getFiniteNumber(rawPoint?.y) ?? 0,
        }
      : undefined;
  const explicitRect =
    rawRect &&
    typeof rawRect === 'object' &&
    !Array.isArray(rawRect) &&
    getFiniteNumber(rawRect.x) !== undefined &&
    getFiniteNumber(rawRect.y) !== undefined &&
    getFiniteNumber(rawRect.width) !== undefined &&
    getFiniteNumber(rawRect.height) !== undefined
      ? {
          x: getFiniteNumber(rawRect.x) ?? 0,
          y: getFiniteNumber(rawRect.y) ?? 0,
          width: getFiniteNumber(rawRect.width) ?? 0,
          height: getFiniteNumber(rawRect.height) ?? 0,
        }
      : undefined;
  const type = normalizeType(args.type);
  const target = isElement(args.target) ? args.target : getStoredTarget();
  const shouldTrackTarget = Boolean(
    target &&
      (args.anchor === 'target' ||
        (args.anchor !== 'point' && !explicitPoint && !explicitRect)),
  );
  const raf =
    typeof globalThis.requestAnimationFrame === 'function'
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : (callback: FrameRequestCallback) =>
          globalThis.setTimeout(() => callback(Date.now()), 0);
  const removeLater = (element: Element) => {
    globalThis.setTimeout(() => {
      element.remove();
    }, totalDurationMs);
  };
  const getPlacement = () => {
    const targetRect = target ? getGlobalRect(target) : undefined;
    const rect = shouldTrackTarget
      ? targetRect
      : (explicitRect ?? targetRect);
    const point =
      shouldTrackTarget && rect
        ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        : (explicitPoint ??
          (rect
            ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
            : { x: innerWidth / 2, y: innerHeight / 2 }));
    return { point, rect };
  };
  const initialPlacement = getPlacement();
  const placementUpdaters: Array<
    (placement: ReturnType<typeof getPlacement>) => void
  > = [];
  const trackPlacement = (
    update: (placement: ReturnType<typeof getPlacement>) => void,
  ) => {
    update(initialPlacement);
    if (shouldTrackTarget) {
      placementUpdaters.push(update);
    }
  };
  const startPlacementTracking = () => {
    if (!shouldTrackTarget || placementUpdaters.length === 0) {
      return;
    }
    const startedAt = Date.now();
    const tick = () => {
      const placement = getPlacement();
      for (const update of placementUpdaters) {
        update(placement);
      }
      if (Date.now() - startedAt < totalDurationMs) {
        raf(tick);
      }
    };
    raf(tick);
  };

  const createBadge = (label: string) => {
    const badge = document.createElement('div');
    badge.setAttribute('data-xpertai-chatkit-visual-effect', type);
    badge.textContent = label;
    badge.style.position = 'fixed';
    badge.style.maxWidth = '220px';
    badge.style.padding = '6px 10px';
    badge.style.borderRadius = '9999px';
    badge.style.background = 'rgba(15, 23, 42, 0.92)';
    badge.style.color = '#fff';
    badge.style.font =
      '600 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    badge.style.letterSpacing = '0';
    badge.style.whiteSpace = 'nowrap';
    badge.style.overflow = 'hidden';
    badge.style.textOverflow = 'ellipsis';
    badge.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.25)';
    badge.style.pointerEvents = 'none';
    badge.style.transform = 'translate(-50%, calc(-100% - 12px)) scale(0.96)';
    badge.style.opacity = '0';
    badge.style.transition =
      'transform 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 500ms ease-out';
    badge.style.zIndex = '2147483646';
    trackPlacement(({ point }) => {
      badge.style.left = `${point.x}px`;
      badge.style.top = `${point.y}px`;
    });
    root.append(badge);
    raf(() => {
      badge.style.opacity = '0.96';
      badge.style.transform = 'translate(-50%, calc(-100% - 18px)) scale(1)';
    });
    globalThis.setTimeout(() => {
      badge.style.opacity = '0';
      badge.style.transform =
        'translate(-50%, calc(-100% - 24px)) scale(0.98)';
    }, fadeOutDelayMs);
    removeLater(badge);
    return badge;
  };

  const createPointMarker = (variant: 'click' | 'move' | 'down' | 'up') => {
    const marker = document.createElement('div');
    marker.setAttribute('data-xpertai-chatkit-visual-effect', type);
    marker.style.position = 'fixed';
    marker.style.width = variant === 'move' ? '18px' : '36px';
    marker.style.height = variant === 'move' ? '18px' : '36px';
    marker.style.margin = '0';
    marker.style.padding = '0';
    marker.style.border = '2px solid rgba(37, 99, 235, 0.95)';
    marker.style.borderRadius = '9999px';
    marker.style.background =
      variant === 'down' ? 'rgba(37, 99, 235, 0.28)' : 'rgba(37, 99, 235, 0.14)';
    marker.style.boxShadow =
      '0 0 0 1px rgba(255, 255, 255, 0.85), 0 8px 24px rgba(37, 99, 235, 0.35)';
    marker.style.boxSizing = 'border-box';
    marker.style.opacity = '0.95';
    marker.style.pointerEvents = 'none';
    marker.style.transform = 'translate(-50%, -50%) scale(0.7)';
    marker.style.transition =
      'transform 520ms cubic-bezier(0.16, 1, 0.3, 1), opacity 520ms ease-out';
    marker.style.zIndex = '2147483646';
    trackPlacement(({ point }) => {
      marker.style.left = `${point.x}px`;
      marker.style.top = `${point.y}px`;
    });

    const dot = document.createElement('div');
    dot.style.position = 'absolute';
    dot.style.left = '50%';
    dot.style.top = '50%';
    dot.style.width = '6px';
    dot.style.height = '6px';
    dot.style.borderRadius = '9999px';
    dot.style.background = 'rgba(37, 99, 235, 1)';
    dot.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.9)';
    dot.style.transform = 'translate(-50%, -50%)';
    marker.append(dot);
    root.append(marker);

    raf(() => {
      marker.style.transform =
        variant === 'down'
          ? 'translate(-50%, -50%) scale(0.55)'
          : 'translate(-50%, -50%) scale(1.15)';
      globalThis.setTimeout(() => {
        marker.style.opacity = '0';
        marker.style.transform =
          variant === 'down'
            ? 'translate(-50%, -50%) scale(0.75)'
            : 'translate(-50%, -50%) scale(1.75)';
      }, fadeOutDelayMs);
    });
    removeLater(marker);
    return marker;
  };

  const createTargetRing = () => {
    const rect = initialPlacement.rect;
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return undefined;
    }
    const ring = document.createElement('div');
    ring.setAttribute('data-xpertai-chatkit-visual-effect', type);
    ring.style.position = 'fixed';
    ring.style.border = '2px solid rgba(37, 99, 235, 0.95)';
    ring.style.borderRadius = '8px';
    ring.style.boxShadow =
      '0 0 0 3px rgba(37, 99, 235, 0.18), 0 12px 30px rgba(37, 99, 235, 0.18)';
    ring.style.boxSizing = 'border-box';
    ring.style.opacity = '0';
    ring.style.pointerEvents = 'none';
    ring.style.transform = 'scale(0.98)';
    ring.style.transformOrigin = 'center';
    ring.style.transition =
      'transform 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 500ms ease-out';
    ring.style.zIndex = '2147483646';
    trackPlacement(({ rect }) => {
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        ring.style.display = 'none';
        return;
      }
      ring.style.display = '';
      ring.style.left = `${rect.x}px`;
      ring.style.top = `${rect.y}px`;
      ring.style.width = `${rect.width}px`;
      ring.style.height = `${rect.height}px`;
    });
    root.append(ring);
    raf(() => {
      ring.style.opacity = '1';
      ring.style.transform = 'scale(1)';
    });
    globalThis.setTimeout(() => {
      ring.style.opacity = '0';
      ring.style.transform = 'scale(1.02)';
    }, fadeOutDelayMs);
    removeLater(ring);
    return ring;
  };

  const createPulsingTargetRing = () => {
    const ring = createTargetRing();
    if (!ring) {
      return undefined;
    }
    ring.style.animation =
      'xpertai-chatkit-wait-for-pulse 900ms ease-in-out infinite alternate';
    const styleId = 'xpertai-chatkit-visual-effect-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent =
        '@keyframes xpertai-chatkit-wait-for-pulse { from { box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14), 0 12px 30px rgba(37, 99, 235, 0.12); } to { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.24), 0 16px 36px rgba(37, 99, 235, 0.2); } }';
      root.append(style);
    }
    return ring;
  };

  const createScreenFlash = () => {
    const flash = document.createElement('div');
    flash.setAttribute('data-xpertai-chatkit-visual-effect', type);
    flash.style.position = 'fixed';
    flash.style.inset = '0';
    flash.style.background = 'rgba(255, 255, 255, 0.72)';
    flash.style.opacity = '0';
    flash.style.pointerEvents = 'none';
    flash.style.transition = 'opacity 700ms ease-out';
    flash.style.zIndex = '2147483646';
    root.append(flash);
    raf(() => {
      flash.style.opacity = '0.55';
      globalThis.setTimeout(() => {
        flash.style.opacity = '0';
      }, 160);
    });
    removeLater(flash);
    return flash;
  };

  const truncate = (value: unknown) => {
    const text = typeof value === 'string' ? value : String(value ?? '');
    return text.length > 24 ? `${text.slice(0, 24)}...` : text;
  };
  const getScrollLabel = () => {
    const deltaX = getFiniteNumber(args.deltaX) ?? 0;
    const deltaY = getFiniteNumber(args.deltaY) ?? 0;
    if (Math.abs(deltaY) >= Math.abs(deltaX) && deltaY > 0) return 'Scroll down';
    if (Math.abs(deltaY) >= Math.abs(deltaX) && deltaY < 0) return 'Scroll up';
    if (deltaX > 0) return 'Scroll right';
    if (deltaX < 0) return 'Scroll left';
    return 'Scroll';
  };
  const getWaitForLabel = () => {
    const state =
      args.state === 'attached' ||
      args.state === 'visible' ||
      args.state === 'hidden' ||
      args.state === 'detached'
        ? args.state
        : 'visible';
    return `Waiting for ${state}`;
  };

  if (type === 'click') {
    createPointMarker('click');
  } else if (type === 'pointer') {
    const action =
      args.action === 'down' || args.action === 'up' || args.action === 'move'
        ? args.action
        : 'move';
    createPointMarker(action);
  } else if (type === 'press') {
    createTargetRing();
    createBadge(`Key ${truncate(args.key)}`);
  } else if (type === 'scroll') {
    createBadge(getScrollLabel());
  } else if (type === 'fill') {
    createTargetRing();
    createBadge('Fill');
  } else if (type === 'select') {
    createTargetRing();
    const values = Array.isArray(args.values)
      ? args.values.map(truncate).join(', ')
      : truncate(args.value);
    createBadge(values ? `Select ${values}` : 'Select');
  } else if (type === 'hover') {
    createTargetRing();
    createBadge('Hover');
  } else if (type === 'focus') {
    createTargetRing();
    createBadge('Focus');
  } else if (type === 'wait_for') {
    createPulsingTargetRing();
    createBadge(getWaitForLabel());
  } else if (type === 'screenshot') {
    createScreenFlash();
  }

  startPlacementTracking();
  await wait(preActionDelayMs);
}

export async function showHostClickEffect(rawArgs: unknown): Promise<void> {
  await showHostAutomationEffect({
    ...(typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {}),
    type: 'click',
  });
}
