import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../..');
const rider = 'C:/Users/Janmari/Downloads/RRJ-Food-House-Rider';
const adb = 'C:/Users/Janmari/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const card = JSON.parse(readFileSync(join(repo, '.tmp', 'defense-demo-20261014', 'role-accounts.private.json'), 'utf8'));
const out = join(rider, 'qa', 'rider-defense-20261014');
mkdirSync(out, { recursive: true });
function run(args) { const r=spawnSync(adb,args,{encoding:'utf8',maxBuffer:5*1024*1024}); if(r.status!==0) throw new Error(`Android emulator action failed (${args[0]}).`); return r.stdout; }
const devices=run(['devices']);
if (!devices.includes('emulator-5554\tdevice')) throw new Error('Expected Android emulator is unavailable.');
function tap(x,y) { run(['shell','input','tap',String(x),String(y)]); }
function text(value) { run(['shell','input','text',value]); }
function back() { run(['shell','input','keyevent','4']); }
function pause(ms) { return new Promise(resolve=>setTimeout(resolve,ms)); }
function tree() { run(['shell','uiautomator','dump','/sdcard/rrj-defense-ui.xml']); return run(['exec-out','cat','/sdcard/rrj-defense-ui.xml']); }
function screenshot(name) { run(['shell','screencap','-p',`/sdcard/${name}.png`]); run(['pull',`/sdcard/${name}.png`,join(out,`${name}.png`)]); }
function tapControl(ui, label) {
  const node = ui.match(new RegExp(`<node[^>]*content-desc="${label}"[^>]*>`))?.[0];
  const box = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!box) throw new Error(`Android control unavailable: ${label}`);
  tap(Math.floor((Number(box[1])+Number(box[3]))/2),Math.floor((Number(box[2])+Number(box[4]))/2));
}

let ui=tree();
if (!ui.includes('Sign in to local demo') || !ui.includes('Demo Rider email')) throw new Error('Emulator did not show local demo sign-in.');
tapControl(ui,'Demo Rider email');
run(['shell','input','keyevent','123']);
run(['shell','input','keyevent',...Array(80).fill('67')]);
text(card.roles.rider.email); back(); await pause(1200);
ui=tree(); tapControl(ui,'Demo Rider password');
ui=tree();
if (!/content-desc="Demo Rider password"[^>]*focused="true"/.test(ui)) throw new Error('Android password field did not receive focus.');
run(['shell','input','keyevent','123']);
run(['shell','input','keyevent',...Array(80).fill('67')]);
text(card.roles.rider.password); back(); await pause(1200);
ui=tree();
if (!ui.includes('Sign in to local demo')) throw new Error('Demo sign-in button disappeared before submit.');
tapControl(ui,'Sign in to local demo');
for(let i=0;i<30;i++){ await pause(1000); ui=tree(); if(ui.includes('content-desc="home"')&&ui.includes('content-desc="profile"')) break; }
if (!ui.includes('content-desc="home"') || !ui.includes('content-desc="profile"')) throw new Error('Rider emulator sign-in did not reach approved workspace.');
tapControl(ui,'home');
await pause(600);
ui=tree();
if (!ui.includes('RIDER DASHBOARD') || !ui.includes('Ready to receive delivery offers')) throw new Error('Approved Rider dashboard did not render.');
screenshot('approved-rider-home');
const offersLabel=ui.includes('content-desc="offers"')?'offers':ui.match(/content-desc="(Offers, [^"]+)"/)?.[1];
if(!offersLabel) throw new Error('Android Offers tab unavailable.');
tapControl(ui,offersLabel);
await pause(800);
ui=tree();
if (!ui.includes('Review the drop-off details before accepting')) throw new Error('Rider Offers tab failed to render.');
screenshot('offers-final');
const apk = join(rider,'releases','rrj-rider-defense-demo-20261014-v4.apk');
writeFileSync(join(out,'result.json'),JSON.stringify({status:'PASS',surface:'Android emulator',checks:['installed APK used local password Auth','approved Rider dashboard loaded','available state rendered','Offers tab rendered'],apkSha256:createHash('sha256').update(readFileSync(apk)).digest('hex'),boundary:'This smoke stops at the Offers screen. The subsequent emulator workflow is recorded in qa/DEFENSE-ANDROID-DELIVERY-20261014.json; physical camera and handset remain untested.'},null,2));
console.log('PASS: Android emulator local Auth, approved Rider dashboard, and Offers tab.');
