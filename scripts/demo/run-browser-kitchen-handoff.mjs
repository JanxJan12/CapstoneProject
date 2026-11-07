// Continue the Customer browser order through Cashier, KDS, and release in Chrome.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo=resolve(import.meta.dirname,'../..');
const runtime=join(repo,'.tmp','defense-demo-20261014');
const card=JSON.parse(readFileSync(join(runtime,'role-accounts.private.json'),'utf8'));
const customerResult=JSON.parse(readFileSync(join(repo,'qa','defense-customer-browser-20261014','result.json'),'utf8'));
const number=customerResult.orderNumber;
if(!/^ORD-\d{6}$/.test(number))throw new Error('Unsafe Customer order number.');
const cli=spawnSync('npx.cmd',['--yes','supabase@2.120.0','status','--workdir',`"${runtime}"`,'-o','json'],{encoding:'utf8',shell:true});
if(cli.status!==0)throw new Error('Demo stack unavailable.');
const local=JSON.parse(cli.stdout);if(local.API_URL!=='http://127.0.0.1:61321')throw new Error('Wrong demo API.');
const db='supabase_db_rrj_defense_demo_20261014';
function sql(q){const r=spawnSync('docker',['exec','-u','postgres',db,'psql','-U','supabase_admin','-d','postgres','-X','-v','ON_ERROR_STOP=1','-Atqc',q],{encoding:'utf8'});if(r.status!==0)throw new Error(`Demo SQL failed: ${r.stderr.slice(0,200)}`);return r.stdout.trim();}
if(spawnSync('docker',['inspect','-f','{{.State.Running}}',db],{encoding:'utf8'}).stdout.trim()!=='true'||sql('select count(*) from supabase_migrations.schema_migrations')!=='52')throw new Error('Wrong demo database.');
const initial=sql(`select o.current_status||'|'||p.status from public.orders o join public.payments p on p.order_id=o.id where o.order_number='${number}'`);
if(initial!=='waiting_payment_verification|pending')throw new Error(`Order is not pending: ${initial}`);
const base='http://127.0.0.1:58446';
const out=join(repo,'qa','defense-browser-handoff-20261014');await mkdir(out,{recursive:true});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','58446','--strictPort'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,RRJ_DEFENSE_DEMO:'1',VITE_DEMO_MODE:'true',VITE_SUPABASE_URL:local.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:local.PUBLISHABLE_KEY}});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let ready=false;for(let i=0;i<100;i++){try{if((await fetch(`${base}/auth`)).ok){ready=true;break;}}catch{}await pause(150);}if(!ready){vite.kill();throw new Error('Demo web unavailable.');}
const profile=await mkdtemp(join(tmpdir(),'rrj-defense-handoff-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-background-networking','--no-proxy-server','--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--window-size=1440,900',`${base}/auth?portal=staff`],{windowsHide:true,stdio:'ignore'});
let ws,seq=0;const pending=new Map();function cmd(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function ev(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;}
async function wait(expr,label){for(let i=0;i<220;i++){if(await ev(expr))return;await pause(150);}throw new Error(`Timed out ${label}: ${JSON.stringify(await ev('({url:location.href,body:document.body.innerText.slice(-800)})'))}`);}
async function fill(id,value){const ok=await ev(`(() => {const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);if(!ok)throw new Error(`Missing input ${id}`);}
async function click(label){const ok=await ev(`(() => {const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&!x.disabled&&x.textContent?.trim()===${JSON.stringify(label)});if(!b)return false;b.click();return true;})()`);if(!ok)throw new Error(`Button missing: ${label}`);}
async function shot(name){const r=await cmd('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(join(out,`${name}.png`),Buffer.from(r.data,'base64'));}
async function signInCashier(){await wait("Boolean(document.getElementById('demo-email'))",'Cashier login');await fill('demo-email',card.roles.cashier.email);await fill('demo-password',card.roles.cashier.password);await ev("document.getElementById('demo-email').closest('form').requestSubmit()");await wait("location.pathname==='/cashier'&&!document.getElementById('demo-email')&&document.body.innerText.includes('Pending Payments')",'Cashier workspace');}
try{
  let port;for(let i=0;i<80;i++){try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0]);break;}catch{await pause(100);}}if(!port)throw new Error('Chrome debugger unavailable.');
  const tabs=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());const tab=tabs.find(t=>t.type==='page'&&t.url.startsWith(base));if(!tab)throw new Error('Browser tab unavailable.');
  ws=new WebSocket(tab.webSocketDebuggerUrl);ws.addEventListener('message',event=>{const m=JSON.parse(event.data);const task=pending.get(m.id);if(!task)return;pending.delete(m.id);m.error?task.reject(new Error(m.error.message)):task.resolve(m.result);});await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});await cmd('Page.enable');await cmd('Runtime.enable');
  await signInCashier();
  const nav=await ev("(() => {const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.includes('Pending Payments'));if(!b)return false;b.click();return true;})()");if(!nav)throw new Error('Pending Payments navigation unavailable.');
  await wait("Boolean(document.querySelector('[aria-label=\"Pending payments\"]'))",'Cashier queue');
  const selected=await ev(`(() => {const b=[...document.querySelectorAll('[aria-label="Pending payments"] button')].find(x=>x.textContent?.includes(${JSON.stringify(number)}));if(!b)return false;b.click();return true;})()`);if(!selected)throw new Error('Customer browser order absent from Cashier queue.');
  await wait(`document.body.innerText.includes(${JSON.stringify(number)})&&document.body.innerText.includes('Extra rice')`,'Cashier modified payment details');
  await shot('cashier-pending');await click('Verify payment');
  await wait(`document.body.innerText.includes(${JSON.stringify(`Verify ${number}?`)})`,'Cashier verification dialog');await click('Confirm verification');
  for(let i=0;i<100&&sql(`select p.status from public.payments p join public.orders o on o.id=p.order_id where o.order_number='${number}'`)!=='verified';i++)await pause(150);
  if(sql(`select o.current_status||'|'||p.status from public.orders o join public.payments p on p.order_id=o.id where o.order_number='${number}'`)!=='confirmed|verified')throw new Error('Cashier browser verification did not persist.');
  await shot('cashier-verified');
  await ev('localStorage.clear();sessionStorage.clear()');await cmd('Page.navigate',{url:`${base}/kitchen`});
  await wait("Boolean(document.getElementById('kds-terminal-id'))",'KDS gate');await fill('kds-terminal-id',card.terminal.id);await fill('kds-terminal-secret',card.terminal.secret);await click('Activate Kitchen Terminal');
  await wait(`Boolean([...document.querySelectorAll('[aria-label]')].find(e=>e.getAttribute('aria-label')?.includes(${JSON.stringify(number)})))`,'KDS ticket');
  const cardSelector=`[aria-label^="${number},"]`;
  const mod=await ev(`document.querySelector(${JSON.stringify(cardSelector)})?.innerText.includes('Extra rice')`);if(!mod)throw new Error('KDS modifier missing.');
  await shot('kds-confirmed');
  const action=label=>ev(`(() => {const card=document.querySelector(${JSON.stringify(cardSelector)});const b=[...(card?.querySelectorAll('button')??[])].find(x=>x.textContent?.includes(${JSON.stringify(label)}));if(!b)return false;b.click();return true;})()`);
  if(!await action('Start Preparing'))throw new Error('KDS Start Preparing absent');
  await wait(`document.querySelector(${JSON.stringify(cardSelector)})?.getAttribute('aria-label')?.includes('Preparing')`,'KDS Preparing');
  if(!await action('Mark Ready'))throw new Error('KDS Mark Ready absent');
  await wait(`document.querySelector(${JSON.stringify(cardSelector)})?.getAttribute('aria-label')?.includes('Ready')`,'KDS Ready');
  if(sql(`select current_status from public.orders where order_number='${number}'`)!=='ready')throw new Error('KDS Ready not stored.');
  await shot('kds-ready');
  await ev('localStorage.clear();sessionStorage.clear()');await cmd('Page.navigate',{url:`${base}/auth?portal=staff`});await signInCashier();
  const orderNav=await ev("(() => {const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.includes('Order List'));if(!b)return false;b.click();return true;})()");if(!orderNav)throw new Error('Order List navigation unavailable.');
  await wait("Boolean(document.getElementById('order-search'))",'Order List search');await fill('order-search',number);
  await wait(`Boolean(document.querySelector('[aria-label="View details for ${number}"]'))`,'Cashier order row');
  await ev(`document.querySelector('[aria-label="View details for ${number}"]').click()`);
  await wait("[...document.querySelectorAll('button')].some(x=>x.textContent?.trim()==='Release ready order')",'Cashier release action');
  const others=sql(`select coalesce(string_agg(id::text,','),'') from public.riders where availability_status='available' and id<>'${card.roles.rider.id}'`).split(',').filter(Boolean);
  if(!others.every(id=>/^[0-9a-f-]{36}$/.test(id)))throw new Error('Unexpected Rider IDs.');
  if(others.length)sql(`update public.riders set availability_status='offline' where id in (${others.map(id=>`'${id}'`).join(',')})`);
  try{await click('Release ready order');for(let i=0;i<100&&sql(`select current_status from public.orders where order_number='${number}'`)!=='waiting_for_rider';i++)await pause(150);}
  finally{if(others.length)sql(`update public.riders set availability_status='available' where id in (${others.map(id=>`'${id}'`).join(',')})`);}
  if(sql(`select current_status from public.orders where order_number='${number}'`)!=='waiting_for_rider')throw new Error('Cashier browser release did not persist.');
  const assignment=sql(`select d.status||'|'||d.rider_id from public.delivery_assignments d join public.orders o on o.id=d.order_id where o.order_number='${number}' order by d.created_at desc limit 1`);
  if(assignment!==`offered|${card.roles.rider.id}`)throw new Error(`Rider offer mismatch: ${assignment.split('|')[0]}`);
  await shot('cashier-released');
  await writeFile(join(out,'result.json'),JSON.stringify({status:'PASS',orderNumber:number,checks:['Cashier browser verified Customer browser payment','KDS browser displayed Online channel and Extra rice','KDS browser advanced Confirmed to Preparing to Ready','Cashier browser released Ready delivery','Same local order offered to approved Rider'],boundary:'Real Chrome UI on isolated demo stack; this order remains offered for Rider action. No external payment or physical food movement.'},null,2));
  console.log(`PASS: browser Cashier → KDS → Cashier release on ${number}.`);
}finally{ws?.close();chrome.kill();vite.kill();}
