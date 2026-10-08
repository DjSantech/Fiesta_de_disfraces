import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { startDb, stopDb, setup, ticketOrder } from './helpers.js';
import { Order } from '../src/models/index.js';
import { drainBackground } from '../src/lib/util.js';
import { buildPreferenceBody } from '../src/services/mercadopago.js';

const SECRET = 'secreto-de-prueba';
const payments = new Map();
const fakeMp = {
  enabled: true,
  mock: false,
  calls: 0,
  async createPreference(order) { return { id: `pref-${order._id}`, url: 'https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=x' }; },
  async getPayment(id) { fakeMp.calls++; return payments.get(String(id)) ?? null; },
  async searchPayments(ref) { return [...payments.values()].filter((p) => p.external_reference === ref); },
};

let api;
before(startDb);
after(stopDb);
beforeEach(async () => {
  payments.clear();
  fakeMp.calls = 0;
  ({ api } = await setup({ env: { MP_ACCESS_TOKEN: 'TEST-x', MP_WEBHOOK_SECRET: SECRET }, mp: fakeMp }));
});

function sign(dataId, requestId, ts = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac('sha256', SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

async function mpOrder() {
  const r = await api.post('/api/public/orders').send(ticketOrder({ paymentMethod: 'mercadopago' }));
  assert.equal(r.status, 201);
  assert.match(r.body.checkoutUrl, /mercadopago/);
  const order = await Order.findOne({ token: r.body.order.token }).lean();
  payments.set('555', { id: 555, status: 'approved', status_detail: 'accredited', currency_id: 'COP', transaction_amount: order.amount, external_reference: String(order._id) });
  return order;
}

test('webhook con firma válida confirma el pago (re-consultando a MP)', async () => {
  const order = await mpOrder();
  const r = await api.post('/api/public/payments/mercadopago/webhook?data.id=555&type=payment')
    .set('x-signature', sign('555', 'req-1')).set('x-request-id', 'req-1')
    .send({ type: 'payment', action: 'payment.updated', data: { id: '555' } });
  assert.equal(r.status, 200);
  await drainBackground();
  const o = await Order.findById(order._id).lean();
  assert.equal(o.status, 'paid');
  assert.equal(o.mp.status, 'approved');
  assert.equal(fakeMp.calls, 1);
  const pub = await api.get(`/api/public/orders/${o.token}`);
  assert.equal(pub.body.order.tickets.length, 1);
});

test('webhook con firma inválida se rechaza y no consulta a MP', async () => {
  const order = await mpOrder();
  const r = await api.post('/api/public/payments/mercadopago/webhook?data.id=555&type=payment')
    .set('x-signature', sign('555', 'otro-request')).set('x-request-id', 'req-1')
    .send({ type: 'payment', data: { id: '555' } });
  assert.equal(r.status, 401);
  await drainBackground();
  assert.equal(fakeMp.calls, 0);
  assert.equal((await Order.findById(order._id).lean()).status, 'pending_payment');
  const r2 = await api.post('/api/public/payments/mercadopago/webhook?data.id=555&type=payment').send({ type: 'payment' });
  assert.equal(r2.status, 401);
});

test('verify-mp: pago de otro monto queda en conflicto; búsqueda por external_reference', async () => {
  const order = await mpOrder();
  payments.get('555').transaction_amount = 1000;
  let r = await api.post(`/api/public/orders/${order.token}/verify-mp`).send({ paymentId: '555' });
  assert.equal(r.body.order.status, 'conflict');
  const order2 = await mpOrder();
  r = await api.post(`/api/public/orders/${order2.token}/verify-mp`).send({});
  assert.equal(r.body.order.status, 'paid');
  assert.equal((await api.post(`/api/public/orders/${order2.token}/mock-pay`).send({ outcome: 'approved' })).status, 404);
});

test('preferencia: COP, back_urls y sin auto_return/notification_url en http', async () => {
  const order = await mpOrder();
  const body = buildPreferenceBody({ frontendBaseUrl: 'http://localhost:5173', backendPublicUrl: 'http://localhost:4000' }, order);
  assert.equal(body.items[0].currency_id, 'COP');
  assert.equal(body.external_reference, String(order._id));
  assert.equal(body.back_urls.success, `http://localhost:5173/pago/resultado?orden=${order.token}`);
  assert.equal(body.auto_return, undefined);
  assert.equal(body.notification_url, undefined);
  const https = buildPreferenceBody({ frontendBaseUrl: 'https://f.pages.dev', backendPublicUrl: 'https://api.onrender.com' }, order);
  assert.equal(https.auto_return, 'approved');
  assert.equal(https.notification_url, 'https://api.onrender.com/api/public/payments/mercadopago/webhook');
});

test('rate limit con formato del contrato', async () => {
  const { api: limited } = await setup({ rateLimits: true });
  let last;
  for (let i = 0; i < 6; i++) last = await limited.post('/api/public/recover').send({ cedula: '1088123456', phone: '3001234567' });
  assert.equal(last.status, 429);
  assert.equal(last.body.error.code, 'RATE_LIMITED');
});
