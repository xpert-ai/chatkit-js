import '@testing-library/jest-dom/vitest';
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
