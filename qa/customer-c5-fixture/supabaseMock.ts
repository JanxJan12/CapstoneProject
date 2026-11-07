const params = new URLSearchParams(window.location.search);
const scenario = params.get('scenario') ?? 'p1';
const orderId = '11111111-1111-4111-8111-111111111111';
const now = '2026-11-03T08:00:00.000Z';
const paymentId = '22222222-2222-4222-8222-222222222222';

const cases: Record<string, { type: string; status: string; payment: string | null }> = {
  p1: { type: 'delivery', status: 'waiting_payment_verification', payment: null },
  p2: { type: 'delivery', status: 'waiting_payment_verification', payment: 'pending' },
  p3: { type: 'delivery', status: 'waiting_payment_verification', payment: 'rejected' },
  p4: { type: 'delivery', status: 'waiting_payment_verification', payment: 'rejected' },
  p5: { type: 'delivery', status: 'cancelled', payment: 'rejected' },
  t1: { type: 'takeout', status: 'completed', payment: 'verified' },
  t2: { type: 'dine_in', status: 'completed', payment: 'verified' },
  t3: { type: 'delivery', status: 'rider_accepted', payment: 'verified' },
  t4: { type: 'delivery', status: 'delivered', payment: 'verified' },
  t5: { type: 'takeout', status: 'cancelled', payment: 'verified' },
  t6: { type: 'takeout', status: 'waiting_payment_verification', payment: 'pending' },
  empty: { type: 'delivery', status: 'waiting_payment_verification', payment: null },
  error: { type: 'delivery', status: 'waiting_payment_verification', payment: null },
};
let state = cases[scenario] ?? cases.p1;
if (scenario === 'p4' && sessionStorage.getItem('c5-p4-payment') === 'pending') {
  state = { ...state, payment: 'pending' };
}
let errorMode = scenario === 'error';
let emptyMode = scenario === 'empty';

const order = () => ({ id: orderId, order_number: 'SYN-C5-001', current_status: state.status,
  fulfillment_type: state.type, subtotal: 150, delivery_fee: state.type === 'delivery' ? 30 : 0,
  tax_amount: 0, grand_total: state.type === 'delivery' ? 180 : 150, created_at: now });
const payment = () => state.payment === null ? [] : [{ payment_id: paymentId, order_id: orderId,
  amount: order().grand_total, payment_method: 'gcash', gcash_reference_number: 'DEMO-C5-REFERENCE',
  payment_status: state.payment, rejection_reason: state.payment === 'rejected' ? 'Unreadable proof' : null,
  rejection_notes: state.payment === 'rejected' ? 'Please submit a clearer image.' : null,
  rejected_at: state.payment === 'rejected' ? now : null, created_at: now, updated_at: now }];
const history = () => {
  const prefix = state.status === 'waiting_payment_verification' ? ['waiting_payment_verification']
    : state.status === 'cancelled' ? ['waiting_payment_verification', 'cancelled']
    : state.type !== 'delivery' ? ['waiting_payment_verification', 'confirmed', 'preparing', 'ready', 'completed']
    : state.status === 'rider_accepted' ? ['waiting_payment_verification', 'confirmed', 'preparing', 'ready', 'waiting_for_rider', 'rider_accepted']
    : ['waiting_payment_verification', 'confirmed', 'preparing', 'ready', 'waiting_for_rider', 'rider_accepted', 'picked_up', 'out_for_delivery', 'delivered'];
  return prefix.map((status) => ({ status, notes: null, created_at: now }));
};
const items = () => [{ order_id: orderId, item_name: 'Synthetic meal', quantity: 1,
  unit_price: 150, line_total: 150, modifiers: [] }];

class Query {
  table: string;
  constructor(table: string) { this.table = table; }
  select() { return this; }
  eq() { return this; }
  in() { return this; }
  order() { return this; }
  limit() { return this; }
  single() { return this; }
  maybeSingle() { return this; }
  then(resolve: (value: unknown) => void) {
    if (errorMode && this.table === 'orders') return Promise.resolve({ data: null, error: { message: 'Synthetic fixture read failed' } }).then(resolve);
    const data = this.table === 'orders' ? (emptyMode ? [] : [order()])
      : this.table === 'order_status_history' ? history() : items();
    return Promise.resolve({ data, error: null }).then(resolve);
  }
}

export const supabase = {
  from(table: string) { return new Query(table); },
  async rpc(name: string) {
    if (name === 'get_customer_order_payment') return { data: payment(), error: null };
    throw new Error(`Fixture forbids writer RPC ${name}`);
  },
  channel() { const channel = { on() { return channel; }, subscribe(callback: (status: string) => void) {
    setTimeout(() => callback('SUBSCRIBED'), 0); return channel;
  } }; return channel; },
  async removeChannel() { return 'ok'; },
  auth: { async getUser() { return { data: { user: null }, error: null }; } },
  storage: { from() { throw new Error('Fixture forbids Storage writes'); } },
};

Object.assign(window, { __c5fixture: {
  scenario, setPayment(next: string | null) {
    state = { ...state, payment: next };
    if (scenario === 'p4') sessionStorage.setItem('c5-p4-payment', next ?? '');
  },
  setError(next: boolean) { errorMode = next; }, setEmpty(next: boolean) { emptyMode = next; },
} });
