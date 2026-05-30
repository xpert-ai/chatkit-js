import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const packageRoot = resolve(new URL('..', import.meta.url).pathname);
const outPath = resolve(packageRoot, 'dist/manifest.xml');
const baseUrl = stripTrailingSlash(process.env.ADDIN_BASE_URL ?? 'https://localhost:3000');
const supportUrl = process.env.ADDIN_SUPPORT_URL ?? 'https://xpertai.cn';
const appDomain = new URL(baseUrl).origin;
const xpertApiUrl = process.env.XPERTAI_API_URL;
const xpertFrameUrl = process.env.XPERTAI_CHATKIT_FRAME_URL;
const appDomains = new Set([appDomain]);

for (const value of [xpertApiUrl, xpertFrameUrl]) {
  if (!value) continue;
  try {
    appDomains.add(new URL(value).origin);
  } catch {
    // Ignore non-URL environment placeholders.
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function xmlEscape(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const manifest = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
  xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
  xsi:type="TaskPaneApp">
  <Id>3a62e392-75c0-4f36-91f2-6a4f79f8e12d</Id>
  <Version>1.0.0.0</Version>
  <ProviderName>XpertAI</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="XpertAI PowerPoint Copilot"/>
  <Description DefaultValue="ChatKit-powered XpertAI Copilot for PowerPoint."/>
  <IconUrl DefaultValue="${xmlEscape(baseUrl)}/assets/icon-32.png"/>
  <HighResolutionIconUrl DefaultValue="${xmlEscape(baseUrl)}/assets/icon-80.png"/>
  <SupportUrl DefaultValue="${xmlEscape(supportUrl)}"/>
  <AppDomains>
${Array.from(appDomains)
  .map((domain) => `    <AppDomain>${xmlEscape(domain)}</AppDomain>`)
  .join('\n')}
  </AppDomains>
  <Hosts>
    <Host Name="Presentation"/>
  </Hosts>
  <Requirements>
    <Sets DefaultMinVersion="1.1">
      <Set Name="PowerPointApi" MinVersion="1.4"/>
      <Set Name="ImageCoercion" MinVersion="1.1"/>
    </Sets>
  </Requirements>
  <DefaultSettings>
    <SourceLocation DefaultValue="${xmlEscape(baseUrl)}/taskpane.html"/>
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Presentation">
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="GetStarted.Title"/>
            <Description resid="GetStarted.Description"/>
            <LearnMoreUrl resid="GetStarted.LearnMoreUrl"/>
          </GetStarted>
          <FunctionFile resid="Taskpane.Url"/>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <OfficeTab id="TabHome">
              <Group id="CommandsGroup">
                <Label resid="CommandsGroup.Label"/>
                <Icon>
                  <bt:Image size="16" resid="Icon.16x16"/>
                  <bt:Image size="32" resid="Icon.32x32"/>
                  <bt:Image size="80" resid="Icon.80x80"/>
                </Icon>
                <Control xsi:type="Button" id="TaskpaneButton">
                  <Label resid="TaskpaneButton.Label"/>
                  <Supertip>
                    <Title resid="TaskpaneButton.Label"/>
                    <Description resid="TaskpaneButton.Tooltip"/>
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="Icon.16x16"/>
                    <bt:Image size="32" resid="Icon.32x32"/>
                    <bt:Image size="80" resid="Icon.80x80"/>
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>ButtonId1</TaskpaneId>
                    <SourceLocation resid="Taskpane.Url"/>
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
      <bt:Images>
        <bt:Image id="Icon.16x16" DefaultValue="${xmlEscape(baseUrl)}/assets/icon-32.png"/>
        <bt:Image id="Icon.32x32" DefaultValue="${xmlEscape(baseUrl)}/assets/icon-32.png"/>
        <bt:Image id="Icon.80x80" DefaultValue="${xmlEscape(baseUrl)}/assets/icon-80.png"/>
      </bt:Images>
      <bt:Urls>
        <bt:Url id="GetStarted.LearnMoreUrl" DefaultValue="${xmlEscape(supportUrl)}"/>
        <bt:Url id="Taskpane.Url" DefaultValue="${xmlEscape(baseUrl)}/taskpane.html"/>
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="CommandsGroup.Label" DefaultValue="XpertAI"/>
        <bt:String id="GetStarted.Title" DefaultValue="XpertAI Copilot loaded"/>
        <bt:String id="TaskpaneButton.Label" DefaultValue="XpertAI Copilot"/>
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="GetStarted.Description" DefaultValue="Open the task pane to chat with XpertAI and edit the presentation."/>
        <bt:String id="TaskpaneButton.Tooltip" DefaultValue="Open XpertAI PowerPoint Copilot."/>
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, manifest);
console.log(`Generated ${outPath}`);
