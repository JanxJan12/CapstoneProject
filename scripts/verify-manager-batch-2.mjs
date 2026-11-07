import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const base='http://127.0.0.1:58434/scripts/fixtures/visual-manager.html';
const out=resolve('qa/manager-batch-2-browser-20261023');
const profile=await mkdtemp(join(tmpdir(),'rrj-manager-batch2-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--disable-gpu','--disable-background-networking','--no-first-run',
  '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost',
  '--remote-debugging-port=0',`--user-data-dir=${profile}`,base+'?page=dashboard',
],{stdio:'ignore',windowsHide:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let socket,id=0;const pending=new Map();
function cmd(method,params={}){const key=++id;return new Promise((resolve,reject)=>{pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});}
async function evaluate(expression){const r=await cmd('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;}
async function waitReady(page){for(let i=0;i<120;i++){if(await evaluate(`document.querySelector('.rrj-app-shell')?.dataset.page==='${page}' && !!document.querySelector('h1')`))return;await pause(100);}throw new Error('Manager fixture did not render: '+await evaluate('document.body.innerText.slice(0,300)'));}
const results=[];
const requests=[];
try{
  let port;for(let i=0;i<100;i++){try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0]);break;}catch{await pause(100);}}
  assert.ok(port,'Chrome debugger unavailable');
  const targets=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());
  const tab=targets.find(t=>t.type==='page');assert.ok(tab);
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent')requests.push({url:m.params.request.url,method:m.params.request.method});if(m.method==='Runtime.exceptionThrown')console.error('BROWSER EXCEPTION',m.params.exceptionDetails?.text,m.params.exceptionDetails?.exception?.description);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')console.error('BROWSER ERROR',m.params.args?.map(x=>x.value||x.description).join(' '));const t=pending.get(m.id);if(!t)return;pending.delete(m.id);m.error?t.reject(new Error(m.error.message)):t.resolve(m.result);});
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');
  if(!process.env.RRJ_BATCH2_INTERACTION_ONLY) for(const [width,height] of [[320,700],[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,900]]){
    await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
    const pages=width===360||width===1024||width===1440
      ? ['dashboard','inventory','replenishment','stock-receiving','menu','reports','riders','inv-transactions']
      : width===1280
        ? ['dashboard','inventory','replenishment','stock-receiving','inv-transactions']
        : ['dashboard','inventory','replenishment','stock-receiving'];
    for(const page of pages){
      await cmd('Page.navigate',{url:`${base}?page=${page}`});
      try { await waitReady(page); } catch(error) { throw new Error(`${page} ${width}x${height}: ${error.message}; url=${await evaluate('location.href')}`); }
      await pause(650);
      const metrics=await evaluate(`(()=>{const root=document.documentElement,body=document.body,shell=document.querySelector('.rrj-app-shell'),main=document.querySelector('main');scrollTo(999,0);const reach=scrollX;scrollTo(0,0);const table=[...document.querySelectorAll('.rrj-data-table, .overflow-x-auto')].find(e=>e.scrollWidth>e.clientWidth+4);const r=table?.getBoundingClientRect();return {title:document.querySelector('h1')?.innerText||null,innerWidth,clientWidth:root.clientWidth,documentWidth:root.scrollWidth,bodyWidth:body.scrollWidth,reach,shellWidth:shell?.clientWidth,mainWidth:main?.clientWidth,mainScrollWidth:main?.scrollWidth,visibleActions:[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length&&!b.disabled).length,internalTable:table?{className:typeof table.className==='string'?table.className.slice(0,80):'',clientWidth:table.clientWidth,scrollWidth:table.scrollWidth,right:r.right,overflowX:getComputedStyle(table).overflowX}:null,usable:body.innerText.toLowerCase().includes('low usable stock'),sales:body.innerText.includes('₱12,480.00'),cardsOverlap:(()=>{const boxes=[...document.querySelectorAll('.manager-dashboard-action article')].map(e=>e.getBoundingClientRect());return boxes.some((a,i)=>boxes.some((b,j)=>j>i&&a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom))})()}})()`);
      assert.ok(metrics.title,`${page} ${width}: title`);
      assert.ok(metrics.visibleActions>0,`${page} ${width}: actions`);
      assert.ok(metrics.documentWidth<=metrics.clientWidth+1,`${page} ${width}: document overflow ${metrics.documentWidth}/${metrics.clientWidth}`);
      assert.equal(metrics.reach,0,`${page} ${width}: horizontal pan`);
      if(page==='dashboard'){
        assert.equal(metrics.usable,true,`${width}: Batch 1 usable warning`);
        assert.equal(metrics.sales,true,`${width}: financial KPI`);
        assert.equal(metrics.cardsOverlap,false,`${width}: card overlap`);
      }
      if(page==='menu'&&width===1024){
        assert.ok(metrics.internalTable&&metrics.internalTable.scrollWidth>metrics.internalTable.clientWidth,`${page}: internal table scroll`);
      }
      if((width===360||width===1024||width===1440)&&['dashboard','inventory','replenishment','stock-receiving','menu','reports','riders'].includes(page)){
        const file=`${page}-${width}x${height}.png`;
        const shot=await cmd('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
        await writeFile(join(out,file),Buffer.from(shot.data,'base64'));
        metrics.file=file;
      }
      results.push({page,width,height,...metrics});
    }
  }
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await cmd('Page.navigate',{url:`${base}?page=dashboard`});await waitReady('dashboard');await pause(450);
  const closed=await evaluate(`({expanded:document.querySelector('button[aria-label="Open navigation"]')?.getAttribute('aria-expanded'),inert:document.querySelector('#app-shell-navigation')?.hasAttribute('inert'),width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})`);
  assert.equal(closed.expanded,'false');assert.equal(closed.inert,true);
  await evaluate(`document.querySelector('button[aria-label="Open navigation"]').click()`);await pause(250);
  const open=await evaluate(`(()=>{const d=document.querySelector('#app-shell-navigation');const r=d.getBoundingClientRect();return {expanded:document.querySelector('button[aria-label="Open navigation"]').getAttribute('aria-expanded'),inert:d.hasAttribute('inert'),left:r.left,right:r.right,dialog:d.getAttribute('role'),width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}})()`);
  assert.equal(open.expanded,'true');assert.equal(open.inert,false);assert.equal(open.dialog,'dialog');assert.ok(open.left>=0&&open.right<=390);assert.ok(open.width<=open.client);
  await evaluate(`document.querySelector('button[aria-label="Close navigation"]').click()`);await pause(250);
  assert.equal(await evaluate(`document.querySelector('button[aria-label="Open navigation"]').getAttribute('aria-expanded')`),'false');
  assert.equal(await evaluate(`document.activeElement?.getAttribute('aria-label')`),'Open navigation','drawer restores focus');
  await cmd('Page.navigate',{url:`${base}?page=riders`});await waitReady('riders');await pause(600);
  const suspendButton=await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Suspend'))?.textContent||null`);
  assert.ok(suspendButton,'synthetic Rider suspend review control');
  await evaluate(`([...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Suspend'))).click()`);await pause(300);
  const dialog=await evaluate(`(()=>{const e=[...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(x=>x.getAttribute('aria-hidden')!=='true'&&x.getBoundingClientRect().width>0);if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}})()`);
  assert.ok(dialog&&dialog.left>=0&&dialog.right<=390&&dialog.width<=dialog.client,'Rider dialog fits mobile viewport');
  assert.equal(await evaluate(`document.activeElement?.closest('[role="alertdialog"]')!==null`),true,'dialog holds focus');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:`${base}?page=menu`});await waitReady('menu');await pause(600);
  const tableScroll=await evaluate(`(()=>{const t=document.querySelector('.rrj-data-table');if(!t)return null;t.scrollLeft=999;return {left:t.scrollLeft,max:t.scrollWidth-t.clientWidth,actions:t.querySelectorAll('button').length,headers:t.querySelectorAll('th').length}})()`);
  assert.ok(tableScroll&&tableScroll.left>0&&tableScroll.max>0&&tableScroll.actions>0&&tableScroll.headers>0,'wide menu table scrolls internally with headings and actions');
  assert.equal(await evaluate(`(()=>{const b=document.querySelector('.rrj-data-table button');b?.focus();return !!b&&document.activeElement===b})()`),true,'table action is keyboard focusable');
  const receivingStates=[];
  for(const [name,number] of [['draft','RR-20261012-000002'],['posted','RR-20261012-000001']]){
    await cmd('Page.navigate',{url:`${base}?page=stock-receiving&populated=${name}`});await waitReady('stock-receiving');await pause(700);
    const state=await evaluate(`({text:document.body.innerText,documentWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})`);
    assert.ok(state.text.includes(number),`${name} synthetic receipt rendered`);
    assert.ok(state.documentWidth<=state.clientWidth,`${name} receipt has no document overflow`);
    receivingStates.push({name,number,documentWidth:state.documentWidth,clientWidth:state.clientWidth});
  }
  await cmd('Page.navigate',{url:`${base}?page=replenishment`});await waitReady('replenishment');await pause(650);
  assert.match(await evaluate('document.body.innerText'),/Unsaved request sheet/);
  await evaluate(`([...document.querySelectorAll('button')].find(b=>b.textContent.includes('Request history'))).click()`);await pause(250);
  assert.match(await evaluate('document.body.innerText'),/PR-20261012-000001/);
  const external=requests.filter(r=>!r.url.startsWith('http://127.0.0.1:58434/')&&!r.url.startsWith('data:')&&!r.url.startsWith('blob:'));
  assert.deepEqual(external,[],'fixture made no external requests');
  assert.ok(requests.every(r=>['GET','HEAD'].includes(r.method)),'fixture made no writes');
  await writeFile(join(out,'result.json'),JSON.stringify({fixture:'synthetic local Manager; no hosted requests',results,interactions:{mobileNavigation:{closed,open},riderDialog:dialog,menuTable:tableScroll,receivingStates,requestHistory:'rendered',requestCount:requests.length,externalRequests:external}},null,2));
  console.log(JSON.stringify({screens:results.length,overflows:results.filter(r=>r.documentWidth>r.clientWidth),tables:results.filter(r=>r.internalTable).length,pages:[...new Set(results.map(r=>r.page))]}));
}finally{socket?.close();chrome.kill();await pause(250);await rm(profile,{recursive:true,force:true}).catch(()=>{});}
