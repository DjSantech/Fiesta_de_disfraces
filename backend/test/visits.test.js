// Analítica anónima: /api/public/track y /api/admin/visits.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb, setup, login, ticketOrder } from './helpers.js';
import { Visit } from '../src/models/index.js';
import { bogotaDay } from '../src/services/visits.js';

let app, api, admin;
before(startDb);
after(stopDb);
beforeEach(async () => {
  ({ app, api } = await setup());
  admin = await login(app, 'admin');
});

const MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const vidN = (n) => `visitor${String(n).padStart(10, '0')}`;
const track = (body, ua = DESKTOP) => api.post('/api/public/track').set('User-Agent', ua).send({ vid: vidN(1), path: '/', ...body });
const stats = (days) => api.get(`/api/admin/visits${days ? `?days=${days}` : ''}`).set('Authorization', admin);

test('track guarda la visita y responde 204', async () => {
  const r = await track({ path: '/comprar?x=1#a' }, MOBILE);
  assert.equal(r.status, 204);
  const docs = await Visit.find().lean();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].path, '/comprar');
  assert.equal(docs[0].device, 'movil');
  assert.equal(docs[0].source, 'directo');
  assert.equal(docs[0].day, bogotaDay());
});

test('acepta text/plain (sendBeacon) y responde 204 ante basura', async () => {
  let r = await api.post('/api/public/track').set('Content-Type', 'text/plain').set('User-Agent', DESKTOP)
    .send(JSON.stringify({ vid: vidN(2), path: '/' }));
  assert.equal(r.status, 204);
  r = await api.post('/api/public/track').send({ vid: 'x', path: 5 });
  assert.equal(r.status, 204);
  r = await api.post('/api/public/track').set('Content-Type', 'text/plain').send('no es json');
  assert.equal(r.status, 204);
  assert.equal(await Visit.countDocuments(), 1);
});

test('ignora /staff y bots', async () => {
  assert.equal((await track({ path: '/staff/admin' })).status, 204);
  assert.equal((await track({ path: '/staff' })).status, 204);
  for (const ua of ['Googlebot/2.1', 'WhatsApp/2.23', 'facebookexternalhit/1.1', 'HeadlessChrome/120', 'Mozilla Lighthouse']) {
    assert.equal((await track({}, ua)).status, 204);
  }
  assert.equal(await Visit.countDocuments(), 0);
});

test('normaliza tokens de /orden y /entrada', async () => {
  await track({ vid: vidN(1), path: '/orden/AbCdEf123456789012345678' });
  await track({ vid: vidN(2), path: '/entrada/AbCdEf123456789012345678?utm=1' });
  await track({ vid: vidN(3), path: '/pago/resultado?status=approved' });
  const paths = (await Visit.find().lean()).map((v) => v.path).sort();
  assert.deepEqual(paths, ['/entrada', '/orden', '/pago/resultado']);
});

test('deriva la fuente: utm, referrer y directo', async () => {
  const cases = [
    [{ utm: 'ig' }, 'instagram'],
    [{ utm: 'WhatsApp' }, 'whatsapp'],
    [{ utm: 'instagram', referrer: 'https://www.google.com/' }, 'instagram'], // utm gana al referrer
    [{ referrer: 'https://l.instagram.com/?u=secreto' }, 'instagram'],
    [{ referrer: 'https://wa.me/573001234567' }, 'whatsapp'],
    [{ referrer: 'https://l.facebook.com/l.php?u=x' }, 'facebook'],
    [{ referrer: 'https://www.tiktok.com/@x' }, 'tiktok'],
    [{ referrer: 'https://www.google.com.co/search?q=fiesta' }, 'google'],
    [{ referrer: 'https://blog.ejemplo.com/post' }, 'otro'],
    [{ referrer: 'http://localhost:5173/' }, 'directo'], // navegación interna
    [{}, 'directo'],
  ];
  let i = 10;
  for (const [extra] of cases) await track({ vid: vidN(i++), ...extra });
  const got = (await Visit.find().sort({ vid: 1 }).lean()).map((v) => v.source);
  assert.deepEqual(got, cases.map((c) => c[1]));
});

test('no cuenta el mismo vid+path dos veces en 30 s', async () => {
  await track({ path: '/' });
  await track({ path: '/' });
  await track({ path: '/comprar' });
  await track({ vid: vidN(2), path: '/' });
  assert.equal(await Visit.countDocuments(), 3);
});

test('rate limit por IP con el formato del contrato', async () => {
  const limited = await setup({ rateLimits: true });
  let last;
  for (let i = 0; i < 121; i++) last = await limited.api.post('/api/public/track').send({});
  assert.equal(last.status, 429);
  assert.equal(last.body.error.code, 'RATE_LIMITED');
});

test('el documento guardado no contiene IP, user-agent ni referrer completo', async () => {
  await track({ referrer: 'https://l.instagram.com/?u=muy-secreto&fbclid=abc', utm: 'ig' }, MOBILE);
  const doc = await Visit.findOne().lean();
  assert.deepEqual(Object.keys(doc).sort(), ['_id', 'at', 'day', 'device', 'path', 'source', 'vid']);
  const raw = JSON.stringify(doc);
  assert.ok(!/muy-secreto|fbclid|iPhone|Mozilla|127\.0\.0\.1|::1/.test(raw));
});

test('visits: exige admin y valida days', async () => {
  assert.equal((await api.get('/api/admin/visits')).status, 401);
  const puerta = await login(app, 'puerta');
  assert.equal((await api.get('/api/admin/visits').set('Authorization', puerta)).status, 403);
  assert.equal((await api.get('/api/admin/visits?days=0').set('Authorization', admin)).status, 400);
  assert.equal((await api.get('/api/admin/visits?days=91').set('Authorization', admin)).status, 400);
});

test('visits: únicos vs páginas vistas, byDay con ceros, fuentes, páginas, dispositivos', async () => {
  const day = (n) => bogotaDay(new Date(Date.now() - n * 864e5));
  const at = (n) => new Date(Date.now() - n * 864e5);
  const rows = [
    // hoy: A ve 3 páginas (instagram, móvil), B ve 1 (directo, escritorio)
    ['A', 0, '/', 'instagram', 'movil'], ['A', 0, '/comprar', 'instagram', 'movil'], ['A', 0, '/recuperar', 'instagram', 'movil'],
    ['B', 0, '/', 'directo', 'escritorio'],
    // hace 3 días: A (ya había venido, así que "regresa") y C nuevo
    ['A', 3, '/', 'directo', 'movil'], ['C', 3, '/comprar', 'whatsapp', 'tablet'],
  ].map(([v, n, path, source, device]) => ({ at: at(n), day: day(n), vid: `visitor${v.repeat(10)}`, path, source, device }));
  await Visit.insertMany(rows);

  const r = await stats(7);
  assert.equal(r.status, 200);
  const s = r.body;
  assert.equal(s.range.days, 7);
  assert.equal(s.range.visitors, 3);
  assert.equal(s.range.pageviews, 6);
  assert.equal(s.range.returning, 1);
  assert.equal(s.today.visitors, 2);
  assert.equal(s.today.pageviews, 4);
  assert.equal(s.byDay.length, 7);
  assert.equal(s.byDay[6].day, day(0));
  assert.deepEqual(s.byDay.map((d) => d.visitors), [0, 0, 0, 2, 0, 0, 2]);
  assert.deepEqual(s.byDay.map((d) => d.pageviews), [0, 0, 0, 2, 0, 0, 4]);
  assert.deepEqual(s.byPage[0], { path: '/', visitors: 2, pageviews: 3 });
  // fuente = la de la primera visita del rango (A -> directo hace 3 días, C -> whatsapp, B -> directo)
  const src = Object.fromEntries(s.bySource.map((x) => [x.source, x.visitors]));
  assert.deepEqual(src, { directo: 2, whatsapp: 1 });
  const dev = Object.fromEntries(s.byDevice.map((x) => [x.device, x.visitors]));
  assert.deepEqual(dev, { movil: 1, escritorio: 1, tablet: 1 });
  assert.equal(s.funnel.visitedBuy, 2);
  // Las visitas fuera del rango no cuentan
  assert.equal((await stats(1)).body.range.visitors, 2);
});

test('visits: ventana "ahora" (5 y 30 min)', async () => {
  const mk = (v, minAgo) => ({ at: new Date(Date.now() - minAgo * 60_000), day: bogotaDay(), vid: `visitor${v.repeat(10)}`, path: '/', source: 'directo', device: 'movil' });
  await Visit.insertMany([mk('A', 1), mk('B', 4), mk('C', 20), mk('D', 29), mk('E', 90)]);
  const { now } = (await stats()).body;
  assert.equal(now.visitors5m, 2);
  assert.equal(now.visitors30m, 4);
});

test('visits: embudo con compras reales y conversión', async () => {
  for (let i = 0; i < 4; i++) await track({ vid: vidN(20 + i), path: '/comprar' });
  const o1 = await api.post('/api/public/orders').send(ticketOrder({ paymentMethod: 'mercadopago' }));
  await api.post('/api/public/orders').send(ticketOrder());
  await api.post('/api/public/orders').send(ticketOrder());
  assert.equal(o1.status, 201);
  await api.post(`/api/public/orders/${o1.body.order.token}/mock-pay`).send({ outcome: 'approved' });
  const f = (await stats()).body.funnel;
  assert.equal(f.visitors, 4);
  assert.equal(f.visitedBuy, 4);
  assert.equal(f.orders, 3);
  assert.equal(f.paid, 1);
  assert.equal(f.conversionPercent, 75);
});
