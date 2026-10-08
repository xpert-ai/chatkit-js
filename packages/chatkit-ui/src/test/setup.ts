import '@testing-library/jest-dom/vitest';

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
