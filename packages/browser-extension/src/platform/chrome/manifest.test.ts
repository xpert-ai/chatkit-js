import { describe, expect, it } from 'vitest';

import { createChromeManifest } from './manifest';

describe('chrome manifest', () => {
  it('declares the MV3 surfaces and permissions', () => {
    const manifest = createChromeManifest('1.2.3');

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.permissions).toEqual([
      'storage',
      'sidePanel',
      'scripting',
      'activeTab',
      'debugger',
    ]);
    expect(manifest.host_permissions).toEqual([
      'http://*/*',
      'https://*/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ]);
    expect(manifest.side_panel.default_path).toBe('sidepanel.html');
    expect(manifest.options_ui.page).toBe('options.html');
    expect(manifest.web_accessible_resources[0].resources).toContain(
      'overlay.html',
    );
    expect(manifest.web_accessible_resources[0].resources).toContain(
      'content-script.js',
    );
  });

  it('allows extension pages to embed configured ChatKit frame URLs', () => {
    const manifest = createChromeManifest();

    expect(manifest.content_security_policy.extension_pages).toContain(
      'frame-src',
    );
    expect(manifest.content_security_policy.extension_pages).toContain(
      'http://*:*',
    );
    expect(manifest.content_security_policy.extension_pages).toContain(
      'https://*:*',
    );
    expect(manifest.content_security_policy.extension_pages).toContain(
      'child-src',
    );
  });
});
