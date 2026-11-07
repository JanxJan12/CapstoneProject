import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo=resolve(import.meta.dirname,'../..');
const runtime=join(repo,'.tmp','defense-demo-20261014');
const card=JSON.parse(readFileSync(join(runtime,'role-accounts.private.json'),'utf8'));
const statusResult=spawnSync('npx.cmd',['--yes','supabase@2.120.0','status','--workdir',`"${runtime}"`,'-o','json'],{encoding:'utf8',shell:true});
if(statusResult.status!==0)throw new Error('Demo stack unavailable.');
const local=JSON.parse(statusResult.stdout);
if(local.API_URL!=='http://127.0.0.1:61321')throw new Error('Wrong demo API.');
const db='supabase_db_rrj_defense_demo_20261014';
if(spawnSync('docker',['inspect','-f','{{.State.Running}}',db],{encoding:'utf8'}).stdout.trim()!=='true')throw new Error('Demo database stopped.');
const base='http://127.0.0.1:58445';
const out=join(repo,'qa','defense-customer-browser-20261014');
await mkdir(out,{recursive:true});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','58445','--strictPort'],{cwd:repo,windowsHide:true,stdio:'ignore',env:{...process.env,RRJ_DEFENSE_DEMO:'1',VITE_DEMO_MODE:'true',VITE_SUPABASE_URL:local.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:local.PUBLISHABLE_KEY}});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ready=false;for(let i=0;i<100;i++){try{if((await fetch(`${base}/auth`)).ok){ready=true;break;}}catch{}await pause(150);}
if(!ready){vite.kill();throw new Error('Demo web server unavailable.');}
const profile=await mkdtemp(join(tmpdir(),'rrj-defense-customer-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-background-networking','--no-proxy-server','--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--window-size=1440,900',`${base}/auth?portal=customer`],{windowsHide:true,stdio:'ignore'});
let ws,seq=0;const pending=new Map();
function command(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evalJs(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;}
async function waitFor(expr,label){for(let i=0;i<220;i++){if(await evalJs(expr))return;await pause(150);}throw new Error(`Timed out ${label}: ${JSON.stringify(await evalJs('({body:document.body.innerText.slice(-700),url:location.href})'))}`);}
async function fill(id,value){const ok=await evalJs(`(() => {const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);if(!ok)throw new Error(`Missing input ${id}`);}
async function clickButton(label){const ok=await evalJs(`(() => {const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.includes(${JSON.stringify(label)})&&!x.disabled);if(!b)return false;b.click();return true;})()`);if(!ok)throw new Error(`Button unavailable: ${label}`);}
async function shot(name){const r=await command('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(join(out,`${name}.png`),Buffer.from(r.data,'base64'));}
function sql(q){const r=spawnSync('docker',['exec','-u','postgres',db,'psql','-U','supabase_admin','-d','postgres','-X','-v','ON_ERROR_STOP=1','-Atqc',q],{encoding:'utf8'});if(r.status!==0)throw new Error('Demo SQL check failed.');return r.stdout.trim();}
try{
  let port;for(let i=0;i<80;i++){try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0]);break;}catch{await pause(100);}}
  if(!port)throw new Error('Chrome debugger unavailable.');
  const targets=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());
  const tab=targets.find(t=>t.type==='page'&&t.url.startsWith(base));if(!tab)throw new Error('Demo browser tab unavailable.');
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);const task=pending.get(m.id);if(!task)return;pending.delete(m.id);m.error?task.reject(new Error(m.error.message)):task.resolve(m.result);});
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  await command('Page.enable');await command('Runtime.enable');
  await waitFor("Boolean(document.getElementById('demo-email'))",'demo login');
  await fill('demo-email',card.roles.customer.email);await fill('demo-password',card.roles.customer.password);
  await evalJs("document.getElementById('demo-email').closest('form').requestSubmit()");
  await waitFor("location.pathname==='/customer'&&!document.getElementById('demo-email')",'Customer route');
  await clickButton('Explore the menu');
  await waitFor("Boolean(document.querySelector('button[aria-label=\"View Fried Chicken Regular\"]'))",'sample menu');
  await evalJs("document.querySelector('button[aria-label=\"View Fried Chicken Regular\"]').click()");
  await waitFor("document.querySelector('h1')?.textContent?.includes('Fried Chicken Regular')&&document.body.innerText.includes('Extra rice')",'modifier detail');
  const selected=await evalJs("(() => {const l=[...document.querySelectorAll('label')].find(e=>e.textContent?.includes('Extra rice'));if(!l)return false;l.click();return Boolean(l.querySelector('input')?.checked);})()");
  if(!selected)throw new Error('Extra rice did not select.');
  await shot('modifier-detail');
  await clickButton('Add to Cart');
  await waitFor("document.querySelector('h1')?.textContent?.toLowerCase().includes('your cart')&&document.body.innerText.includes('Extra rice')",'modified cart');
  await shot('cart');
  await clickButton('Continue to checkout');
  await waitFor("Boolean(document.getElementById('checkout-delivery-address'))",'checkout details');
  await fill('checkout-full-name','Fictional Browser Customer');
  await fill('checkout-contact-number','09170000000');
  await fill('checkout-delivery-address','Synthetic browser demo address');
  await fill('checkout-landmark','Synthetic');
  await clickButton('Create Order & Continue to Payment');
  await waitFor("document.body.innerText.includes('DEMO ONLY — DO NOT PAY')&&Boolean(document.getElementById('checkout-gcash-reference'))",'safe demo payment screen');
  const orderNumber=await evalJs("document.body.innerText.match(/ORD-\\d{6}/)?.[0]");
  if(!/^ORD-\d{6}$/.test(orderNumber))throw new Error('Order number missing.');
  await shot('demo-payment');
  await fill('checkout-gcash-reference',`DEMO-${randomUUID()}`);
  const proof=join(runtime,'synthetic-emulator-proof.png');
  const dom=await command('DOM.getDocument');
  const input=await command('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'input[type=file]'});
  if(!input.nodeId)throw new Error('Payment proof file input missing.');
  await command('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[proof]});
  await waitFor("document.body.innerText.includes('Payment screenshot selected')",'synthetic proof selected');
  await clickButton('Submit demo payment claim');
  await waitFor("document.body.innerText.includes('Demo payment claim submitted')",'submitted payment');
  if(sql(`select current_status from public.orders where order_number='${orderNumber}'`)!=='waiting_payment_verification')throw new Error('Browser order status mismatch.');
  const line=sql(`select coalesce(order_items.modifiers::text,'') from public.order_items join public.orders on orders.id=order_items.order_id where orders.order_number='${orderNumber}' limit 1`);
  if(!line.includes('Extra rice'))throw new Error('Stored option snapshot missing.');
  await shot('payment-submitted');
  await writeFile(join(out,'result.json'),JSON.stringify({status:'PASS',orderNumber,checks:['authenticated Customer menu','selected Extra rice in detail','modified cart and checkout','server-created order','no-real-account demo payment label','synthetic image selected in browser','payment claim submitted and pending Cashier verification','server stored modifier snapshot'],boundary:'Real Chrome UI on isolated local Supabase. No real GCash settlement; Cashier and KDS actions on this order not part of this script.'},null,2));
  console.log(`PASS: browser Customer modified checkout and synthetic proof on ${orderNumber}.`);
}finally{ws?.close();chrome.kill();vite.kill();}
