// Integración con Mercado Pago Checkout Pro (SDK v3) y validación de la firma del webhook.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { paymentProviderError, toMpDate } from '../lib/util.js';

const GENDER = { mujer: 'Mujer', hombre: 'Hombre' };

export function buildPreferenceBody(config, order, now = new Date()) {
  const back = `${config.frontendBaseUrl}/pago/resultado?orden=${encodeURIComponent(order.token)}`;
  const title = order.kind === 'room'
    ? `${order.room.name} (${order.room.capacity} personas) · Fiesta de Disfraces`
    : `Entrada Fiesta de Disfraces · ${GENDER[order.gender] || ''} · ${order.breakdown.phase === 'preventa' ? 'Preventa' : 'Venta general'}`;
  const expiresAt = order.expiresAt || new Date(now.getTime() + 48 * 3600_000);
  const body = {
    items: [{
      id: order.kind === 'room' ? `room-${order.room.number}` : `ticket-${order.gender}`,
      title, quantity: 1, currency_id: 'COP', unit_price: order.amount, category_id: 'tickets',
    }],
    external_reference: String(order._id),
    metadata: { order_token: order.token },
    back_urls: { success: back, failure: back, pending: back },
    statement_descriptor: 'FIESTADISFRAZ',
    expires: true,
    expiration_date_from: toMpDate(new Date(now.getTime() - 60_000)),
    expiration_date_to: toMpDate(expiresAt), // acorde al apartado (60 min habitación / 48 h entrada)
    date_of_expiration: toMpDate(expiresAt),
    payer: { name: order.buyer.name, ...(order.buyer.email ? { email: order.buyer.email } : {}) },
  };
  if (config.frontendBaseUrl.startsWith('https://')) body.auto_return = 'approved';
  if (config.backendPublicUrl.startsWith('https://')) {
    body.notification_url = `${config.backendPublicUrl}/api/public/payments/mercadopago/webhook`;
  }
  return body;
}

/** Servicio real. En modo simulado solo expone las banderas (no hay llamadas a MP). */
export function createMercadoPagoService(config) {
  const mock = config.mpMock;
  const enabled = Boolean(config.mpAccessToken) || mock;
  // Config nueva por llamada: el SDK muta config.options con requestOptions.
  const client = () => new MercadoPagoConfig({ accessToken: config.mpAccessToken, options: { timeout: 8000, maxRetries: 1 } });
  const wrap = async (fn) => {
    try {
      return await fn();
    } catch (err) {
      throw paymentProviderError(err);
    }
  };
  return {
    enabled,
    mock,
    async createPreference(order) {
      const pref = await wrap(() => new Preference(client()).create({ body: buildPreferenceBody(config, order) }));
      return { id: pref.id, url: pref.init_point || pref.sandbox_init_point };
    },
    async getPayment(id) {
      try {
        return await new Payment(client()).get({ id });
      } catch (err) {
        if (err?.status === 404) return null;
        throw paymentProviderError(err);
      }
    },
    async searchPayments(externalReference) {
      const r = await wrap(() => new Payment(client()).search({
        options: { external_reference: externalReference, sort: 'date_created', criteria: 'desc', limit: 20 },
      }));
      return r?.results || [];
    },
  };
}

/** x-signature: "ts=...,v1=..." con manifest "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (HMAC-SHA256 hex). */
export function verifyWebhookSignature({ xSignature, xRequestId, dataId, secret }) {
  if (!xSignature || !secret) return false;
  const parts = {};
  for (const p of String(xSignature).split(',')) {
    const i = p.indexOf('=');
    if (i > 0) parts[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
  }
  if (!/^\d+$/.test(parts.ts || '') || !/^[a-f0-9]{64}$/i.test(parts.v1 || '')) return false;
  let id = dataId != null ? String(dataId) : '';
  if (/[a-z]/i.test(id)) id = id.toLowerCase(); // MP pide minúsculas si es alfanumérico
  let manifest = '';
  if (id) manifest += `id:${id};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1.toLowerCase()));
}
