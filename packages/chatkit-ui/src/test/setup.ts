import '@testing-library/jest-dom/vitest';

// jsdom has no media-query engine. Tests for responsive behavior override matches.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) =>
      Object.assign(new EventTarget(), {
        media: query,
        matches: false,
        onchange: null,
        addListener(this: MediaQueryList, listener: EventListener) {
          this.addEventListener('change', listener);
        },
        removeListener(this: MediaQueryList, listener: EventListener) {
          this.removeEventListener('change', listener);
        },
      }),
  });
}

// jsdom has no layout or scrolling. Radix Select calls this while moving focus;
// actual scrolling and menu positioning are verified in the browser.
if (
  typeof Element !== 'undefined' &&
  typeof Element.prototype.scrollIntoView !== 'function'
) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value() {},
  });
}

// Node 24's Response.blob() uses jsdom's Blob, which lacks arrayBuffer().
// Keep jsdom's Blob/File constructors so FileReader continues to accept them.
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Object.defineProperty(Blob.prototype, 'arrayBuffer', {
    configurable: true,
    writable: true,
    value(this: Blob): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) resolve(reader.result);
          else
            reject(new TypeError('Expected an ArrayBuffer from FileReader.'));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    },
  });
}

// jsdom does not implement Blob.text(); preserve Blob/File identity and UTF-8 bytes.
if (typeof Blob.prototype.text !== 'function') {
  Object.defineProperty(Blob.prototype, 'text', {
    configurable: true,
    writable: true,
    async value(this: Blob): Promise<string> {
      return new TextDecoder().decode(await this.arrayBuffer());
    },
  });
}
