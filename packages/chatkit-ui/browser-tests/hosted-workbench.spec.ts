import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'http://localhost';
const key = 'bid.view-provider__bid.studio';
const manifest = {
  key,
  title: 'Bid Studio',
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  source: { provider: 'bid' },
  workbench: { openMode: 'auto' },
  clientCommands: [{ key: 'workbench.navigation.open' }],
  dataSource: { mode: 'platform' },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'bid' },
    dataSource: { mode: 'platform' },
  },
};

// Exercise the production Web Component -> ChatKit -> sandboxed Remote View
// protocol. The fixture replaces business data, never the navigation code.
const remote = `<!doctype html><html><body>
<output id="selection"></output><input aria-label="Draft" value="Draft stays mounted">
<button id="create">Create project A</button><button id="open">Open project B</button>
<button id="review">Review</button><output id="receipt"></output>
<script>
let context, sequence=0;
function post(type, data={}) { parent.postMessage({channel:'xpertai.remote_component',protocolVersion:1,type,
  instanceId:context?.instanceId,scopeRevision:context?.scopeRevision,...data},'*'); }
addEventListener('message',event=>{ const msg=event.data;
 if(msg.channel!=='xpertai.remote_component')return;
 if(msg.type==='init'){context=msg;document.querySelector('#selection').textContent=JSON.stringify(msg.initialQuery);}
 if(msg.type==='clientCommandResult')document.querySelector('#receipt').textContent=JSON.stringify(msg);
});
function openProject(id) { post('invokeClientCommand',{ requestId:String(++sequence),commandKey:'workbench.navigation.open',
 payload:{target:'assistant.project',projectId:'workspace-'+id,viewKey:'${key}',selectionId:id,
 parameters:{view:'workflow',projectId:id,mode:'score',section:'authoring',writingMode:'directory'}}}); }
document.querySelector('#create').onclick=()=>openProject('created');
document.querySelector('#open').onclick=()=>openProject('b');
document.querySelector('#review').onclick=()=>post('invokeClientCommand',{requestId:String(++sequence),commandKey:'workbench.navigation.open',
 payload:{target:'workbench.view',viewKey:'${key}',selectionId:context.initialQuery.selectionId,
 parameters:{...context.initialQuery.parameters,section:'review'}}});
post('ready');
</script></body></html>`;

const host = `<!doctype html><html><body style="margin:0;height:100vh">
<script src="/web-component.js"></script><script>
const element=document.createElement('xpertai-chatkit');
element.style.cssText='display:block;width:100vw;height:100vh';
let state;
function restore() {
 const query=new URLSearchParams(location.search);
 state={projectId:query.get('project')||'workspace-a',view:{viewKey:'${key}',selectionId:query.get('bid')||'a',
 parameters:{view:'workflow',projectId:query.get('bid')||'a',mode:'score',section:query.get('section')||'authoring',writingMode:'directory'}}};
 apply();
}
function persist(next) {
 if(JSON.stringify(next)===JSON.stringify(state))return;
 state=next;
 const query=new URLSearchParams({project:next.projectId,bid:next.view?.selectionId||'',section:next.view?.parameters?.section||''});
 history.pushState(null,'','/host?'+query);apply();
}
function apply() { element.setOptions({frameUrl:location.origin+'/index.html',sessionKey:'navigation-test',
 api:{apiUrl:location.origin+'/api/ai',xpertId:'assistant',projectId:state.projectId,getClientSecret:async()=>({secret:'fixture-secret',organizationId:'fixture-org'})},
 initialThread:null,workbench:{enabled:true,viewRail:{enabled:true},navigation:state,onNavigationChange:persist,
 onClientCommand:async request=>{ const p=request.payload;
  if(p.target!=='assistant.project')return {success:false,code:'unsupported'};
  persist({projectId:p.projectId,view:{viewKey:p.viewKey,selectionId:p.selectionId,parameters:p.parameters}});
  return {success:true,status:'opened'};
 }}}); }
restore();document.body.append(element);addEventListener('popstate',restore);
</script></body></html>`;

for (const width of [1500, 760]) {
  test(`one embedded Workbench owns create, open, project switching, refresh and history at ${width}px`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const requests: string[] = [];
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/host')
        return route.fulfill({ contentType: 'text/html', body: host });
      if (url.pathname === '/web-component.js')
        return route.fulfill({
          contentType: 'application/javascript',
          body: await readFile(
            resolve(root, '../web-component/dist/xpert-chatkit.js'),
          ),
        });
      if (url.pathname.includes('/api/')) {
        requests.push(url.pathname);
        if (url.pathname.endsWith('/views'))
          return route.fulfill({
            json: [
              manifest,
              {
                ...manifest,
                key: 'other-plugin',
                title: 'Outer plugin',
                view: { type: 'raw_json' },
                workbench: { openMode: 'auto' },
              },
            ],
          });
        if (url.pathname.endsWith('/manifest'))
          return route.fulfill({ json: manifest });
        if (url.pathname.endsWith('/remote-component/entry'))
          return route.fulfill({ contentType: 'text/html', body: remote });
        if (url.pathname.endsWith('/assistants/assistant'))
          return route.fulfill({
            json: {
              assistant_id: 'assistant',
              name: 'Bid assistant',
              config: {},
            },
          });
        return route.fulfill({ json: { items: [], data: [], total: 0 } });
      }
      const file = resolve(
        root,
        'dist/app',
        `.${decodeURIComponent(url.pathname)}`,
      );
      if (!file.startsWith(resolve(root, 'dist/app') + sep))
        return route.abort();
      try {
        const mime: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.woff2': 'font/woff2',
          '.svg': 'image/svg+xml',
        };
        return route.fulfill({
          contentType: mime[extname(file)] ?? 'application/octet-stream',
          body: await readFile(file),
        });
      } catch {
        return route.fulfill({
          status: 404,
          body: 'Fixture has no such resource',
        });
      }
    });
    await page.setViewportSize({ width, height: 950 });
    await page.goto(`${origin}/host`);
    const chatkit = page.frameLocator('xpertai-chatkit iframe');
    const bid = chatkit.frameLocator('iframe[title="Bid Studio"]');
    await expect(
      bid.locator('#selection'),
      JSON.stringify(requests),
    ).toContainText('authoring');
    expect(await page.locator('xpertai-chatkit').count()).toBe(1);
    await bid.getByRole('button', { name: 'Create project A' }).click();
    await bid.getByRole('textbox', { name: 'Draft' }).fill('Keep this draft');
    await bid.getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page).toHaveURL(/section=review/);
    await expect(bid.getByRole('textbox', { name: 'Draft' })).toHaveValue(
      'Keep this draft',
    );
    await bid.getByRole('button', { name: 'Open project B' }).click();
    await expect(page).toHaveURL(/project=workspace-b/);
    await expect(bid.locator('#selection')).toContainText('"selectionId":"b"');
    await page.goBack();
    await expect(page).toHaveURL(/project=workspace-created.*section=review/);
    await expect(bid.locator('#selection')).toContainText('"section":"review"');
    await page.goForward();
    await expect(bid.locator('#selection')).toContainText('"selectionId":"b"');
    await page.reload();
    await expect(bid.locator('#selection')).toContainText('"selectionId":"b"');
    await expect(bid.locator('#selection')).toContainText(
      '"section":"authoring"',
    );
    await expect(chatkit.locator('iframe[title="Bid Studio"]')).toHaveCount(1);
    await expect(chatkit.locator('iframe[title="Outer plugin"]')).toHaveCount(
      0,
    );
    await expect(
      bid.getByRole('button', { name: 'Open project B' }),
    ).toBeInViewport({ ratio: 1 });
    expect(errors).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('chatkit-workbench.png'),
      fullPage: true,
    });
  });
}
