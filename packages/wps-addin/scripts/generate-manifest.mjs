import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const packageRoot = resolve(new URL('..', import.meta.url).pathname);
const distRoot = resolve(packageRoot, 'dist');
const manifestPath = resolve(distRoot, 'manifest.xml');
const publishPath = resolve(distRoot, 'publish.xml');
const ribbonPath = resolve(distRoot, 'ribbon.xml');

function xmlEscape(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

const pluginName = process.env.WPS_ADDIN_NAME ?? 'XpertAIWpsCopilot';
const pluginDescription =
  process.env.WPS_ADDIN_DESCRIPTION ??
  'ChatKit-powered XpertAI Copilot for WPS Writer.';
const addinUrl = stripTrailingSlash(
  process.env.WPS_ADDIN_URL ?? process.env.ADDIN_BASE_URL ?? 'http://localhost:3003',
);

const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<JsPlugin>
  <ApiVersion>1.0.0</ApiVersion>
  <Name>${xmlEscape(pluginName)}</Name>
  <Description>${xmlEscape(pluginDescription)}</Description>
</JsPlugin>
`;

const ribbon = `<?xml version="1.0" encoding="UTF-8"?>
<customUI xmlns="http://schemas.microsoft.com/office/2006/01/customui" onLoad="ribbon.OnAddinLoad">
  <ribbon startFromScratch="false">
    <tabs>
      <tab id="xpertAiTab" label="XpertAI">
        <group id="xpertAiChatKitGroup" label="ChatKit">
          <button
            id="btnOpenChatKit"
            label="XpertAI Copilot"
            onAction="ribbon.OnAction"
            getEnabled="ribbon.OnGetEnabled"
            getImage="ribbon.GetImage"
            getVisible="ribbon.OnGetVisible"
            size="large"/>
        </group>
      </tab>
    </tabs>
  </ribbon>
</customUI>
`;

const publish = `<?xml version="1.0" encoding="UTF-8"?>
<jsplugins>
  <jspluginonline
      name="${xmlEscape(pluginName)}"
      url="${xmlEscape(addinUrl)}"
      type="wps"
      install="true"/>
</jsplugins>
`;

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, manifest);
writeFileSync(publishPath, publish);
writeFileSync(ribbonPath, ribbon);
console.log(`Generated ${manifestPath}`);
console.log(`Generated ${publishPath}`);
console.log(`Generated ${ribbonPath}`);
