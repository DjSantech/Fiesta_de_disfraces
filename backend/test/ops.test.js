import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb, setup, login, ticketOrder, buyer } from './helpers.js';
import { Guest } from '../src/models/index.js';

let app, api, admin, puerta, barra;
before(startDb);
after(stopDb);
beforeEach(async () => {
  ({ app, api } = await setup());
  [admin, puerta, barra] = await Promise.all([login(app, 'admin'), login(app, 'puerta'), login(app, 'barra')]);
});

async function paidTicket(over = {}) {
  const r = await api.post('/api/public/orders').send(ticketOrder({ paymentMethod: 'mercadopago', ...over }));
  const p = await api.post(`/api/public/orders/${r.body.order.token}/mock-pay`).send({ outcome: 'approved' });
  return p.body.order.tickets[0];
}

test('roles y auth', async () => {
  assert.equal((await api.get('/api/admin/dashboard')).status, 401);
  assert.equal((await api.get('/api/admin/dashboard').set('Authorization', puerta)).body.error.code, 'FORBIDDEN');
  assert.equal((await api.get('/api/door/stats').set('Authorization', barra)).status, 403);
  assert.equal((await api.get('/api/bar/products').set('Authorization', puerta)).status, 403);
  assert.equal((await api.get('/api/door/stats').set('Authorization', admin)).status, 200);
  const bad = await api.post('/api/auth/login').send({ username: 'nadie', password: 'x' });
  assert.equal(bad.body.error.code, 'INVALID_CREDENTIALS');
  const me = await api.get('/api/auth/me').set('Authorization', puerta);
  assert.equal(me.body.user.role, 'puerta');
  assert.equal(me.body.user.passwordHash, undefined);
  // Usuario desactivado pierde la sesión de inmediato.
  const users = await api.get('/api/admin/users').set('Authorization', admin);
  const p = users.body.items.find((u) => u.username === 'puerta');
  await api.put(`/api/admin/users/${p.id}`).set('Authorization', admin).send({ active: false });
  assert.equal((await api.get('/api/door/stats').set('Authorization', puerta)).status, 401);
  const dup = await api.post('/api/admin/users').set('Authorization', admin).send({ username: 'barra', name: 'Otra', password: '12345678', role: 'barra' });
  assert.equal(dup.body.error.code, 'USERNAME_TAKEN');
});

test('escaneo y check-in de un solo uso (concurrente)', async () => {
  const t = await paidTicket();
  let r = await api.post('/api/door/scan').set('Authorization', puerta).send({ value: `https://fiesta.pages.dev/entrada/${t.token}` });
  assert.equal(r.body.result, 'valid');
  const ticketId = r.body.ticket.id;
  r = await api.post('/api/door/scan').set('Authorization', puerta).send({ value: t.code.toLowerCase().replace(/-/g, ' ') });
  assert.equal(r.body.result, 'valid');
  r = await api.post('/api/door/scan').set('Authorization', puerta).send({ value: 'basura' });
  assert.equal(r.body.result, 'not_found');

  const [a, b] = await Promise.all([
    api.post('/api/door/checkin').set('Authorization', puerta).send({ ticketId, vehicle: { type: 'moto', plate: 'abc-12d' }, helmet: { stored: true, tag: '12' } }),
    api.post('/api/door/checkin').set('Authorization', puerta).send({ ticketId }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  const ok = a.status === 201 ? a : b;
  const ko = a.status === 201 ? b : a;
  assert.equal(ko.body.error.code, 'TICKET_ALREADY_USED');
  assert.equal(ko.body.error.details.checkedInByName, 'Portería');
  if (ok === a) assert.equal(a.body.entry.totalAmount, 10000);
  r = await api.post('/api/door/checkin').set('Authorization', puerta).send({ ticketId });
  assert.equal(r.status, 409);
  r = await api.post('/api/door/scan').set('Authorization', puerta).send({ value: t.token });
  assert.equal(r.body.result, 'used');
  assert.ok(r.body.entry);

  // Deshacer check-in desde admin.
  r = await api.post(`/api/admin/tickets/${ticketId}/restore`).set('Authorization', admin);
  assert.equal(r.body.ticket.status, 'valid');
  r = await api.post(`/api/admin/tickets/${ticketId}/void`).set('Authorization', admin).send({ reason: 'fraude' });
  r = await api.post('/api/door/checkin').set('Authorization', puerta).send({ ticketId });
  assert.equal(r.body.error.code, 'TICKET_VOID');
});

test('venta en puerta: invitado + carro + casco y ALREADY_HAS_TICKET', async () => {
  await Guest.create({ name: 'Pedro Gil', cedula: '1088999888', discountPercent: 50 });
  let r = await api.post('/api/door/sale').set('Authorization', puerta).send({
    name: 'Pedro Gil', cedula: '1088999888', phone: '', category: 'invitado', gender: 'hombre', paymentMethod: 'nequi',
    vehicle: { type: 'carro', plate: 'XYZ123' }, helmet: { stored: true, tag: '7' }, notes: '',
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.entry.entryAmount, 20000);
  assert.equal(r.body.entry.parkingAmount, 10000);
  assert.equal(r.body.entry.helmetAmount, 5000);
  assert.equal(r.body.entry.totalAmount, 35000);
  assert.equal(r.body.entry.guestListMatch, true);
  r = await api.post('/api/door/sale').set('Authorization', puerta).send({ name: 'Lola', cedula: '1077000111', category: 'invitado', gender: 'mujer', paymentMethod: 'efectivo' });
  assert.equal(r.body.entry.entryAmount, 20000);
  assert.equal(r.body.entry.guestListMatch, false);
  r = await api.post('/api/door/sale').set('Authorization', puerta).send({ name: 'Ana', phone: '3001112233', category: 'mujer', paymentMethod: 'cortesia', vehicle: { type: 'moto', plate: 'AAA11A' } });
  assert.equal(r.body.entry.totalAmount, 0);
  r = await api.post('/api/door/sale').set('Authorization', puerta).send({ name: 'Sin datos', category: 'invitado', paymentMethod: 'efectivo' });
  assert.ok(r.body.error.details.fields.cedula && r.body.error.details.fields.gender);

  const b = buyer();
  const t = await paidTicket({ buyer: b });
  r = await api.post('/api/door/sale').set('Authorization', puerta).send({ name: 'Xavi', cedula: b.cedula, category: 'hombre', paymentMethod: 'efectivo' });
  assert.equal(r.body.error.code, 'ALREADY_HAS_TICKET');
  assert.ok(r.body.error.details.ticketId);
  r = await api.get('/api/door/stats').set('Authorization', puerta);
  assert.equal(r.body.inside, 3);
  assert.equal(r.body.money.total, 55000);
  assert.equal(r.body.tickets.pending, 1);
  r = await api.get('/api/door/lookup?q=pedro').set('Authorization', puerta);
  assert.equal(r.body.entries.length, 1);
  assert.ok(t.code);
});

test('barra: venta, stock, cortesía, anulación y resumen', async () => {
  let r = await api.post('/api/bar/products').set('Authorization', barra).send({ name: 'Gatorade', category: 'gatorade', price: 6000, cost: 3500, stock: 2 });
  const g = r.body.product;
  r = await api.post('/api/bar/products').set('Authorization', barra).send({ name: 'Mojito', category: 'cocteles', price: 18000 });
  const m = r.body.product;
  r = await api.post('/api/bar/sales').set('Authorization', barra).send({ items: [{ productId: g.id, qty: 2 }, { productId: m.id, qty: 1 }], paymentMethod: 'efectivo' });
  assert.equal(r.status, 201);
  assert.equal(r.body.sale.total, 30000);
  assert.equal(r.body.sale.number, 1);
  assert.deepEqual(r.body.warnings, ['Gatorade quedó sin stock']);
  const saleId = r.body.sale.id;
  r = await api.post('/api/bar/sales').set('Authorization', barra).send({ items: [{ productId: g.id, qty: 1 }], paymentMethod: 'cortesia' });
  assert.equal(r.body.sale.total, 0);
  assert.equal(r.body.sale.courtesyValue, 6000);
  assert.equal(r.body.sale.number, 2);
  assert.match(r.body.warnings[0], /negativo/);
  r = await api.post(`/api/bar/sales/${saleId}/void`).set('Authorization', barra).send({ reason: 'error' });
  assert.equal(r.body.sale.voided, true);
  r = await api.get('/api/bar/products').set('Authorization', barra);
  assert.equal(r.body.items.find((p) => p.id === g.id).stock, 1);
  r = await api.get('/api/bar/summary').set('Authorization', barra);
  assert.equal(r.body.total, 0);
  assert.equal(r.body.count, 1);
  assert.deepEqual(r.body.courtesy, { count: 1, value: 6000 });
  assert.equal(r.body.byProduct[0].cost, 3500);
  await api.delete(`/api/bar/products/${m.id}`).set('Authorization', barra).expect(204);
  r = await api.post('/api/bar/sales').set('Authorization', barra).send({ items: [{ productId: m.id, qty: 1 }], paymentMethod: 'efectivo' });
  assert.equal(r.status, 400);
});

test('CSV con BOM, ; y sin inyección de fórmulas; dashboard', async () => {
  await paidTicket({ buyer: buyer({ name: '=Peligro Total' }) });
  const r = await api.get('/api/admin/export/orders.csv').set('Authorization', admin).buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /text\/csv; charset=utf-8/);
  assert.deepEqual([...r.body.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const text = r.body.toString('utf8');
  assert.ok(text.includes('Fecha;Estado;Tipo'));
  assert.ok(text.includes(";'=Peligro Total;"));
  assert.equal((await api.get('/api/admin/export/nope.csv').set('Authorization', admin)).status, 404);
  const d = await api.get('/api/admin/dashboard').set('Authorization', admin);
  assert.equal(d.body.tickets.sold, 1);
  assert.equal(d.body.income.byMethod.mercadopago, 20000);
  assert.equal(d.body.balance.coveredPercent, 100);
});

test('invitados en lote', async () => {
  const r = await api.post('/api/admin/guests/bulk').set('Authorization', admin)
    .send({ text: 'Ana Ruiz, 1088111222, 3001112233, @anaruiz\nAna Ruiz; 1088111222;;\nX\nBeto\t\t3109998877\t' });
  assert.deepEqual(r.body, { created: 2, skipped: 1, errors: [{ line: 3, message: 'Nombre inválido (2 a 80 caracteres).' }] });
});

test('precio guardado: paga el día de la fiesta, la puerta lo cobra una vez', async () => {
  let r = await api.post('/api/admin/orders/manual').set('Authorization', admin)
    .send({ kind: 'ticket', gender: 'hombre', roomNumber: null, buyer: buyer({ cedula: '1088555444' }), companions: [], amount: 25000, manualMethod: 'puerta', notes: '' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const order = r.body.order;
  assert.equal(order.balanceDue, 25000);
  const ticket = order.tickets[0];
  let d = (await api.get('/api/admin/dashboard').set('Authorization', admin)).body;
  assert.equal(d.income.tickets, 0);
  assert.equal(d.income.dueAtDoor, 25000);
  r = await api.post('/api/door/scan').set('Authorization', puerta).send({ value: ticket.token });
  assert.equal(r.body.result, 'valid');
  assert.equal(r.body.ticket.amountDue, 25000);
  const id = r.body.ticket.id;
  r = await api.post('/api/door/checkin').set('Authorization', puerta).send({ ticketId: id });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'PAYMENT_DUE');
  r = await api.post('/api/door/checkin').set('Authorization', puerta).send({ ticketId: id, collect: true, paymentMethod: 'nequi' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.entry.entryAmount, 25000);
  assert.equal(r.body.entry.paymentMethod, 'nequi');
  d = (await api.get('/api/admin/dashboard').set('Authorization', admin)).body;
  assert.equal(d.income.tickets, 0); // cuenta una sola vez: en la portería
  assert.equal(d.income.door.entries, 25000);
  assert.equal(d.income.dueAtDoor, 0);
  const o = (await api.get(`/api/admin/orders/${order.id}`).set('Authorization', admin)).body.order;
  assert.equal(o.balanceDue, 0);
  assert.equal(o.doorCollected.amount, 25000);
  // Una venta manual normal sigue contando de una vez.
  await api.post('/api/admin/orders/manual').set('Authorization', admin)
    .send({ kind: 'ticket', gender: 'mujer', roomNumber: null, buyer: buyer({ cedula: '1088555333' }), companions: [], amount: 20000, manualMethod: 'efectivo', notes: '' });
  d = (await api.get('/api/admin/dashboard').set('Authorization', admin)).body;
  assert.equal(d.income.tickets, 20000);
});

test('editar el valor de una venta manual: queda en auditoría y cuadra el resumen', async () => {
  let r = await api.post('/api/admin/orders/manual').set('Authorization', admin)
    .send({ kind: 'ticket', gender: 'hombre', roomNumber: null, buyer: buyer({ cedula: '1088666111' }), companions: [], amount: 30000, manualMethod: 'efectivo', notes: '' });
  const id = r.body.order.id;
  r = await api.put(`/api/admin/orders/${id}/amount`).set('Authorization', admin).send({ amount: 25000 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.order.amount, 25000);
  assert.equal(r.body.order.breakdown.total, 25000);
  assert.equal((await api.get('/api/admin/dashboard').set('Authorization', admin)).body.income.tickets, 25000);
  const audit = (await api.get('/api/admin/audit').set('Authorization', admin)).body.items.find((a) => a.action === 'order.amount');
  assert.deepEqual(audit.meta, { from: 30000, to: 25000 });
  assert.equal((await api.put(`/api/admin/orders/${id}/amount`).set('Authorization', puerta).send({ amount: 1 })).status, 403);
  // Precio guardado: también cambia lo que se cobra en la puerta.
  r = await api.post('/api/admin/orders/manual').set('Authorization', admin)
    .send({ kind: 'ticket', gender: 'hombre', roomNumber: null, buyer: buyer({ cedula: '1088666222' }), companions: [], amount: 30000, manualMethod: 'puerta', notes: '' });
  r = await api.put(`/api/admin/orders/${r.body.order.id}/amount`).set('Authorization', admin).send({ amount: 25000 });
  assert.equal(r.body.order.balanceDue, 25000);
});

test('precio guardado que ya pagó antes: se marca pagada y la puerta no cobra', async () => {
  let r = await api.post('/api/admin/orders/manual').set('Authorization', admin)
    .send({ kind: 'ticket', gender: 'mujer', roomNumber: null, buyer: buyer({ cedula: '1058932771' }), companions: [], amount: 20000, manualMethod: 'puerta', notes: '' });
  const { id, tickets } = r.body.order;
  r = await api.post(`/api/admin/orders/${id}/settle`).set('Authorization', admin).send({ manualMethod: 'nequi' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.order.balanceDue, 0);
  assert.equal(r.body.order.manualMethod, 'nequi');
  assert.equal((await api.get('/api/admin/dashboard').set('Authorization', admin)).body.income.tickets, 20000);
  r = await api.post('/api/door/scan').set('Authorization', puerta).send({ value: tickets[0].token });
  assert.equal(r.body.ticket.amountDue, 0);
  assert.equal((await api.post(`/api/admin/orders/${id}/settle`).set('Authorization', admin).send({ manualMethod: 'nequi' })).status, 409);
});
