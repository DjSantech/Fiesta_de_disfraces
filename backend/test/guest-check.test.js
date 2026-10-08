import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb, setup } from './helpers.js';
import { Guest, Settings } from '../src/models/index.js';

let api;
before(startDb);
after(stopDb);
beforeEach(async () => {
  ({ api } = await setup());
  await Settings.updateOne({ _id: 'main' }, { $set: { guestDiscountPercent: 30 } });
  await Guest.create([
    { name: 'Juan Carlos Pérez Gómez', cedula: '1088123456', phone: '3001234567', instagram: 'juan.perez' },
    { name: 'María Gómez Ruiz', instagram: 'mariag', redeemed: true },
    { name: 'Ana Torres Díaz', cedula: '52111222', discountPercent: 100 },
    { name: 'Luis Ramos Soto' }, { name: 'Luis Ramos Vera' },
  ]);
});
const check = (query) => api.post('/api/public/guest-check').send({ query });

test('instagram con y sin @', async () => {
  for (const q of ['@Juan.Perez', 'juan.perez']) {
    const r = await check(q);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { found: true, ambiguous: false, kind: 'descuento', discountPercent: 30, redeemed: false, firstName: 'Juan' });
  }
});
test('cédula y celular (con 57)', async () => {
  assert.equal((await check('1.088.123.456')).body.firstName, 'Juan');
  assert.equal((await check('3001234567')).body.found, true);
  assert.equal((await check('+57 300 123 4567')).body.firstName, 'Juan');
});
test('nombre completo y parcial, sin tildes', async () => {
  assert.equal((await check('juan carlos perez gomez')).body.found, true);
  assert.equal((await check('Juan Pérez')).body.firstName, 'Juan');
});
test('ambiguo no revela a nadie', async () => {
  const r = await check('luis ramos');
  assert.deepEqual(r.body, { found: false, ambiguous: true, kind: null, discountPercent: null, redeemed: false, firstName: null });
});
test('no encontrado y nombre de una palabra', async () => {
  assert.equal((await check('nadie.existe')).body.found, false);
  assert.equal((await check('juan')).body.found, false);
  assert.equal((await check('9999999')).body.found, false);
});
test('cortesía y redeemed', async () => {
  const c = (await check('52111222')).body;
  assert.equal(c.kind, 'cortesia');
  assert.equal(c.discountPercent, 100);
  const m = (await check('@mariag')).body;
  assert.equal(m.redeemed, true);
  assert.equal(m.firstName, 'María');
});
test('sin datos personales y validación', async () => {
  const s = JSON.stringify((await check('1088123456')).body);
  for (const x of ['1088123456', '3001234567', 'juan.perez', 'Pérez', 'Gómez']) assert.ok(!s.includes(x));
  assert.equal((await check('a')).status, 400);
});
test('429 con rate limit', async () => {
  const { api: lim } = await setup({ rateLimits: true });
  let last;
  for (let i = 0; i < 9; i++) last = await lim.post('/api/public/guest-check').send({ query: 'nadie.x' });
  assert.equal(last.status, 429);
  assert.equal(last.body.error.code, 'RATE_LIMITED');
});
