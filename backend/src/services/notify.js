// Avisos salientes (n8n → WhatsApp). Dispara y olvida: nunca bloquea ni rompe la petición del comprador.
const TIMEOUT_MS = 5000;

export function buildInReviewPayload(order, config) {
  const b = order.breakdown || {};
  return {
    event: 'order.in_review',
    orderId: String(order._id),
    kind: order.kind,
    gender: order.gender ?? null,
    roomNumber: order.room?.number ?? null,
    roomName: order.room?.name ?? null,
    phase: b.phase ?? null,
    amount: Math.round(Number(order.amount) || 0),
    paymentMethod: order.paymentMethod,
    buyerName: order.buyer?.name ?? '',
    hasInstagram: Boolean(order.buyer?.instagram),
    isGuest: Boolean(b.isGuest),
    createdAt: new Date(order.createdAt || Date.now()).toISOString(),
    adminUrl: `${config.frontendBaseUrl}/staff/admin/compras?estado=in_review`,
  };
}

/** Envía el aviso si hay N8N_WEBHOOK_URL. Devuelve una promesa que nunca rechaza (útil en tests). */
export function notifyOrderInReview(order, ctx) {
  const { config, logger } = ctx;
  if (!config.n8nWebhookUrl) return Promise.resolve(false);
  const headers = { 'content-type': 'application/json' };
  if (config.n8nWebhookSecret) headers['x-fd-secret'] = config.n8nWebhookSecret;
  return (async () => {
    try {
      const res = await fetch(config.n8nWebhookUrl, {
        method: 'POST', headers, body: JSON.stringify(buildInReviewPayload(order, config)),
        signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error',
      });
      if (!res.ok) { logger.warn('Aviso n8n: respuesta', res.status, 'orden', String(order._id)); return false; }
      return true;
    } catch (err) {
      logger.warn('Aviso n8n falló', String(order._id), err?.name || 'error');
      return false;
    }
  })();
}
