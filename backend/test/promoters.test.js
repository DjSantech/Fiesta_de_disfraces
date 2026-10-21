// Promotores: registro/login, link ?ref=, eventos anónimos, atribución en órdenes, panel y admin.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb, setup, login, ticketOrder } from './helpers.js';
import { Promoter, PromoterEvent, Order } from '../src/models/index.js';
import { PROMOTER_CODE_RE } from '../src/services/promoters.js';

let app, api, admin;
before(startDb);
after(stopDb);
beforeEach(async () => {
  ({ app, api } = await setup());
  admin = await login(app, 'admin');
});

const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const vidN = (n) => `visitor${String(n).padStart(10, '0')}`;
let phoneN = 0;
async function register(over = {}) {
  phoneN++;
  const body = { name: 'Camila Ríos', phone: `310${String(1000000 + phoneN)}`, password: 'secreto1', ...over };
  const r = await api.post('/api/promoters/register').send(body);
  return { r, body, auth: r.body?.token ? `Bearer ${r.body.token}` : null, code: r.body?.promoter?.code };
}
const event = (type, code, vid = vidN(1), ua = DESKTOP) => api.post(`/api/public/ref/${type}`).set('User-Agent', ua).send({ code, vid });
const me = (auth) => api.get('/api/promoters/me').set('Authorization', auth);

test('registro: crea promotor con código único y devuelve token', async () => {
  const { r, body } = await register({ phone: '+57 312 345 6789' });
  assert.equal(r.status, 201);
  assert.ok(r.body.token);
  assert.equal(r.body.promoter.phone, '3123456789');
  assert.match(r.body.promoter.code, PROMOTER_CODE_RE);
  assert.equal(r.body.promoter.active, true);
  assert.equal(r.body.promoter.passwordHash, undefined);
  const doc = await Promoter.findOne({ phone: '3123456789' }).select('+passwordHash').lean();
  assert.notEqual(doc.passwordHash, body.password);
  assert.match(doc.passwordHash, /^\$2[aby]\$/);
});

test('registro: valida campos en español y teléfono duplicado → 409', async () => {
  let r = await api.post('/api/promoters/register').send({ name: 'A', phone: '123', password: '123' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'VALIDATION_ERROR');
  assert.match(r.body.error.details.fields.phone, /10 dígitos/);
  assert.match(r.body.error.details.fields.password, /al menos 6/);
  assert.ok(r.body.error.details.fields.name);
  const { body } = await register();
  r = await api.post('/api/promoters/register').send({ ...body, name: 'Otra persona' });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'PHONE_TAKEN');
});

test('login: celular + contraseña; credenciales malas → 401', async () => {
  const { body } = await register();
  let r = await api.post('/api/promoters/login').send({ phone: `57${body.phone}`, password: body.password });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  r = await api.post('/api/promoters/login').send({ phone: body.phone, password: 'otraclave' });
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, 'INVALID_CREDENTIALS');
  r = await api.post('/api/promoters/login').send({ phone: '3009999999', password: 'loquesea' });
  assert.equal(r.status, 401);
});

test('el token de promotor no entra a rutas de staff y el de staff no entra al panel', async () => {
  const { auth } = await register();
  for (const path of ['/api/admin/dashboard', '/api/admin/promoters', '/api/door/stats', '/api/bar/products', '/api/auth/me']) {
    const r = await api.get(path).set('Authorization', auth);
    assert.equal(r.status, 401, path);
  }
  assert.equal((await me(admin)).status, 401);
  assert.equal((await api.get('/api/promoters/me')).status, 401);
});

test('visitas y clics a WhatsApp: únicos por visitante y día, ignora bots y códigos inválidos', async () => {
  const { auth, code } = await register();
  for (const vid of [vidN(1), vidN(1), vidN(2), vidN(3)]) assert.equal((await event('visit', code, vid)).status, 204);
  assert.equal((await event('visit', code.toLowerCase(), vidN(4))).status, 204); // minúsculas también
  assert.equal((await event('visit', code, vidN(5), 'Googlebot/2.1')).status, 204);
  assert.equal((await event('visit', code, vidN(5), 'WhatsApp/2.23')).status, 204);
  assert.equal((await event('visit', 'ZZZZZZ', vidN(6))).status, 204);
  assert.equal((await api.post('/api/public/ref/visit').send({ code, vid: 'x' })).status, 204);
  assert.equal((await api.post('/api/public/ref/visit').set('Content-Type', 'text/plain').send('basura')).status, 204);
  // text/plain (sendBeacon) válido
  await api.post('/api/public/ref/whatsapp').set('Content-Type', 'text/plain').set('User-Agent', DESKTOP).send(JSON.stringify({ code, vid: vidN(1) }));
  await event('whatsapp', code, vidN(1));
  await event('whatsapp', code, vidN(2));

  const r = await me(auth);
  assert.equal(r.status, 200);
  assert.equal(r.body.stats.totals.visits, 4);
  assert.equal(r.body.stats.totals.whatsapp, 2);
  assert.equal(r.body.stats.byDay.length, 14);
  const today = r.body.stats.byDay.at(-1);
  assert.equal(today.visits, 4);
  assert.equal(today.whatsapp, 2);
  const doc = await PromoterEvent.findOne().lean();
  assert.deepEqual(Object.keys(doc).sort(), ['_id', 'at', 'day', 'promoterId', 'type', 'vid']);
});

test('ref en la orden: se guarda promoterCode y suma compras creadas y pagadas', async () => {
  const { auth, code } = await register();
  const o1 = await api.post('/api/public/orders').send(ticketOrder({ paymentMethod: 'mercadopago', ref: code.toLowerCase() }));
  assert.equal(o1.status, 201);
  const o2 = await api.post('/api/public/orders').send(ticketOrder({ ref: code }));
  assert.equal(o2.status, 201);
  const o3 = await api.post('/api/public/orders').send(ticketOrder({ ref: 'NOEXIS' }));
  assert.equal(o3.status, 201); // ref desconocido no bloquea
  const o4 = await api.post('/api/public/orders').send(ticketOrder({ ref: 12345 }));
  assert.equal(o4.status, 201); // ref basura tampoco
  assert.equal((await Order.findOne({ token: o1.body.order.token }).lean()).promoterCode, code);
  assert.equal((await Order.findOne({ token: o3.body.order.token }).lean()).promoterCode, null);
  await api.post(`/api/public/orders/${o1.body.order.token}/mock-pay`).send({ outcome: 'approved' });

  const s = (await me(auth)).body.stats.totals;
  assert.equal(s.orders, 2);
  assert.equal(s.paidOrders, 1);
  assert.equal(s.paidTickets, 1);
  assert.equal(s.sold, o1.body.order.amount);
  assert.equal((await me(auth)).body.stats.byDay.at(-1).paidOrders, 1);

  // El admin ve el código en el detalle de la compra
  const id = (await Order.findOne({ token: o1.body.order.token }).lean())._id;
  const d = await api.get(`/api/admin/orders/${id}`).set('Authorization', admin);
  assert.equal(d.body.order.promoterCode, code);
});

test('un promotor solo ve sus propios datos', async () => {
  const a = await register({ name: 'Promotor A' });
  const b = await register({ name: 'Promotor B' });
  await event('visit', a.code, vidN(1));
  await event('visit', a.code, vidN(2));
  await api.post('/api/public/orders').send(ticketOrder({ ref: a.code }));
  const rb = await me(b.auth);
  assert.equal(rb.body.promoter.code, b.code);
  assert.equal(rb.body.stats.totals.visits, 0);
  assert.equal(rb.body.stats.totals.orders, 0);
  const ra = await me(a.auth);
  assert.equal(ra.body.stats.totals.visits, 2);
  assert.equal(ra.body.stats.totals.orders, 1);
});

test('admin: lista con estadísticas y desactivar (no atribuye, no entra, cierra sesión)', async () => {
  const { auth, code, body } = await register();
  await event('visit', code, vidN(1));
  const puerta = await login(app, 'puerta');
  assert.equal((await api.get('/api/admin/promoters').set('Authorization', puerta)).status, 403);
  let r = await api.get('/api/admin/promoters').set('Authorization', admin);
  assert.equal(r.status, 200);
  const item = r.body.items.find((p) => p.code === code);
  assert.equal(item.stats.visits, 1);
  assert.equal(item.phone, body.phone);

  r = await api.put(`/api/admin/promoters/${item.id}`).set('Authorization', admin).send({ active: false });
  assert.equal(r.status, 200);
  assert.equal(r.body.promoter.active, false);
  assert.equal((await me(auth)).status, 401); // sesión cerrada
  r = await api.post('/api/promoters/login').send({ phone: body.phone, password: body.password });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, 'PROMOTER_INACTIVE');
  await event('visit', code, vidN(2));
  const o = await api.post('/api/public/orders').send(ticketOrder({ ref: code }));
  assert.equal((await Order.findOne({ token: o.body.order.token }).lean()).promoterCode, null);
  assert.equal(await PromoterEvent.countDocuments(), 1);

  // Reactivar: vuelve a entrar
  await api.put(`/api/admin/promoters/${item.id}`).set('Authorization', admin).send({ active: true });
  assert.equal((await api.post('/api/promoters/login').send({ phone: body.phone, password: body.password })).status, 200);
  assert.equal((await api.put('/api/admin/promoters/0123456789abcdef01234567').set('Authorization', admin).send({ active: true })).status, 404);
});

test('rate limit en registro y login', async () => {
  const limited = await setup({ rateLimits: true });
  let last;
  for (let i = 0; i < 6; i++) last = await limited.api.post('/api/promoters/register').send({ name: 'Ana María', phone: `3201000${String(i).padStart(3, '0')}`, password: 'secreto1' });
  assert.equal(last.status, 429);
  assert.equal(last.body.error.code, 'RATE_LIMITED');
  for (let i = 0; i < 11; i++) last = await limited.api.post('/api/promoters/login').send({ phone: '3201000000', password: 'malamala' });
  assert.equal(last.status, 429);
});
