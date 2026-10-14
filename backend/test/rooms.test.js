// Habitaciones: 4 habitaciones, `reserved` (vendida fuera de la web) y migración de layout (layoutVersion 2).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb, setup, login, ticketOrder, buyer } from './helpers.js';
import { Room, Order, Ticket } from '../src/models/index.js';
import { ensureBaseData } from '../src/services/bootstrap.js';
import { runOrderMaintenance } from '../src/services/orders.js';
import { resetSales } from '../scripts/reset-sales.js';

let app, api, ctx, admin;
before(startDb);
after(stopDb);
beforeEach(async () => {
  ({ app, api, ctx } = await setup());
  admin = await login(app, 'admin');
});

const A = (r) => r.set('Authorization', admin);
const roomOrder = (over = {}) => ticketOrder({ kind: 'room', gender: null, roomNumber: 4, paymentMethod: 'mercadopago', ...over });
// updatedAt se ignora: los upserts de arranque lo refrescan siempre (comportamiento previo de timestamps).
const rooms = async () => Object.fromEntries((await Room.find().lean()).map(({ updatedAt, ...r }) => [r.number, r]));

// Deja la base como la de producción antes del cambio: 3 habitaciones sin layoutVersion/reserved, specs viejas y precios editados.
async function makeLegacy() {
  await Room.collection.deleteOne({ number: 4 });
  await Room.collection.updateMany({}, { $unset: { layoutVersion: '', reserved: '' } });
  await Room.collection.updateOne({ number: 2 }, { $set: { name: 'Suite Dos', beds: '2 camas king', minPeople: 4, capacity: 6, price: 430000, presalePrice: 360000, blocked: true } });
  await Room.collection.updateOne({ number: 3 }, { $set: { beds: '1 cama doble + 2 sencillas', minPeople: 5, capacity: 7, privateBathroom: true, price: 610000, presalePrice: 510000 } });
  await Room.collection.updateOne({ number: 1 }, { $set: { price: 310000, presalePrice: 260000 } });
}

test('base nueva: 4 habitaciones con specs, layoutVersion 2 y sin reservar', async () => {
  const r = await rooms();
  assert.deepEqual(Object.keys(r), ['1', '2', '3', '4']);
  for (const x of Object.values(r)) { assert.equal(x.layoutVersion, 2); assert.equal(!!x.reserved, false); }
  assert.deepEqual([r[2].minPeople, r[2].capacity, r[2].privateBathroom], [4, 6, false]);
  assert.deepEqual([r[3].minPeople, r[3].capacity, r[3].privateBathroom], [6, 8, false]);
  assert.deepEqual([r[4].minPeople, r[4].capacity, r[4].privateBathroom, r[4].presalePrice, r[4].price], [6, 8, true, 500000, 600000]);
  const cfg = await api.get('/api/public/config');
  assert.equal(cfg.body.rooms.length, 4);
  assert.ok(cfg.body.rooms.every((x) => x.status === 'available'));
  const d = await A(api.get('/api/admin/dashboard'));
  assert.equal(d.body.rooms.total, 4);
  assert.equal(d.body.rooms.peopleCapacity, 5 + 6 + 8 + 8);
});

test('migración: base existente sin layoutVersion -> hab. 1 reservada, 2/3 con specs nuevas, 4 creada, precios intactos', async () => {
  await makeLegacy();
  await ensureBaseData(ctx.config, ctx.logger);
  const r = await rooms();
  assert.equal(r[1].reserved, true);
  assert.deepEqual([r[1].beds, r[1].capacity, r[1].price, r[1].presalePrice], ['1 cama doble + 1 sencilla', 5, 310000, 260000]);
  assert.deepEqual([r[2].beds, r[2].minPeople, r[2].capacity, r[2].privateBathroom], ['Camarote de cama sencilla y cama king', 4, 6, false]);
  assert.deepEqual([r[2].name, r[2].price, r[2].presalePrice, r[2].blocked], ['Suite Dos', 430000, 360000, true]);
  assert.deepEqual([r[3].beds, r[3].minPeople, r[3].capacity, r[3].privateBathroom], ['Camarote de cama sencilla y cama king + 2 colchonetas adicionales', 6, 8, false]);
  assert.deepEqual([r[3].price, r[3].presalePrice], [610000, 510000]);
  assert.deepEqual([r[4].capacity, r[4].privateBathroom, r[4].reserved], [8, true, false]);
  for (const x of Object.values(r)) assert.equal(x.layoutVersion, 2);

  // Hab. 1 no se puede comprar (quote, orden pública, venta manual).
  let res = await api.post('/api/public/quote').send({ kind: 'room', roomNumber: 1 });
  assert.equal(res.body.available, false);
  assert.equal(res.body.reason, 'ROOM_UNAVAILABLE');
  res = await api.post('/api/public/orders').send(roomOrder({ roomNumber: 1 }));
  assert.equal(res.body.error.code, 'ROOM_UNAVAILABLE');
  res = await A(api.post('/api/admin/orders/manual')).send({ kind: 'room', gender: null, roomNumber: 1, buyer: buyer(), companions: [], manualMethod: 'efectivo', notes: '' });
  assert.equal(res.body.error.code, 'ROOM_UNAVAILABLE');
  assert.equal((await api.get('/api/public/config')).body.rooms.find((x) => x.number === 1).status, 'booked');
  // La hab. 4 sí se vende.
  res = await api.post('/api/public/orders').send(roomOrder({ roomNumber: 4 }));
  assert.equal(res.status, 201);
});

test('migración idempotente: correrla otra vez no cambia nada (ni pisa lo que edite el admin)', async () => {
  await makeLegacy();
  await ensureBaseData(ctx.config, ctx.logger);
  const first = await rooms();
  await ensureBaseData(ctx.config, ctx.logger);
  const again = await rooms();
  for (const n of [1, 2, 3, 4]) assert.deepEqual(again[n], first[n]);

  await A(api.put('/api/admin/rooms/1')).send({ reserved: false, price: 320000 });
  await A(api.put('/api/admin/rooms/3')).send({ capacity: 7, minPeople: 5 });
  await ensureBaseData(ctx.config, ctx.logger);
  const second = await rooms();
  assert.equal(second[1].reserved, false);
  assert.equal(second[1].price, 320000);
  assert.equal(second[3].capacity, 7);
  assert.equal(await Room.countDocuments(), 4);
});

test('la migración no toca una base nueva (hab. 1 sigue disponible)', async () => {
  const before = await rooms();
  await ensureBaseData(ctx.config, ctx.logger);
  assert.deepEqual(await rooms(), before);
  assert.equal(before[1].reserved, false);
});

test('migración: una orden ya pagada de la hab. 3 conserva sus tickets y su snapshot', async () => {
  await makeLegacy();
  await Room.collection.updateOne({ number: 2 }, { $set: { blocked: false } });
  const r1 = await api.post('/api/public/orders').send(roomOrder({ roomNumber: 3 }));
  assert.equal(r1.status, 201);
  const paid = await api.post(`/api/public/orders/${r1.body.order.token}/mock-pay`).send({ outcome: 'approved' });
  assert.equal(paid.body.order.tickets.length, 7);
  await ensureBaseData(ctx.config, ctx.logger);
  assert.equal(await Ticket.countDocuments({ roomNumber: 3 }), 7);
  assert.equal((await Order.findOne({ token: r1.body.order.token })).room.capacity, 7);
  assert.equal((await Room.findOne({ number: 3 })).booked, true);
});

test('reserved: PUT admin, estado "booked", no admite compras y blocked tiene prioridad', async () => {
  let res = await A(api.put('/api/admin/rooms/4')).send({ reserved: true });
  assert.equal(res.status, 200);
  assert.equal(res.body.room.reserved, true);
  assert.equal(res.body.room.status, 'booked');
  assert.equal((await A(api.get('/api/admin/rooms'))).body.items.find((x) => x.number === 4).reserved, true);
  res = await api.post('/api/public/orders').send(roomOrder({ roomNumber: 4 }));
  assert.equal(res.body.error.code, 'ROOM_UNAVAILABLE');
  res = await A(api.put('/api/admin/rooms/4')).send({ blocked: true });
  assert.equal(res.body.room.status, 'blocked');
  res = await A(api.put('/api/admin/rooms/4')).send({ blocked: false, reserved: false });
  assert.equal(res.body.room.status, 'available');
  assert.equal((await api.post('/api/public/orders').send(roomOrder({ roomNumber: 4 }))).status, 201);
  res = await A(api.put('/api/admin/rooms/2')).send({ minPeople: 9, capacity: 6 });
  assert.equal(res.status, 400);
  res = await A(api.put('/api/admin/rooms/2')).send({ reserved: 'si' });
  assert.equal(res.status, 400);
});

test('reserved sobrevive a eliminar una compra, a expirar apartados y a reset-sales', async () => {
  await Room.updateOne({ number: 1 }, { $set: { reserved: true } });
  const o = await api.post('/api/public/orders').send(roomOrder({ roomNumber: 3 }));
  await api.post(`/api/public/orders/${o.body.order.token}/mock-pay`).send({ outcome: 'approved' });
  const order = await Order.findOne({ token: o.body.order.token });
  const res = await A(api.post(`/api/admin/orders/${order._id}/delete`)).send({ reason: 'Prueba de eliminación' });
  assert.equal(res.status, 200);
  let r = await rooms();
  assert.equal(r[3].booked, false);
  assert.equal(r[1].reserved, true);

  // Mantenimiento (vence apartados): la reservada queda igual.
  await Room.updateOne({ number: 3 }, { $set: { orderId: order._id, holdExpiresAt: new Date(Date.now() - 1000) } });
  await runOrderMaintenance(ctx);
  assert.equal((await rooms())[1].reserved, true);

  // reset-sales libera lo vendido pero no `reserved`.
  const o2 = await api.post('/api/public/orders').send(roomOrder({ roomNumber: 4 }));
  await api.post(`/api/public/orders/${o2.body.order.token}/mock-pay`).send({ outcome: 'approved' });
  await Room.updateOne({ number: 2 }, { $set: { reserved: true } });
  await resetSales({ dryRun: false, reason: 'Fin de pruebas', operator: 'Test' });
  r = await rooms();
  assert.equal(r[4].booked, false);
  assert.equal(r[1].reserved, true);
  assert.equal(r[2].reserved, true);
});
