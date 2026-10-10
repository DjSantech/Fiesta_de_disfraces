import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb, setup, login, ticketOrder, buyer, PNG } from './helpers.js';
import { applyDiscount, roundTo500 } from '../src/services/core.js';
import { Settings, Guest, Room, Order, Ticket } from '../src/models/index.js';
import { runOrderMaintenance } from '../src/services/orders.js';

let app, api, ctx, admin;
before(startDb);
after(stopDb);
beforeEach(async () => {
  ({ app, api, ctx } = await setup());
  admin = await login(app, 'admin');
});

test('redondeo a 500 y descuento', () => {
  assert.equal(roundTo500(18750), 19000);
  assert.equal(applyDiscount(30000, 25), 22500);
  assert.equal(applyDiscount(25000, 25), 19000);
  assert.equal(applyDiscount(30000, 33), 20000);
});

test('quote: preventa, general y descuento de invitado', async () => {
  let r = await api.post('/api/public/quote').send({ kind: 'ticket', gender: 'hombre' });
  assert.deepEqual(r.body, { breakdown: { phase: 'preventa', base: 30000, isGuest: false, discountPercent: 0, discount: 0, total: 30000 }, available: true, reason: null });
  await Guest.create({ name: 'Juan', instagram: 'juan' });
  r = await api.post('/api/public/quote').send({ kind: 'ticket', gender: 'hombre', instagram: '@JUAN' });
  assert.deepEqual(r.body.breakdown, { phase: 'preventa', base: 30000, isGuest: true, discountPercent: 17, discount: 5000, total: 25000 });
  r = await api.post('/api/public/quote').send({ kind: 'room', roomNumber: 3 });
  assert.equal(r.body.breakdown.total, 500000);
  r = await api.get('/api/public/config');
  assert.equal(r.body.rooms[0].presalePrice, 250000);
  assert.equal(r.body.rooms[0].currentPrice, 250000);
  assert.equal(r.body.rooms[0].minPeople, 3);
  await Settings.updateOne({ _id: 'main' }, { $set: { presaleEndsAt: new Date(Date.now() - 1000) } });
  r = await api.post('/api/public/quote').send({ kind: 'ticket', gender: 'mujer', instagram: 'juan' });
  assert.equal(r.body.breakdown.phase, 'general');
  assert.equal(r.body.breakdown.base, 25000);
  assert.equal(r.body.breakdown.total, 20000);
  r = await api.post('/api/public/quote').send({ kind: 'room', roomNumber: 3 });
  assert.equal(r.body.breakdown.total, 600000);
  r = await api.post('/api/public/quote').send({ kind: 'ticket' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'VALIDATION_ERROR');
  assert.ok(r.body.error.details.fields.gender);
});

test('validación con mensajes en español', async () => {
  const r = await api.post('/api/public/orders').send(ticketOrder({ buyer: buyer({ cedula: '12', phone: '123' }), acceptTerms: false }));
  assert.equal(r.status, 400);
  const f = r.body.error.details.fields;
  assert.match(f['buyer.cedula'], /Cédula/);
  assert.match(f['buyer.phone'], /Celular/);
  assert.ok(f.acceptTerms);
});

test('transferencia: crear → comprobante → aprobar → tickets; una entrada por cédula', async () => {
  const body = ticketOrder();
  let r = await api.post('/api/public/orders').send(body);
  assert.equal(r.status, 201);
  assert.equal(r.body.checkoutUrl, null);
  const { token } = r.body.order;
  assert.equal(r.body.order.status, 'pending_payment');
  assert.equal(r.body.order.buyer.phoneMasked.length, 10);
  assert.equal(r.body.order.buyer.instagram, body.buyer.instagram.slice(1));

  r = await api.post(`/api/public/orders/${token}/receipt`).attach('file', Buffer.from('no es imagen, solo texto'), 'x.png');
  assert.equal(r.status, 415);
  r = await api.post(`/api/public/orders/${token}/receipt`).field('reference', 'M123').attach('file', PNG, 'c.png');
  assert.equal(r.status, 200);
  assert.equal(r.body.order.status, 'in_review');
  assert.equal(r.body.order.receiptUploaded, true);
  assert.equal(r.body.order.transferReference, 'M123');

  r = await api.post('/api/public/orders').send({ ...body });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'ALREADY_HAS_TICKET');
  assert.ok(!JSON.stringify(r.body).includes(token));

  const order = await Order.findOne({ token }).lean();
  r = await api.get(`/api/admin/orders/${order._id}/receipt`).set('Authorization', admin);
  assert.equal(r.headers['content-type'], 'image/png');
  r = await api.post(`/api/admin/orders/${order._id}/approve`).set('Authorization', admin).send({ notes: 'ok' });
  assert.equal(r.status, 200);
  assert.equal(r.body.order.status, 'paid');
  assert.equal(r.body.order.tickets.length, 1);
  assert.match(r.body.order.tickets[0].code, /^FD-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  r = await api.post(`/api/admin/orders/${order._id}/approve`).set('Authorization', admin).send({});
  assert.equal(r.body.error.code, 'INVALID_STATE');

  r = await api.get(`/api/public/orders/${token}`);
  const t = r.body.order.tickets[0];
  r = await api.get(`/api/public/tickets/${t.token}`);
  assert.equal(r.body.ticket.code, t.code);
  assert.equal(r.body.location, null);

  r = await api.post('/api/public/recover').send({ cedula: body.buyer.cedula, phone: body.buyer.phone });
  assert.equal(r.body.orders.length, 1);
  assert.equal(r.body.orders[0].token, token);
  r = await api.post('/api/public/recover').send({ cedula: body.buyer.cedula, phone: '3009999999' });
  assert.deepEqual(r.body, { orders: [] });
});

test('orden pendiente previa de la misma cédula se cancela', async () => {
  const body = ticketOrder();
  const a = await api.post('/api/public/orders').send(body);
  const b = await api.post('/api/public/orders').send(body);
  assert.equal(b.status, 201);
  assert.equal((await Order.findOne({ token: a.body.order.token })).status, 'cancelled');
});

test('Mercado Pago simulado: mock-pay aprobado es idempotente', async () => {
  let r = await api.post('/api/public/orders').send(ticketOrder({ paymentMethod: 'mercadopago' }));
  assert.equal(r.status, 201);
  assert.match(r.body.checkoutUrl, /^http:\/\/localhost:5173\/pago\/simulado\?orden=/);
  const { token } = r.body.order;
  r = await api.post(`/api/public/orders/${token}/mock-pay`).send({ outcome: 'rejected' });
  assert.equal(r.body.order.status, 'pending_payment');
  assert.equal(r.body.order.mpStatus, 'rejected');
  const [x, y] = await Promise.all([
    api.post(`/api/public/orders/${token}/mock-pay`).send({ outcome: 'approved' }),
    api.post(`/api/public/orders/${token}/mock-pay`).send({ outcome: 'approved' }),
  ]);
  assert.equal(x.body.order.status, 'paid');
  assert.equal(y.body.order.status, 'paid');
  r = await api.post(`/api/public/orders/${token}/mock-pay`).send({ outcome: 'approved' });
  assert.equal(r.body.order.tickets.length, 1);
  const order = await Order.findOne({ token }).lean();
  assert.equal(await Ticket.countDocuments({ orderId: order._id }), 1);
  r = await api.post(`/api/public/orders/${token}/verify-mp`).send({});
  assert.equal(r.body.order.status, 'paid');
});

test('habitación: apartado, ROOM_UNAVAILABLE, N tickets, expiración y conflicto', async () => {
  const roomOrder = (over = {}) => ({ ...ticketOrder({ kind: 'room', gender: null, roomNumber: 3, paymentMethod: 'mercadopago' }), ...over });
  let r = await api.post('/api/public/orders').send(roomOrder({ companions: [{ name: 'Ana Ruiz', cedula: '' }] }));
  assert.equal(r.status, 201);
  assert.equal(r.body.order.amount, 500000);
  assert.ok(r.body.order.holdExpiresAt);
  const tokenA = r.body.order.token;
  r = await api.get('/api/public/config');
  assert.equal(r.body.rooms.find((x) => x.number === 3).status, 'held');
  r = await api.post('/api/public/orders').send(roomOrder());
  assert.equal(r.body.error.code, 'ROOM_UNAVAILABLE');
  r = await api.post('/api/public/orders').send(roomOrder({ roomNumber: 1, companions: Array(5).fill({ name: 'Pepe' }) }));
  assert.equal(r.status, 400);

  r = await api.post(`/api/public/orders/${tokenA}/mock-pay`).send({ outcome: 'approved' });
  assert.equal(r.body.order.status, 'paid');
  assert.equal(r.body.order.tickets.length, 7);
  assert.equal(r.body.order.tickets[1].holderName, 'Ana Ruiz');
  assert.equal(r.body.order.tickets[2].holderName, 'Acompañante 2 · Hab. 3');
  assert.equal((await Room.findOne({ number: 3 })).booked, true);

  // Orden B aparta la 1, vence, C la toma y el pago tardío de B queda en conflicto.
  r = await api.post('/api/public/orders').send(roomOrder({ roomNumber: 1 }));
  const tokenB = r.body.order.token;
  await Order.updateOne({ token: tokenB }, { $set: { expiresAt: new Date(Date.now() - 1000), holdExpiresAt: new Date(Date.now() - 1000) } });
  await Room.updateOne({ number: 1 }, { $set: { holdExpiresAt: new Date(Date.now() - 1000) } });
  await runOrderMaintenance(ctx);
  assert.equal((await Order.findOne({ token: tokenB })).status, 'expired');
  r = await api.post('/api/public/orders').send(roomOrder({ roomNumber: 1 }));
  assert.equal(r.status, 201);
  r = await api.post(`/api/public/orders/${tokenB}/mock-pay`).send({ outcome: 'approved' });
  assert.equal(r.body.order.status, 'conflict');
  assert.equal(r.body.order.tickets.length, 0);
  r = await api.get('/api/admin/dashboard').set('Authorization', admin);
  assert.equal(r.body.alerts.conflicts, 1);
  assert.equal(r.body.rooms.booked, 1);
  assert.equal(r.body.income.rooms, 500000);
});

test('venta manual cortesía y SOLD_OUT', async () => {
  await Settings.updateOne({ _id: 'main' }, { $set: { capacity: 1 } });
  let r = await api.post('/api/admin/orders/manual').set('Authorization', admin)
    .send({ kind: 'ticket', gender: 'hombre', roomNumber: null, buyer: buyer({ instagram: '' }), companions: [], manualMethod: 'cortesia', notes: '' });
  assert.equal(r.status, 201);
  assert.equal(r.body.order.amount, 0);
  assert.equal(r.body.order.tickets[0].kind, 'cortesia');
  r = await api.post('/api/public/orders').send(ticketOrder());
  assert.equal(r.body.error.code, 'SOLD_OUT');
  r = await api.get('/api/public/config');
  assert.equal(r.body.event.soldOut, true);
});

test('reglas de invitados: preventa, general, extra, % propio y cortesía', async () => {
  const q = (g, ig) => api.post('/api/public/quote').send({ kind: 'ticket', gender: g, instagram: ig }).then((r) => r.body.breakdown);
  await Guest.create([{ name: 'Mujer', instagram: 'inv1' }, { name: 'Medio', instagram: 'inv50', discountPercent: 50 }, { name: 'Cort', instagram: 'inv100', discountPercent: 100 }]);
  assert.equal((await q('mujer', 'inv1')).total, 15000);
  assert.equal((await q('hombre', 'inv1')).total, 25000);
  assert.equal((await q('hombre', 'inv50')).total, 15000);
  assert.equal((await q('hombre', 'inv100')).total, 0);
  await Settings.updateOne({ _id: 'main' }, { $set: { presaleEndsAt: new Date(Date.now() - 1000) } });
  assert.equal((await q('mujer', 'inv1')).total, 20000);
  assert.equal((await q('hombre', 'inv1')).total, 30000);
  assert.equal((await q('hombre', 'inv1')).base, 40000);
  await Settings.updateOne({ _id: 'main' }, { $set: { guestGeneralDiscount: 5000 } });
  assert.equal((await q('mujer', 'inv1')).total, 15000);
});

test('cortesía de invitado: orden de $0 queda pagada', async () => {
  await Guest.create({ name: 'Cort', cedula: '1088777666', discountPercent: 100 });
  const r = await api.post('/api/public/orders').send(ticketOrder({ buyer: buyer({ cedula: '1088777666' }) }));
  const o = await Order.findOne().lean();
  assert.equal(o.breakdown.total, 0);
  assert.equal(o.status, 'paid', JSON.stringify(r.body));
});

test('migración de ajustes y config pública', async () => {
  await Settings.collection.updateOne({ _id: 'main' }, { $unset: { guestPresaleDiscount: '', guestGeneralDiscount: '' }, $set: { guestDiscountPercent: 25 } });
  const { ensureBaseData } = await import('../src/services/bootstrap.js');
  await ensureBaseData({ adminPassword: '' }, { warn() {} });
  const s = await Settings.collection.findOne({ _id: 'main' });
  assert.equal(s.guestPresaleDiscount, 5000);
  assert.equal(s.guestGeneralDiscount, 0);
  assert.equal(s.guestDiscountPercent, undefined);
  const r = await api.get('/api/public/config');
  assert.deepEqual(r.body.guest, { presaleDiscount: 5000, generalDiscount: 0 });
});

test('instagram opcional en pedido y quote; invitado por cédula sin instagram', async () => {
  let r = await api.post('/api/public/quote').send({ kind: 'ticket', gender: 'hombre' });
  assert.equal(r.status, 200);
  const b = buyer({ instagram: '' });
  await Guest.create({ name: 'Inv', cedula: b.cedula });
  delete b.email;
  r = await api.post('/api/public/orders').send(ticketOrder({ buyer: b }));
  assert.equal(r.status, 201);
  assert.equal(r.body.order.buyer.instagram, '');
  assert.equal(r.body.order.breakdown.isGuest, true);
});

test('migración: paymentAccounts con Daviplata pasa a Bre-B + Nequi', async () => {
  const { ensureBaseData } = await import('../src/services/bootstrap.js');
  await Settings.updateOne({}, { $set: { paymentAccounts: [{ label: 'Nequi', number: '1', holder: '' }, { label: 'DAVIPLATA', number: '1', holder: '' }] } });
  await ensureBaseData(ctx.config, ctx.logger);
  let s = await Settings.findOne().lean();
  assert.deepEqual(s.paymentAccounts.map((a) => a.label), ['Bre-B (llave)', 'Nequi']);
  await Settings.updateOne({}, { $set: { paymentAccounts: [{ label: 'Otra', number: '2', holder: '' }] } });
  await ensureBaseData(ctx.config, ctx.logger);
  s = await Settings.findOne().lean();
  assert.deepEqual(s.paymentAccounts.map((a) => a.label), ['Otra']);
});
