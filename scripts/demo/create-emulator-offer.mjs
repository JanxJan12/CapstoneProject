// Create one fictional delivery offer for the already approved emulator Rider.
// This intentionally stops before Rider acceptance so the Android UI can act.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repo=resolve(import.meta.dirname,'../..');
const runtime=join(repo,'.tmp','defense-demo-20261014');
const card=JSON.parse(readFileSync(join(runtime,'role-accounts.private.json'),'utf8'));
function run(exe,args,options={}) { const r=spawnSync(exe,args,{encoding:'utf8',shell:exe==='npx.cmd',...options}); if(r.status!==0) throw new Error(`${exe} failed.`); return r.stdout.trim(); }
const status=JSON.parse(run('npx.cmd',['--yes','supabase@2.120.0','status','--workdir',`"${runtime}"`,'-o','json']));
const api='http://127.0.0.1:61321';
const db='supabase_db_rrj_defense_demo_20261014';
if(status.API_URL!==api || run('docker',['inspect','-f','{{.State.Running}}',db])!=='true') throw new Error('Wrong demo stack.');
function sql(q){return run('docker',['exec','-u','postgres',db,'psql','-U','supabase_admin','-d','postgres','-X','-v','ON_ERROR_STOP=1','-Atqc',q]);}
if(sql('select count(*) from supabase_migrations.schema_migrations')!=='52') throw new Error('Wrong demo migration ledger.');
async function request(path,method,token,body,contentType){
  const headers={apikey:status.ANON_KEY,authorization:`Bearer ${token??status.ANON_KEY}`};
  if(body!==undefined) headers['content-type']=contentType??'application/json';
  const response=await fetch(api+path,{method,headers,body:body===undefined?undefined:contentType?body:JSON.stringify(body),redirect:'error'});
  const raw=await response.text(); let value; try{value=JSON.parse(raw);}catch{value=raw;}
  if(!response.ok) throw new Error(`${path} HTTP ${response.status} ${value?.code??''}`);
  return value;
}
async function login(role){const a=card.roles[role];const v=await request('/auth/v1/token?grant_type=password','POST',null,{email:a.email,password:a.password});if(v.user?.id!==a.id)throw new Error(`${role} Auth mismatch`);return v.access_token;}
async function rpc(name,args,token){return request(`/rest/v1/rpc/${name}`,'POST',token,args);}
function one(v,label){if(!Array.isArray(v)||v.length!==1)throw new Error(`${label} result mismatch`);return v[0];}
const customer=await login('customer'), cashier=await login('cashier');
const menuId=sql(`select m.id from public.menu_items m join public.get_menu_effective_availability() a on a.menu_item_id=m.id where a.effective_available and m.is_active and m.is_available and m.name='Fried Chicken Regular' limit 1`);
if(!/^[0-9a-f-]{36}$/.test(menuId))throw new Error('Sample menu unavailable.');
const order=one(await rpc('place_customer_order',{p_request_id:randomUUID(),p_customer_name:'Fictional Emulator Rider',p_contact_number:'09170000000',p_delivery_address:'Synthetic defense demo address',p_landmark:'Synthetic',p_items:[{id:menuId,qty:1,modifier_ids:['extra-rice']}]},customer),'order');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX+8AAAAASUVORK5CYII=','base64');
const proofPath=`${card.roles.customer.id}/${order.order_id}/${randomUUID()}.png`;
await request(`/storage/v1/object/payment-proofs/${proofPath}`,'POST',customer,png,'image/png');
const payment=one(await rpc('submit_customer_payment',{p_order_id:order.order_id,p_gcash_reference_number:`DEMO-${randomUUID()}`,p_proof_image_path:proofPath},customer),'payment');
if(sql(`select count(*) from public.cashier_shifts where cashier_id='${card.roles.cashier.id}' and status='open'`)==='0') one(await rpc('start_cashier_shift',{p_terminal:'DEFENSE-ANDROID',p_opening_cash:0},cashier),'shift');
const verified=one(await rpc('verify_customer_gcash_payment',{p_request_id:randomUUID(),p_payment_id:payment.payment_id},cashier),'verification');
if(verified.order_status!=='confirmed')throw new Error('Synthetic payment not internally verified.');
const terminal={p_terminal_id:card.terminal.id,p_terminal_secret:card.terminal.secret};
one(await rpc('advance_kds_order',{...terminal,p_order_id:order.order_id,p_expected_status:'confirmed'},null),'preparing');
one(await rpc('advance_kds_order',{...terminal,p_order_id:order.order_id,p_expected_status:'preparing'},null),'ready');
const others=sql(`select coalesce(string_agg(id::text,','),'') from public.riders where availability_status='available' and id<>'${card.roles.rider.id}'`).split(',').filter(Boolean);
if(!others.every(id=>/^[0-9a-f-]{36}$/.test(id)))throw new Error('Unexpected Rider IDs.');
if(others.length)sql(`update public.riders set availability_status='offline' where id in (${others.map(id=>`'${id}'`).join(',')})`);
let assignmentId;
try{
  one(await rpc('release_ready_order',{p_order_id:order.order_id},cashier),'release');
  assignmentId=sql(`select id from public.delivery_assignments where order_id='${order.order_id}' and status='offered' limit 1`);
  if(!assignmentId)assignmentId=one(await rpc('offer_order_to_next_rider',{p_order_id:order.order_id},cashier),'offer').assignment_id;
}
finally{if(others.length)sql(`update public.riders set availability_status='available' where id in (${others.map(id=>`'${id}'`).join(',')})`);}
if(sql(`select rider_id from public.delivery_assignments where id='${assignmentId}'`)!==card.roles.rider.id)throw new Error('Offer assigned to a different Rider.');
writeFileSync(join(repo,'qa','DEFENSE-ANDROID-OFFER-SETUP-20261014.json'),JSON.stringify({status:'PASS',orderNumber:order.order_number,assignmentId,boundary:'Local synthetic offer prepared by API; Rider UI acceptance has not occurred.'},null,2));
console.log(`PASS: local synthetic offer ready for emulator on ${order.order_number}.`);
