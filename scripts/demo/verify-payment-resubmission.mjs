import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../..');
const runtime = join(repo, '.tmp', 'defense-demo-20261014');
const card = JSON.parse(readFileSync(join(runtime, 'role-accounts.private.json'), 'utf8'));
const fixture = JSON.parse(readFileSync(join(runtime, 'demo-fixture-manifest.private.json'), 'utf8'));
const statusResult = spawnSync('npx.cmd', ['--yes','supabase@2.120.0','status','--workdir',`"${runtime}"`,'-o','json'], { encoding:'utf8',shell:true });
if (statusResult.status !== 0) throw new Error('Demo stack unavailable.');
const status = JSON.parse(statusResult.stdout);
if (status.API_URL !== 'http://127.0.0.1:61321') throw new Error('Wrong demo endpoint.');
async function call(path, body, token, contentType='application/json') {
  const response = await fetch(status.API_URL + path, { method:'POST', redirect:'error', headers:{ apikey:status.PUBLISHABLE_KEY, authorization:`Bearer ${token}`, 'content-type':contentType }, body:contentType==='application/json' ? JSON.stringify(body) : body });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path} HTTP ${response.status} ${value?.code ?? ''} ${value?.message ?? ''}`);
  return value;
}
async function signIn(role) { const c=card.roles[role]; const v=await call('/auth/v1/token?grant_type=password',{email:c.email,password:c.password},status.ANON_KEY); if(!v.access_token) throw new Error(`${role} sign-in failed`); return v.access_token; }
const customer=await signIn('customer'); const cashier=await signIn('cashier');
const rpc=(name,body,token)=>call(`/rest/v1/rpc/${name}`,body,token);
await rpc('start_cashier_shift',{p_terminal:`RESUB-${randomUUID().slice(0,8)}`,p_opening_cash:0},cashier);
const order=(await rpc('place_customer_order',{p_request_id:randomUUID(),p_customer_name:'Synthetic resubmission demo',p_contact_number:'09170000000',p_delivery_address:'Synthetic defense address',p_landmark:null,p_items:[{id:fixture.menuId,qty:1,modifier_ids:['extra-rice']}]},customer))[0];
if (!order?.order_id) throw new Error('Customer order missing.');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX+8AAAAASUVORK5CYII=','base64');
async function submit(label) {
  const path=`${card.roles.customer.id}/${order.order_id}/${randomUUID()}.png`;
  await call(`/storage/v1/object/payment-proofs/${path}`,png,customer,'image/png');
  return (await rpc('submit_customer_payment',{p_order_id:order.order_id,p_gcash_reference_number:`DEMO-${label}-${randomUUID()}`,p_proof_image_path:path},customer))[0];
}
const first=await submit('first');
const rejected=(await rpc('reject_customer_gcash_payment',{p_payment_id:first.payment_id,p_reason:'Unreadable Proof',p_notes:'Synthetic defense resubmission'},cashier))[0];
if (rejected?.payment_status!=='rejected') throw new Error('Cashier rejection did not persist.');
const second=await submit('resubmitted');
if (!second?.payment_id) throw new Error('Customer resubmission failed.');
const verified=(await rpc('verify_customer_gcash_payment',{p_request_id:randomUUID(),p_payment_id:second.payment_id},cashier))[0];
if (verified?.order_status!=='confirmed') throw new Error('Resubmitted payment did not confirm order.');
const evidence={status:'PASS',orderNumber:order.order_number,firstPayment:'rejected',secondPayment:'verified',finalOrderStatus:'confirmed',boundary:'Local synthetic proof submission only; no external GCash settlement.'};
writeFileSync(join(repo,'qa','DEFENSE-GCASH-RESUBMISSION-20261014.json'),JSON.stringify(evidence,null,2));
console.log('PASS: isolated GCash rejection, new proof resubmission, and Cashier verification.');
