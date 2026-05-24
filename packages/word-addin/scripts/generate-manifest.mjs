import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const packageRoot = resolve(new URL('..', import.meta.url).pathname);
const outPath = resolve(packageRoot, 'dist/manifest.xml');
const baseUrl = stripTrailingSlash(process.env.ADDIN_BASE_URL ?? 'https://localhost:3001');
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
  <Id>71ab6e52-02ce-4595-8df6-8848b54b7281</Id>
  <Version>1.0.0.0</Version>
  <ProviderName>XpertAI</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="XpertAI Word Copilot"/>
  <Description DefaultValue="ChatKit-powered XpertAI Copilot for Word."/>
  <IconUrl DefaultValue="${xmlEscape(baseUrl)}/assets/icon-32.png"/>
  <HighResolutionIconUrl DefaultValue="${xmlEscape(baseUrl)}/assets/icon-80.png"/>
  <SupportUrl DefaultValue="${xmlEscape(supportUrl)}"/>
  <AppDomains>
${Array.from(appDomains)
  .map((domain) => `    <AppDomain>${xmlEscape(domain)}</AppDomain>`)
  .join('\n')}
  </AppDomains>
  <Hosts>
    <Host Name="Document"/>
  </Hosts>
  <Requirements>
    <Sets DefaultMinVersion="1.1">
      <Set Name="WordApi" MinVersion="1.3"/>
    </Sets>
  </Requirements>
  <DefaultSettings>
    <SourceLocation DefaultValue="${xmlEscape(baseUrl)}/taskpane.html"/>
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Document">
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
        <bt:String id="GetStarted.Description" DefaultValue="Open the task pane to chat with XpertAI and edit the document."/>
        <bt:String id="TaskpaneButton.Tooltip" DefaultValue="Open XpertAI Word Copilot."/>
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, manifest);
console.log(`Generated ${outPath}`);
