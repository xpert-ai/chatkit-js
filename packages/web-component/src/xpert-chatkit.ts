/**
 * Xpert Chatkit Web Component
 * A custom element that embeds the Chatkit iframe with postMessage communication
 *
 * Options are passed via URL parameter (base64 encoded), clientSecret via postMessage
 */

interface ChatkitInitMessage {
  type: 'chatkit:init';
  clientSecret: string;
}

/**
 * Custom element for embedding Xpert Chatkit
 *
 * @element xpert-chatkit
 *
 * @attr {string} chatkit-url - Chatkit iframe URL (may include ?options=base64 parameter)
 * @attr {string} [client-secret] - Client secret for authentication (sent via postMessage)
 *
 * @example
 * ```html
 * <xpert-chatkit
 *   chatkit-url="https://chatkit.example.com?options=eyJ0aGVtZSI6eyJjb2xvclNjaGVtZSI6ImRhcmsifX0="
 *   client-secret="cs_xxx">
 * </xpert-chatkit>
 * ```
 */
class XpertChatkit extends HTMLElement {
  private iframe: HTMLIFrameElement | null = null;
  private shadow: ShadowRoot;
  private containerEl: HTMLDivElement | null = null;
  private mounted = false;
  private iframeLoaded = false;

  // Observed attributes
  static get observedAttributes() {
    return ['chatkit-url', 'client-secret'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.render();
  }

  connectedCallback() {
    this.mounted = true;
    this.createIframe();
  }

  disconnectedCallback() {
    this.mounted = false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;

    if (name === 'chatkit-url' && this.mounted) {
      this.createIframe();
    } else if (name === 'client-secret' && this.mounted && this.iframeLoaded) {
      this.sendInitMessage();
    }
  }

  /**
   * Renders the component structure
   */
  private render() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
      }

      .container {
        width: 100%;
        height: 100%;
        position: relative;
      }

      iframe {
        width: 100%;
        height: 100%;
        border: none;
      }
    `;

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'container';

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.containerEl);
  }

  /**
   * Creates the iframe element
   */
  private createIframe() {
    const chatkitUrl = this.getAttribute('chatkit-url');
    if (!chatkitUrl) {
      console.warn('[xpert-chatkit] Missing chatkit-url attribute');
      return;
    }

    if (this.iframe) {
      this.iframe.remove();
    }

    this.iframeLoaded = false;
    this.iframe = document.createElement('iframe');
    this.iframe.src = chatkitUrl;
    this.iframe.title = 'Xpert Chat';
    this.iframe.allow = 'clipboard-write';

    this.iframe.addEventListener('load', () => {
      this.iframeLoaded = true;
      this.sendInitMessage();
    });

    this.containerEl?.appendChild(this.iframe);
  }

  /**
   * Sends initialization message (clientSecret) to iframe via postMessage
   */
  private sendInitMessage() {
    const clientSecret = this.getAttribute('client-secret');
    if (!clientSecret || !this.iframe) {
      return;
    }

    const targetWindow = this.iframe.contentWindow;
    if (!targetWindow) {
      console.warn('[xpert-chatkit] iframe contentWindow not available');
      return;
    }

    const chatkitUrl = this.getAttribute('chatkit-url');
    if (!chatkitUrl) return;

    let chatkitOrigin: string;
    try {
      chatkitOrigin = new URL(chatkitUrl, window.location.origin).origin;
    } catch {
      chatkitOrigin = '*';
    }

    const message: ChatkitInitMessage = {
      type: 'chatkit:init',
      clientSecret,
    };

    // Send immediately
    targetWindow.postMessage(message, chatkitOrigin);

    // Retry after delays to handle race condition where iframe's React hasn't initialized yet
    setTimeout(() => targetWindow.postMessage(message, chatkitOrigin), 100);
    setTimeout(() => targetWindow.postMessage(message, chatkitOrigin), 500);
    setTimeout(() => targetWindow.postMessage(message, chatkitOrigin), 1000);
  }

  /**
   * Programmatically set the client secret
   */
  public setClientSecret(secret: string) {
    this.setAttribute('client-secret', secret);
  }
}

// Register the custom element
if (!customElements.get('xpert-chatkit')) {
  customElements.define('xpert-chatkit', XpertChatkit);
}

// Export for potential programmatic use
export { XpertChatkit };
export default XpertChatkit;

export { registerChatKitElement } from './ChatKitElement'