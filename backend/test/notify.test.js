import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startDb, stopDb, setup, ticketOrder, PNG } from './helpers.js';

before(startDb);
after(stopDb);

function receiver(status = 200) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => { calls.push({ headers: req.headers, body: JSON.parse(body || '{}'), raw: body }); res.statusCode = status; res.end('{}'); });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, calls, url: `http://127.0.0.1:${server.address().port}/hook` })));
}
const waitFor = async (fn) => { for (let i = 0; i < 50 && !fn(); i++) await new Promise((r) => setTimeout(r, 40)); };

async function upload(api, payload = ticketOrder()) {
  const c = await api.post('/api/public/orders').send(payload);
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const token = c.body.order.token;
  const r = await api.post(`/api/public/orders/${token}/receipt`).attach('file', PNG, 'c.png');
  return { r, token, payload };
}

test('aviso n8n: POST con payload sin datos sensibles y con secreto', async () => {
  const rx = await receiver();
  const { api } = await setup({ env: { N8N_WEBHOOK_URL: rx.url, N8N_WEBHOOK_SECRET: 's3cr3to' } });
  const { r, token, payload } = await upload(api);
  assert.equal(r.status, 200);
  await waitFor(() => rx.calls.length);
  assert.equal(rx.calls.length, 1);
  const { headers, body, raw } = rx.calls[0];
  assert.equal(headers['x-fd-secret'], 's3cr3to');
  assert.equal(body.event, 'order.in_review');
  assert.equal(body.kind, 'ticket');
  assert.equal(body.phase, 'preventa');
  assert.equal(body.buyerName, payload.buyer.name);
  assert.equal(body.hasInstagram, true);
  assert.equal(body.isGuest, false);
  assert.ok(Number.isInteger(body.amount) && body.amount > 0);
  assert.match(body.adminUrl, /\/staff\/admin\/compras\?estado=in_review$/);
  for (const secret of [payload.buyer.cedula, payload.buyer.phone, token]) assert.ok(!raw.includes(secret));
  // Reemplazar el comprobante no repite el aviso.
  const again = await api.post(`/api/public/orders/${token}/receipt`).attach('file', PNG, 'c2.png');
  assert.equal(again.status, 200);
  await new Promise((r2) => setTimeout(r2, 200));
  assert.equal(rx.calls.length, 1);
  rx.server.close();
});

test('aviso n8n: sin N8N_WEBHOOK_URL no se llama a nadie', async () => {
  const rx = await receiver();
  const { api } = await setup();
  const { r } = await upload(api);
  assert.equal(r.status, 200);
  await new Promise((r2) => setTimeout(r2, 200));
  assert.equal(rx.calls.length, 0);
  rx.server.close();
});

test('aviso n8n: receptor con 500 o caído no afecta al comprador', async () => {
  const rx = await receiver(500);
  let { api } = await setup({ env: { N8N_WEBHOOK_URL: rx.url } });
  assert.equal((await upload(api)).r.status, 200);
  await waitFor(() => rx.calls.length);
  assert.equal(rx.calls.length, 1);
  rx.server.close();
  ({ api } = await setup({ env: { N8N_WEBHOOK_URL: rx.url } })); // puerto ya cerrado
  assert.equal((await upload(api)).r.status, 200);
});
