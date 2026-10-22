"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.join(__dirname, '..');
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const fixtureHtml = '<html lang="en"><head><title>Housing application</title><meta name="description" content="Apply"></head><body><main><h1>Housing application</h1><aside id="shared"><h2>Shared navigation</h2><p>The Government provides these services.</p><a id="shared-link" href="https://example.ca/guide">Shared guide</a><a href="https://example.ca/navigation-only">Navigation only</a></aside><p id="other-area">The Government provides more information.</p><p><a href="https://example.ca/guide">Application guide</a></p></main></body></html>';
const server = http.createServer((req,res)=>{
  const pathname = new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/services/') || pathname.startsWith('/other/')) {res.setHeader('Content-Type','text/html');res.end(pathname === '/services/no-shared-areas' ? fixtureHtml.replace('id="shared"','id="different-sidebar"').replace('id="other-area"','id="different-advice"') : fixtureHtml);return;}
  const file = path.join(root,pathname);
  if(!file.startsWith(root+'/')) {res.writeHead(403);res.end();return;}
  try {
    let data=fs.readFileSync(file);
    if(file.endsWith('/sidepanel.js')) data=data.toString().replace(/\ninit\(\)\.catch\([\s\S]*$/,'');
    res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(data);
  } catch {res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [320,390,520,1280]) {
   const workspace=width===1280;
   const source=await browser.newPage({viewport:{width:1000,height:850}});
   await source.goto(origin+'/services/housing/apply');
   const panel=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
   const errors=[];panel.on('pageerror',error=>errors.push(error.message));
   const pages=new Map([[42,source],[99,panel]]);let nextId=50,activeId=workspace?99:42;const storage={};let failStorage=false;
   await panel.exposeFunction('__extensionCall',async(method,args)=>{
    if(method==='script') {
     const target=pages.get(args.target.tabId);if(!target)throw Error('Page is closed');
     if(args.files) {for(const file of args.files)await target.addScriptTag({path:path.join(root,file)});return [{frameId:0,documentId:'fixture-document'}];}
     const result=await target.evaluate(({code,args})=>(0,eval)(`(${code})`)(...(args||[])),{code:args.code,args:args.args});
     return [{frameId:0,documentId:'fixture-document',result}];
    }
    if(method==='tabs.query') return [{id:workspace?activeId:42,url:pages.get(workspace?activeId:42).url(),status:'complete'}];
    if(method==='tabs.get') return {id:args,url:pages.get(args).url(),status:'complete'};
    if(method==='tabs.update') {activeId=args.id;return {id:args.id,url:pages.get(args.id).url()};}
    if(method==='tabs.create') {const target=await browser.newPage();const id=nextId++;pages.set(id,target);await target.goto(args.url);return {id,url:target.url(),status:'complete'};}
    if(method==='tabs.remove') {await pages.get(args).close();pages.delete(args);return;}
    if(method==='storage.get') return structuredClone(storage);
    if(method==='storage.set') {if(failStorage)throw Error('Test storage failure');Object.assign(storage,structuredClone(args));return;}
    if(method==='storage.remove') {(Array.isArray(args)?args:[args]).forEach(key=>delete storage[key]);return;}
   });
   await panel.addInitScript(()=>{
    const event={addListener(){},removeListener(){}};
    globalThis.chrome={
     runtime:{getManifest:()=>({version:'1.3.3',host_permissions:[]}),getURL:file=>file.startsWith('fonts/')?location.origin+'/'+file:`chrome-extension://fixture/${file}`},
     tabs:{onActivated:event,onUpdated:event,query:args=>__extensionCall('tabs.query',args),get:id=>__extensionCall('tabs.get',id),update:(id,args)=>__extensionCall('tabs.update',{id,...args}),create:args=>__extensionCall('tabs.create',args),remove:id=>__extensionCall('tabs.remove',id)},
     storage:{onChanged:event,local:{get:args=>__extensionCall('storage.get',args),set:args=>__extensionCall('storage.set',args),remove:args=>__extensionCall('storage.remove',args)}},
     scripting:{executeScript:args=>__extensionCall('script',{target:args.target,files:args.files,args:args.args,code:args.func&&args.func.toString()})},
     permissions:{request:async()=>true,contains:async()=>true,getAll:async()=>({origins:[]})}
    };
   });
   await panel.goto(origin+'/sidepanel.html'+(workspace?'?workspace=1':''));
   await panel.evaluate(async(url)=>{
    globalThis.BCWebStyleGuidePreviewLifecycle=null;
    cacheElements();bindEvents();state.activeTab={id:42,url};state.lastReviewTabId=42;
    document.body.dataset.surface=workspaceSurface?'workspace':'panel';syncStickyHeaderOffset();
    await loadState();state.lastReviewTabId=42;applySettings(defaultSettings(url));
   },source.url());
   const originalUrl=source.url();
   if (!await panel.locator('#exclude-areas').isChecked()) await panel.locator('#exclude-areas').check();
   await panel.locator('#manage-exclusions').click();
   await panel.locator('#choose-exclusion').click();
   const picker=source.locator('[data-bc-wsg-exclusion-ui]');
   await picker.waitFor();
   assert.match(await picker.locator('.tools').evaluate(element=>getComputedStyle(element).fontFamily),/BC Sans Checker/);
   assert.equal(await source.evaluate(()=>Array.from(document.fonts).filter(font=>font.family==='BC Sans Checker'&&font.status==='loaded').length),2);
   assert.equal(await picker.getByText('Choose from a list',{exact:true}).count(),0);
   await picker.getByRole('button',{name:/^Move controls/}).click();
   await picker.getByRole('button',{name:/^Move controls/}).click();
   await source.locator('#shared-link').click();
   assert.equal(await picker.locator('.identity').innerText(),'aside#shared');
   await picker.getByRole('button',{name:'Use selected area'}).click();
   await panel.locator('#exclusion-save-dialog').waitFor({state:'visible'});
   assert.deepEqual(await panel.locator('input[name="exclusion-scope"]').evaluateAll(inputs=>inputs.map(input=>input.value)),['site','page']);
   assert.equal(await panel.getByRole('radio',{name:'Entire website',exact:true}).isChecked(),true);
   assert.equal(await panel.locator('#exclusion-name').inputValue(),'');
   assert.match(await panel.locator('#exclusion-name').getAttribute('placeholder'),/Left navigation panel/);
   assert.equal(await panel.locator('#exclusion-save-rescan').isVisible(),false);
   await panel.locator('#exclusion-name').fill('Left navigation panel');
   await panel.locator('#exclusion-reselect').click();
   await picker.waitFor();
   await source.locator('#shared-link').click();
   await picker.getByRole('button',{name:'Use selected area'}).click();
   await panel.locator('#exclusion-save-dialog').waitFor({state:'visible'});
   assert.equal(await panel.locator('#exclusion-name').inputValue(),'Left navigation panel','Reselect preserves the draft');
   await panel.locator('#exclusion-save-add').click();
   await picker.waitFor();
   assert.equal(storage.reviewExclusionsV1.length,1);
   assert.equal(await panel.evaluate(()=>state.activeReport),null,'Save and add does not scan');
   await source.locator('#other-area').click();
   await picker.getByRole('button',{name:'Use selected area'}).click();
   await panel.locator('#exclusion-save-dialog').waitFor({state:'visible'});
   await panel.locator('#exclusion-name').fill('Additional advice');
   await panel.locator('#exclusion-save-button').click();
   await panel.locator('#exclusion-save-dialog').waitFor({state:'hidden'});
   assert.equal(storage.reviewExclusionsV1.length,2);
   assert.equal(await panel.evaluate(()=>state.activeReport),null);
   assert.equal(await panel.locator('#scan-settings').isVisible(),true);
   const firstId=await panel.evaluate(()=>state.exclusions.find(rule=>rule.name==='Left navigation panel').id);
   const entry=()=>panel.locator(`#exclusions-list [data-exclusion-id="${firstId}"]`);
   if (!await panel.locator('#exclude-areas').isChecked()) await panel.locator('#exclude-areas').check();
   await panel.locator('#manage-exclusions').click();
   assert.equal(await panel.locator('#exclusions-list [data-exclusion-id]').first().locator('h3').innerText(),'Additional advice','Newest areas appear first');
   await panel.locator('#show-all-exclusions').click();
   await panel.waitForFunction(()=>document.querySelector('#exclusions-status').textContent.includes('highlighted'));
   assert.equal(await source.locator('[data-bc-style-checker-highlight]').count(),2,'Show all highlights both areas');
   assert.equal(await panel.locator('#exclusions-dialog').isVisible(),true);
   await panel.locator('#choose-exclusion').click();
   await picker.waitFor();
   await source.locator('#shared-link').click();
   await picker.getByRole('button',{name:'Use selected area'}).click();
   await panel.locator('#exclusion-save-dialog').waitFor({state:'visible'});
   assert.match(await panel.locator('#exclusion-duplicate-notice').innerText(),/already saved/);
   assert.equal(await panel.locator('#exclusion-name').inputValue(),'Left navigation panel');
   await panel.locator('#exclusion-save-button').click();
   await panel.locator('#exclusions-dialog').waitFor({state:'visible'});
   assert.equal(storage.reviewExclusionsV1.length,2,'Duplicate selection updates the saved area');
   await entry().locator('[data-exclusion-action="edit"]').click();
   await panel.getByRole('radio',{name:'Only the page below',exact:true}).check();
   await panel.locator('#exclusion-save-button').click();
   await panel.locator('#exclusion-save-dialog').waitFor({state:'hidden'});
   assert.equal(await panel.evaluate(id=>state.exclusions.find(rule=>rule.id===id).scope,firstId),'page');
   assert.equal(await panel.locator('#exclusions-dialog').isVisible(),true,'Editing and saving returns to management');
   await panel.locator('#exclusions-close').click();
   await source.goto(origin+'/other/apply');
   await panel.evaluate(url=>{state.activeTab={id:42,url};state.lastReviewTabId=42;applySettings(defaultSettings(url));},source.url());
   if (!await panel.locator('#exclude-areas').isChecked()) await panel.locator('#exclude-areas').check();
   await panel.locator('#manage-exclusions').click();
   const otherPages=panel.locator('[data-exclusion-group="pages"]');
   assert.equal(await otherPages.getAttribute('open'),null,'Other-page exclusions start collapsed');
   assert.equal(await entry().isVisible(),false);
   await otherPages.locator(':scope > summary').click();
   await entry().locator('[data-exclusion-action="copy"]').click();
   await panel.locator('#exclusion-save-dialog').waitFor({state:'visible'});
   assert.equal(await panel.getByRole('radio',{name:'Only the page below',exact:true}).isChecked(),true);
   await panel.locator('#exclusion-save-button').click();
   await panel.locator('#exclusion-save-dialog').waitFor({state:'hidden'});
   assert.equal(await panel.evaluate(()=>state.exclusions.filter(rule=>rule.name==='Left navigation panel'&&rule.scope==='page').length),2);
   if (!await panel.locator('#exclude-areas').isChecked()) await panel.locator('#exclude-areas').check();
   await panel.locator('#manage-exclusions').click();
   await entry().locator('[data-exclusion-action="edit"]').click();
   assert.equal(await panel.getByRole('radio',{name:'Entire website',exact:true}).isEnabled(),true);
   await panel.getByRole('radio',{name:'Entire website',exact:true}).check();
   await panel.locator('#exclusion-save-button').click();
   await panel.locator('#exclusion-save-dialog').waitFor({state:'hidden'});
   assert.equal(await panel.evaluate(id=>state.exclusions.find(rule=>rule.id===id).scope,firstId),'site');
   await panel.locator('#exclusions-close').click();
   await source.goto(originalUrl);
   await panel.evaluate(url=>{state.activeTab={id:42,url};state.lastReviewTabId=42;applySettings(defaultSettings(url));},source.url());
   await panel.locator('#scan-button').click();
   await panel.locator('#current-results').waitFor({state:'visible'});
   const result=await panel.evaluate(()=>({links:state.activeReport.pageDetails.links,remote:remoteLinksForReport(state.activeReport),revisionMatches:settingsMatchReport(),excluded:state.activeReport.settings.exclusions.length}));
   assert.equal(result.links.length,3);assert.equal(result.remote.length,2);assert.equal(result.revisionMatches,true);assert.equal(result.excluded,2);
   assert.equal(await panel.locator('.review-summary #manage-report-exclusions').count(),0);
   assert.equal(await panel.locator('.review-order #manage-report-exclusions').count(),0);
   await panel.locator('#details-review-tab').click();
   assert.equal(await panel.locator('#page-scan-coverage #manage-report-exclusions').innerText(),'Excluded areas (2)');
   assert.equal(await panel.locator('#exclusion-report-text').isVisible(),false);
   await panel.locator('#details-review-tab').click();
   await panel.locator('#manage-report-exclusions').click();
   await panel.locator('#exclusions-dialog').waitFor({state:'visible'});
   await entry().locator('[data-exclusion-action="show"]').click();
   assert.equal(await panel.locator('#exclusions-dialog').isVisible(),true,'Showing an area keeps management open');
   assert.equal(await entry().locator('details').count(),0,'Each area uses visible actions without a repeated dropdown');
   assert.equal(await entry().locator('[data-exclusion-action="choose"]').count(),0,'Reselect is part of Edit');
   assert.equal(await entry().locator('[data-exclusion-action="remove"]').isVisible(),true);
   await entry().locator('[data-exclusion-action="edit"]').click();
   await panel.locator('#exclusion-skip-links').check();
   await panel.locator('#exclusion-save-rescan').click();
   await panel.waitForFunction(id=>state.activeReport.settings.exclusions.some(rule=>rule.id===id&&rule.skipLinks),firstId);
   const skipped=await panel.evaluate(()=>({links:state.activeReport.pageDetails.links,remote:remoteLinksForReport(state.activeReport),exports:linkRows(state.activeReport)}));
   assert.equal(skipped.links.length,3);assert.equal(skipped.links.filter(link=>link.excludedFromCheck).length,2);assert.equal(skipped.remote.length,1);
   assert.equal(skipped.exports.filter(row=>row[5]==='Skipped by saved exclusion').length,2);
   const scopeExport=await panel.evaluate(()=>{
    elements['current-export-preset'].value='custom';document.querySelectorAll('#current-export-custom input').forEach(input=>input.checked=input.dataset.sheet==='Links');
    const sheets=currentWorkbookSheets();return {names:sheets.map(sheet=>sheet.name),rows:sheets.at(-1).rows};
   });
   assert.deepEqual(scopeExport.names,['Links','Review scope']);assert.match(JSON.stringify(scopeExport.rows),/Link checks skipped/);
   if (width === 390) {
    const choices = await panel.evaluate(async ({matchingUrl, unmatchedUrl})=>{
      const saved = JSON.stringify(state.exclusions);
      elements['batch-use-exclusions'].checked = false;
      const allSettings = batchExportSnapshotFromUi().settings;
      const all = await scanBatchUrl(matchingUrl, allSettings);
      elements['batch-use-exclusions'].checked = true;
      const skipSettings = batchExportSnapshotFromUi().settings;
      const skipped = await scanBatchUrl(matchingUrl, skipSettings);
      const unmatched = await scanBatchUrl(unmatchedUrl, skipSettings);
      state.batch = {...initialBatchState(), settings:allSettings, urls:[matchingUrl,unmatchedUrl], records:[], phase:'paused'};
      await persistBatchState(); await loadState(); applyBatchStateToControls(); updateBatchControls();
      const restored = {checked:elements['batch-use-exclusions'].checked, disabled:elements['batch-use-exclusions'].disabled, count:state.batch.settings.exclusions.length};
      state.batch = initialBatchState(); elements['batch-use-exclusions'].checked = true; updateBatchControls();
      return {all:all.report.stats.words, skipped:skipped.report.stats.words, unmatched:unmatched.report.stats.words,
        allOutcomes:all.report.settings.exclusions.length, skippedCount:skipped.report.settings.exclusions.filter(area=>area.status==='applied').length,
        restored, unchanged:JSON.stringify(state.exclusions)===saved};
    },{matchingUrl:originalUrl,unmatchedUrl:origin+'/services/no-shared-areas'});
    assert.ok(choices.all > choices.skipped);
    assert.equal(choices.unmatched, choices.all, 'Pages without matching areas retain their content');
    assert.equal(choices.allOutcomes, 0);
    assert.equal(choices.skippedCount, 2);
    assert.deepEqual(choices.restored, {checked:false,disabled:true,count:0}, 'A resumed batch keeps its choice to review all areas');
    assert.equal(choices.unchanged,true,'Batch choices preserve saved areas');
   }
   await panel.evaluate(()=>{state.batch={...initialBatchState(),settings:batchExportSnapshotFromUi().settings,urls:['first','second'],records:[],phase:'paused'};});
   await panel.locator('#details-review-tab').click();
   await panel.locator('#manage-report-exclusions').click();
   await panel.locator('#exclusions-dialog').waitFor({state:'visible'});
   await entry().locator('[data-exclusion-action="edit"]').click();
   await panel.locator('#exclusion-skip-links').uncheck();
   const oldScan=await panel.evaluate(()=>state.activeReport.scannedAt);
   await panel.locator('#exclusion-save-button').click();
   await panel.locator('#exclusion-save-dialog').waitFor({state:'hidden'});
   assert.equal(await panel.evaluate(()=>state.activeReport.scannedAt),oldScan,'Save and close preserves the saved report');
   assert.match(await panel.locator('#exclusion-report-text').innerText(),/Rescan/);
   assert.equal(await panel.locator('#exclusions-dialog').isVisible(),true);
   await panel.locator('#exclusions-close').click();
   const snapshot=await panel.evaluate(id=>({saved:state.batch.settings.exclusions.find(rule=>rule.id===id).skipLinks,current:state.exclusions.find(rule=>rule.id===id).skipLinks}),firstId);
   assert.deepEqual(snapshot,{saved:true,current:false});
   const batch=await panel.evaluate(async url=>{const record=await scanBatchUrl(url,state.batch.settings);await persistBatchState();return {status:record.status,links:record.report.pageDetails.links,remote:remoteLinksForReport(record.report)};},origin+'/services/housing/renew');
   assert.equal(batch.status,'complete');assert.equal(batch.links.length,3);assert.equal(batch.remote.length,1);
   const historicalBatch = await panel.evaluate(async()=>{
    state.batch.settings.exclusions=state.batch.settings.exclusions.map(rule=>{const legacy={...rule};delete legacy.skipLinks;return legacy;});
    await persistBatchState();await loadState();
    return state.batch.settings.exclusions.every(rule=>rule.skipLinks===true);
   });
   assert.equal(historicalBatch,true,'Resuming a batch from the first experiment preserves its original link-check scope');
   await panel.locator('#details-review-tab').click();
   await panel.locator('#manage-report-exclusions').click();
   await panel.locator('#exclusions-dialog').waitFor({state:'visible'});
   failStorage=true;
   await entry().locator('[data-exclusion-action="toggle"]').click();
   await panel.waitForFunction(()=>document.querySelector('#exclusions-status').textContent.includes('storage failure'));
   assert.equal(await panel.evaluate(id=>state.exclusions.find(rule=>rule.id===id).enabled,firstId),true);failStorage=false;
   await panel.locator('#exclusions-close').click();
   if(width===390) {
    await panel.evaluate(async id=>persistExclusions(state.exclusions.map(rule=>rule.id===id?{...rule,enabled:false}:rule)),firstId);
    await panel.locator('#manage-report-exclusions').click();
   await panel.locator('#exclusions-dialog').waitFor({state:'visible'});
    await panel.locator('#choose-exclusion').click();
    await picker.waitFor();
    await source.locator('#shared-link').click();
    await picker.getByRole('button',{name:'Use selected area'}).click();
    await panel.locator('#exclusion-save-dialog').waitFor({state:'visible'});
    assert.equal(await panel.locator('#exclusion-enabled-choice').isVisible(),true);
    await panel.locator('#exclusion-enabled').check();
    await panel.locator('#exclusion-save-button').click();
    await panel.locator('#exclusions-dialog').waitFor({state:'visible'});
    assert.equal(await panel.evaluate(id=>state.exclusions.find(rule=>rule.id===id).enabled,firstId),true);
    await panel.locator('#exclusions-close').click();
    const count=await panel.evaluate(()=>state.exclusions.length);
    await panel.evaluate(id=>{const rule=state.exclusions.find(rule=>rule.id===id);showExclusionForm({locator:rule.locator,pageUrl:state.activeTab.url,validate:false},{name:'Duplicate copy',scope:'page',skipLinks:false});},firstId);
    await panel.locator('#exclusion-save-button').click();
    assert.match(await panel.locator('#exclusion-save-status').innerText(),/already saved/);
    assert.equal(await panel.evaluate(()=>state.exclusions.length),count,'Saving cannot create another covered copy');
    await panel.locator('#exclusion-save-close').click();
    await panel.locator('#exclusions-dialog').waitFor({state:'visible'});
    await panel.locator('#exclusions-close').click();
   }
   if(width===390) {
    await panel.evaluate(()=>{elements['scan-settings'].hidden=false;elements['cancel-settings-button'].hidden=false;});
    const savedCount=await panel.evaluate(()=>state.exclusions.length);
    assert.equal(await panel.locator('#exclude-areas').isChecked(),true);
    assert.equal(await panel.locator('#exclusion-settings-areas button').count(),2);
    await panel.locator('#exclusion-settings-areas button').first().click();
    await panel.waitForFunction(()=>document.querySelector('#toast').textContent.includes('highlighted'));
    await panel.locator('#exclude-areas').uncheck();
    assert.equal(await panel.locator('#exclusion-scan-options').isVisible(),false);
    await panel.locator('#scan-button').click();
    await panel.waitForFunction(()=>state.activeReport.settings.exclusions.length===0);
    assert.equal(await panel.evaluate(()=>state.exclusions.length),savedCount,'The toggle keeps saved areas');
    assert.equal(await panel.evaluate(()=>selectedSettings().exclusions.length),0,'Turning the toggle off includes areas in the next scan');
    await panel.evaluate(async()=>{elements['exclude-areas'].checked=true;await scanCurrentPage();});
    await panel.waitForFunction(()=>state.activeReport.settings.exclusions.length>0);
    assert.equal(await panel.locator('#exclude-areas').isChecked(),true);
   }
   const beforeInclude=await panel.evaluate(()=>JSON.stringify({exclusions:state.exclusions,batch:state.batch.settings.exclusions}));
   const filteredWords=await panel.evaluate(()=>state.activeReport.stats.words);
   await panel.locator('#findings-review-tab').click();
   await panel.evaluate(async()=>{elements['exclude-areas'].checked=!elements['exclude-areas'].checked;await scanCurrentPage();});
   await panel.waitForFunction(()=>state.activeReport.settings.exclusions.length===0);
   assert.ok(await panel.evaluate(()=>state.activeReport.stats.words)>filteredWords);
   assert.equal(await panel.evaluate(()=>state.activeReport.settings.exclusions.length),0);
   assert.equal(await panel.locator('#included-areas-notice').count(),0);
   assert.equal(await panel.locator('#exclusion-report-summary').isVisible(),false);
   assert.equal(await panel.locator('#exclusion-report-text').isVisible(),false);
   assert.equal(await panel.evaluate(()=>JSON.stringify({exclusions:state.exclusions,batch:state.batch.settings.exclusions})),beforeInclude);
   assert.equal(await panel.evaluate(()=>withExclusionCoverage([{name:'Test',rows:[]}],[state.activeReport]).length),1);
   if(width===390) await panel.evaluate(()=>{const finding=state.activeReport.issues[0];globalThis.retainedExclusionFingerprint=finding.fingerprint;state.notes[finding.fingerprint]='A note kept during exclusion review';});
   await panel.evaluate(async()=>{elements['exclude-areas'].checked=!elements['exclude-areas'].checked;await scanCurrentPage();});
   await panel.waitForFunction(()=>!state.activeReport.settings.includeExcludedAreas&&state.activeReport.settings.exclusions.length>0);
   assert.equal(await panel.evaluate(()=>state.activeReport.stats.words),filteredWords);
   if(width===390) assert.equal(await panel.evaluate(()=>state.notes[retainedExclusionFingerprint]),'A note kept during exclusion review','Notes survive restoring the excluded scope');
   if (width === 390) {
    // A site-wide selector must exist in the live document to appear as active.
    await panel.evaluate(()=>openExclusionsDialog());
    await source.locator('#other-area').evaluate(node=>node.remove());
    await panel.evaluate(()=>refreshExclusionReviewPage());
    assert.equal(await panel.locator('#exclusion-settings-areas button').count(),1);
    await panel.evaluate(()=>openExclusionsDialog());
    assert.equal(await panel.locator('[data-exclusion-group="missing"]').count(),1);
    await panel.locator('#exclusions-close').click();
    await panel.evaluate(()=>renderPageDetails('links'));
    assert.equal(await panel.locator('#page-scan-coverage').isVisible(),false);
    await panel.evaluate(()=>renderPageDetails('overview'));
    await panel.evaluate(()=>{state.activeTab.url='https://www2.gov.bc.ca/gov/content/test';updateSettingsExplanation();});
    assert.equal(await panel.locator('#cms-more-scan-options #exclusion-scan-control').count(),1);
    await panel.evaluate(()=>{state.activeTab.url='https://cmslite.gov.bc.ca/content/edit';elements['exclude-areas'].checked=true;updateSettingsExplanation();});
    assert.equal(await panel.locator('#exclusion-scan-control').isVisible(),false);
    assert.equal(await panel.locator('#menu-exclusions').evaluate(node=>node.hidden),true);
    assert.equal(await panel.evaluate(()=>selectedSettings().exclusions.length),0);
    assert.equal(await panel.evaluate(()=>selectedSettings().useExclusions),false);
    await panel.evaluate(()=>{state.activeReport.settings.editorMode=true;renderExclusionSettings();});
    assert.equal(await panel.locator('#exclusion-report-summary').isVisible(),false);
    assert.equal(await panel.locator('#exclusion-report-text').isVisible(),false);
    await source.reload();
    await panel.evaluate(url=>{state.activeTab.url=url;state.activeReport.settings.editorMode=false;updateSettingsExplanation();},originalUrl);
   }
   assert.equal(await panel.locator('#open-feedback-button').count(),0);
   await panel.evaluate(async()=>{const template=state.exclusions[0];await persistExclusions([...state.exclusions,...Array.from({length:8},(_,index)=>({...template,id:`other-site-${index}`,name:`Other website ${index}`,scope:'site',url:`https://site${index}.example/`,sourceUrl:`https://site${index}.example/`}))]);});
   await panel.locator('#details-review-tab').click();
   await panel.locator('#manage-report-exclusions').click();
   await panel.locator('#exclusions-dialog').waitFor({state:'visible'});
   const sites=panel.locator('[data-exclusion-group="sites"]');
   assert.equal(await sites.getAttribute('open'),null,'Other websites start collapsed');
   assert.equal(await panel.locator('.exclusions-help').evaluate(node=>node.open),false);
   await panel.locator('.exclusions-help > summary').click();
   assert.match(await panel.locator('#exclusions-page-address').innerText(),/services\/housing\/apply/);
   await panel.locator('.exclusions-help > summary').click();
   await sites.locator(':scope > summary').click();
   await sites.locator('[data-exclusion-id]').last().scrollIntoViewIfNeeded();
   const closeBox=await panel.locator('#exclusions-close').boundingBox(),dialogBox=await panel.locator('#exclusions-dialog').boundingBox();
   assert.ok(closeBox.y>=dialogBox.y&&closeBox.y+closeBox.height<=dialogBox.y+dialogBox.height,'Close remains visible while scrolling');
   await panel.locator('#exclusions-close').click();
   await panel.evaluate(async()=>persistExclusions(state.exclusions.filter(rule=>!rule.id.startsWith('other-site-'))));
   assert.equal(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
   assert.deepEqual(errors,[]);
   console.log(`Refined exclusions ${width}px passed (BC Sans, reselect, save options, scope edits, second-page copy, links, duplicates, groups, sticky close, scan toggles, live area matching, CMS Lite visibility and frozen batches).`);
   await panel.close();await source.close();

  }
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
