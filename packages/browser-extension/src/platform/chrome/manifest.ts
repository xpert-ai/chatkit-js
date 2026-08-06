export type ChromeManifest = {
  manifest_version: 3;
  name: string;
  description: string;
  version: string;
  action: {
    default_title: string;
    default_popup: string;
  };
  background: {
    service_worker: string;
    type: 'module';
  };
  options_ui: {
    page: string;
    open_in_tab: boolean;
  };
  side_panel: {
    default_path: string;
  };
  permissions: string[];
  host_permissions: string[];
  web_accessible_resources: Array<{
    resources: string[];
    matches: string[];
  }>;
  content_security_policy: {
    extension_pages: string;
  };
};

const PAGE_OVERLAY_HOST_PERMISSIONS = [
  'http://*/*',
  'https://*/*',
  'http://localhost/*',
  'http://127.0.0.1/*',
];

const EMBEDDABLE_FRAME_SOURCES = ["'self'", 'http://*:*', 'https://*:*'];

export function createChromeManifest(version = '0.3.0'): ChromeManifest {
  const embeddableFrameSources = EMBEDDABLE_FRAME_SOURCES.join(' ');

  return {
    manifest_version: 3,
    name: 'Xpert ChatKit',
    description: 'Open Xpert ChatKit from a Chrome side panel or page overlay.',
    version,
    action: {
      default_title: 'Xpert ChatKit',
      default_popup: 'popup.html',
    },
    background: {
      service_worker: 'service-worker.js',
      type: 'module',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    permissions: [
      'storage',
      'sidePanel',
      'scripting',
      'activeTab',
      'debugger',
      'nativeMessaging',
    ],
    host_permissions: PAGE_OVERLAY_HOST_PERMISSIONS,
    web_accessible_resources: [
      {
        resources: ['overlay.html', 'content-script.js', 'assets/*'],
        matches: ['<all_urls>'],
      },
    ],
    content_security_policy: {
      extension_pages: `script-src 'self'; object-src 'self'; frame-src ${embeddableFrameSources}; child-src ${embeddableFrameSources}; img-src 'self' data: blob: http://*:* https://*:*;`,
    },
  };
}
