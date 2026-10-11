import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb, setup, login, ticketOrder, PNG } from './helpers.js';
import { Order, Ticket, Receipt, Room, Guest, AuditLog } from '../src/models/index.js';

let app, api, admin, puerta, barra;
before(startDb);
after(stopDb);
beforeEach(async () => {
  ({ app, api } = await setup());
  [admin, puerta, barra] = await Promise.all([login(app, 'admin'), login(app, 'puerta'), login(app, 'barra')]);
});

const A = (r) => r.set('Authorization', admin);
async function paidTransfer(over = {}) {
  const body = ticketOrder(over);
  const r = await api.post('/api/public/orders').send(body);
  const { token } = r.body.order;
  await api.post(`/api/public/orders/${token}/receipt`).field('reference', 'M1').attach('file', PNG, 'c.png');
  const order = await Order.findOne({ token });
  await A(api.post(`/api/admin/orders/${order._id}/approve`)).send({});
  return { order: await Order.findById(order._id), body, token };
}
async function paidMp(over = {}) {
  const r = await api.post('/api/public/orders').send(ticketOrder({ paymentMethod: 'mercadopago', ...over }));
  await api.post(`/api/public/orders/${r.body.order.token}/mock-pay`).send({ outcome: 'approved' });
  return Order.findOne({ token: r.body.order.token });
}
const del = (id, reason = 'Compra de prueba') => A(api.post(`/api/admin/orders/${id}/delete`)).send({ reason });

test('eliminar compra de transferencia: borra todo y deja auditoría mínima', async () => {
  const { order, body, token } = await paidTransfer();
  const code = (await Ticket.findOne({ orderId: order._id })).code;
  assert.ok(await Receipt.findOne({ orderId: order._id }));
  assert.equal((await A(api.post(`/api/admin/orders/${order._id}/delete`)).send({})).status, 400);
  assert.equal((await del(order._id, 'ab')).status, 400);
  const r = await del(order._id);
  assert.equal(r.status, 200);
  assert.equal(r.body.deleted.tickets, 1);
  assert.equal(r.body.deleted.roomReleased, null);
  assert.equal(r.body.deleted.guestUnredeemed, false);
  assert.equal(await Order.countDocuments(), 0);
  assert.equal(await Ticket.countDocuments(), 0);
  assert.equal(await Receipt.countDocuments(), 0);
  const logs = await AuditLog.find().lean();
  assert.equal(logs.length, 1);
  const l = logs[0];
  assert.equal(l.action, 'order.delete');
  assert.equal(l.actor.username, 'admin');
  assert.equal(l.reason, 'Compra de prueba');
  assert.equal(l.target.summary.buyerName, body.buyer.name);
  assert.equal(l.target.summary.cedulaLast4, body.buyer.cedula.slice(-4));
  assert.deepEqual(l.target.summary.ticketCodes, [code]);
  const raw = JSON.stringify(l);
  assert.ok(!raw.includes(body.buyer.cedula));
  assert.ok(!raw.includes(body.buyer.phone));
  assert.ok(!raw.includes(token));
  assert.equal((await api.get(`/api/public/orders/${token}`)).status, 404);
});

test('eliminar compra de habitación libera la habitación', async () => {
  const o = await paidMp({ kind: 'room', gender: null, roomNumber: 3 });
  assert.equal((await Room.findOne({ number: 3 })).booked, true);
  const r = await del(o._id);
  assert.equal(r.body.deleted.roomReleased, 3);
  assert.ok(r.body.deleted.tickets > 1);
  const room = await Room.findOne({ number: 3 });
  assert.equal(room.booked, false);
  assert.equal(room.orderId, null);
});

test('eliminar compra de invitado deja al invitado sin redimir', async () => {
  const g = await Guest.create({ name: 'Juan', instagram: 'juan', discountPercent: 100 });
  const o = await paidMp({ buyer: { name: 'Juan P', cedula: '99887766', phone: '3001234567', instagram: '@juan', email: '' } });
  assert.equal((await Guest.findById(g._id)).redeemed, true);
  const r = await del(o._id);
  assert.equal(r.body.deleted.guestUnredeemed, true);
  const g2 = await Guest.findById(g._id);
  assert.equal(g2.redeemed, false);
  assert.equal(g2.redeemedOrderId, null);
});

test('bloquea con HAS_CHECKINS y delete-many mezcla borrables y bloqueadas', async () => {
  const a = await paidMp();
  const b = await paidMp();
  const t = await Ticket.findOne({ orderId: b._id });
  const ci = await api.post('/api/door/checkin').set('Authorization', puerta).send({ ticketId: String(t._id) });
  assert.equal(ci.status, 201);
  let r = await del(b._id);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'HAS_CHECKINS');
  assert.ok(await Order.exists({ _id: b._id }));
  r = await A(api.post('/api/admin/orders/delete-many')).send({ ids: [String(a._id), String(b._id), '64b000000000000000000000'], reason: 'Limpieza de pruebas' });
  assert.equal(r.status, 200);
  assert.equal(r.body.deleted, 1);
  assert.deepEqual(r.body.skipped.map((s) => s.code).sort(), ['HAS_CHECKINS', 'NOT_FOUND']);
  const logs = await AuditLog.find({ action: 'order.delete' }).lean();
  assert.equal(logs.length, 1);
  assert.ok(logs[0].meta.batch);
  assert.equal((await A(api.post('/api/admin/orders/delete-many')).send({ ids: [], reason: 'xxx' })).status, 400);
  // Tras deshacer el ingreso ya se puede borrar.
  await A(api.post(`/api/admin/tickets/${t._id}/restore`)).send({});
  assert.equal((await del(b._id)).status, 200);
});

test('404 inexistente y rol no admin recibe 403', async () => {
  assert.equal((await del('64b000000000000000000000')).status, 404);
  const o = await paidMp();
  for (const tk of [puerta, barra]) {
    assert.equal((await api.post(`/api/admin/orders/${o._id}/delete`).set('Authorization', tk).send({ reason: 'prueba' })).status, 403);
    assert.equal((await api.get('/api/admin/audit').set('Authorization', tk)).status, 403);
  }
  assert.ok(await Order.exists({ _id: o._id }));
  assert.equal(await AuditLog.countDocuments(), 0);
});

test('GET /audit filtra, busca y pagina; ticket.void deja registro', async () => {
  const o1 = await paidMp({ buyer: { name: 'Laura Gómez', cedula: '11122233', phone: '3001110001', instagram: '', email: '' } });
  const o2 = await paidMp({ buyer: { name: 'Pedro Ruiz', cedula: '44455566', phone: '3001110002', instagram: '', email: '' } });
  const t = await Ticket.findOne({ orderId: o2._id });
  const v = await A(api.post(`/api/admin/tickets/${t._id}/void`)).send({ reason: 'Duplicada' });
  assert.equal(v.status, 200);
  await A(api.post(`/api/admin/tickets/${t._id}/restore`)).send({});
  await del(o1._id, 'Prueba interna');
  const guest = await Guest.create({ name: 'Zoe', instagram: 'zoe' });
  await A(api.delete(`/api/admin/guests/${guest._id}`));
  let r = await A(api.get('/api/admin/audit'));
  assert.equal(r.body.total, 4);
  assert.deepEqual(r.body.items.map((i) => i.action), ['guest.delete', 'order.delete', 'ticket.restore', 'ticket.void']);
  assert.equal(r.body.items[3].reason, 'Duplicada');
  assert.equal(r.body.items[3].target.summary.code, t.code);
  r = await A(api.get('/api/admin/audit?action=ticket.void'));
  assert.equal(r.body.total, 1);
  r = await A(api.get('/api/admin/audit?q=laura'));
  assert.equal(r.body.total, 1);
  r = await A(api.get('/api/admin/audit?q=prueba%20interna'));
  assert.equal(r.body.total, 1);
  r = await A(api.get('/api/admin/audit?q=' + encodeURIComponent('.*')));
  assert.equal(r.body.total, 0);
  r = await A(api.get('/api/admin/audit?limit=2&page=2'));
  assert.equal(r.body.items.length, 2);
  assert.equal(r.body.page, 2);
  assert.equal(r.body.limit, 2);
  assert.equal((await A(api.get('/api/admin/audit?action=nada'))).status, 400);
});
