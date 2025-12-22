/**
 * Xpert Chatkit Web Component
 * A custom element that embeds the Chatkit iframe with session management
 */

interface ChatkitInitMessage {
  type: 'chatkit:init';
  clientSecret: string;
  styleConfig?: Record<string, unknown>;
}

interface SessionResponse {
  client_secret?: string;
  error?: string;
}

/**
 * Custom element for embedding Xpert Chatkit
 *
 * @element xpert-chatkit
 *
 * @attr {string} backend-url - Backend API URL for session creation
 * @attr {string} chatkit-url - Chatkit iframe URL
 * @attr {string} [assistant-id] - Optional assistant ID
 * @attr {string} [style-config] - Optional JSON string for style configuration
 *
 * @example
 * ```html
 * <xpert-chatkit
 *   backend-url="https://api.example.com"
 *   chatkit-url="https://chatkit.example.com"
 *   assistant-id="assistant_123"
 *   style-config='{"primaryColor": "#007bff"}'>
 * </xpert-chatkit>
 * ```
 */
class XpertChatkit extends HTMLElement {
  private iframe: HTMLIFrameElement | null = null;
  private clientSecret: string | null = null;
  private shadow: ShadowRoot;
  private loadingEl: HTMLDivElement | null = null;
  private errorEl: HTMLDivElement | null = null;
  private containerEl: HTMLDivElement | null = null;
  private mounted = false;
  private sessionCreated = false;

  // Observed attributes
  static get observedAttributes() {
    return ['backend-url', 'chatkit-url', 'assistant-id', 'style-config'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.render();
  }

  connectedCallback() {
    this.mounted = true;
    // Only create session if we haven't already
    if (!this.sessionCreated) {
      this.createSession();
    }
  }

  disconnectedCallback() {
    this.mounted = false;
    // Cleanup if needed
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;

    // Only recreate session if already mounted and session was created
    if (this.mounted && this.sessionCreated && (name === 'backend-url' || name === 'chatkit-url')) {
      this.sessionCreated = false;
      this.createSession();
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

      .loading,
      .error {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px;
        background: rgba(255, 255, 255, 0.95);
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 10;
      }

      .loading {
        color: #333;
        font-size: 14px;
      }

      .error {
        color: #dc3545;
        font-size: 14px;
        max-width: 300px;
      }

      .loading::before {
        content: '';
        display: inline-block;
        width: 16px;
        height: 16px;
        margin-right: 8px;
        border: 2px solid #007bff;
        border-radius: 50%;
        border-top-color: transparent;
        animation: spinner 0.6s linear infinite;
        vertical-align: middle;
      }

      @keyframes spinner {
        to { transform: rotate(360deg); }
      }

      .hidden {
        display: none;
      }
    `;

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'container';

    this.loadingEl = document.createElement('div');
    this.loadingEl.className = 'loading hidden';
    this.loadingEl.textContent = 'Creating session...';

    this.errorEl = document.createElement('div');
    this.errorEl.className = 'error hidden';

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.containerEl);
    this.shadow.appendChild(this.loadingEl);
    this.shadow.appendChild(this.errorEl);
  }

  /**
   * Creates the iframe element
   */
  private createIframe() {
    const chatkitUrl = this.getAttribute('chatkit-url');
    if (!chatkitUrl) {
      this.showError('Missing chatkit-url attribute');
      return;
    }

    if (this.iframe) {
      this.iframe.remove();
    }

    this.iframe = document.createElement('iframe');
    this.iframe.src = chatkitUrl;
    this.iframe.title = 'Xpert Chat';
    this.iframe.allow = 'clipboard-write';

    this.iframe.addEventListener('load', () => {
      this.sendInitMessage();
    });

    this.containerEl?.appendChild(this.iframe);
  }

  /**
   * Shows loading state
   */
  private showLoading() {
    this.loadingEl?.classList.remove('hidden');
    this.errorEl?.classList.add('hidden');
  }

  /**
   * Hides loading state
   */
  private hideLoading() {
    this.loadingEl?.classList.add('hidden');
  }

  /**
   * Shows error message
   */
  private showError(message: string) {
    console.error('[xpert-chatkit]', message);
    if (this.errorEl) {
      this.errorEl.textContent = message;
      this.errorEl.classList.remove('hidden');
    }
    this.hideLoading();
  }

  /**
   * Creates a chat session by calling the backend API
   */
  private async createSession() {
    const chatkitUrl = this.getAttribute('chatkit-url');
    if (!chatkitUrl) {
      this.showError('Missing chatkit-url attribute');
      return;
    }

    this.showLoading();

    try {
      // Use relative URL if backend-url is empty (will use proxy in dev)
      const backendUrl = this.getAttribute('backend-url') || '';
      const createSessionUrl = backendUrl
        ? `${backendUrl.replace(/\/$/, '')}/api/create-session`
        : '/api/create-session';

      const assistantId = this.getAttribute('assistant-id');

      const response = await fetch(createSessionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(assistantId ? { assistantId } : {}),
      });

      const payload = await response.json() as SessionResponse;

      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      const clientSecret = payload?.client_secret;
      if (!clientSecret) {
        throw new Error('Missing client_secret in response');
      }

      this.clientSecret = clientSecret;
      this.sessionCreated = true;
      this.hideLoading();

      // Create iframe after session is ready
      this.createIframe();

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create session';
      this.showError(message);
      this.sessionCreated = false;
    }
  }

  /**
   * Sends initialization message to iframe
   */
  private sendInitMessage() {
    if (!this.clientSecret || !this.iframe) {
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

    // Parse style config if provided (currently disabled)
    // let styleConfig: Record<string, unknown> | undefined;
    // const styleConfigAttr = this.getAttribute('style-config');
    // if (styleConfigAttr) {
    //   try {
    //     styleConfig = JSON.parse(styleConfigAttr);
    //   } catch (error) {
    //     console.warn('[xpert-chatkit] Invalid style-config JSON:', error);
    //   }
    // }

    const message: ChatkitInitMessage = {
      type: 'chatkit:init',
      clientSecret: this.clientSecret,
      // Temporarily disabled: ...(styleConfig && { styleConfig }),
    };

    // Send immediately
    targetWindow.postMessage(message, chatkitOrigin);

    // Retry after delays to handle race condition where iframe's React hasn't initialized yet
    setTimeout(() => targetWindow.postMessage(message, chatkitOrigin), 100);
    setTimeout(() => targetWindow.postMessage(message, chatkitOrigin), 500);
    setTimeout(() => targetWindow.postMessage(message, chatkitOrigin), 1000);
  }

  /**
   * Updates the style configuration and sends it to iframe
   * Note: Currently only works on first initialization
   */
  public updateStyleConfig(styleConfig: Record<string, unknown>) {
    this.setAttribute('style-config', JSON.stringify(styleConfig));
  }
}

// Register the custom element
if (!customElements.get('xpert-chatkit')) {
  customElements.define('xpert-chatkit', XpertChatkit);
}

// Export for potential programmatic use
export { XpertChatkit };
export default XpertChatkit;
