// Rutas públicas (sin auth): /api/public/*
import express from 'express';
import { Room, Ticket, Order } from '../models/index.js';
import { PUBLIC_PAYMENT_METHODS, GENDERS, ORDER_KINDS } from '../constants.js';
import { iso, notFound, tryIds, runInBackground, AppError } from '../lib/util.js';
import {
  validate, z, tokenParam, text, cedula, phone, instagram, optCedula, email, spanishErrorMap,
} from '../middleware/validate.js';
import { receiptUpload } from '../middleware/http.js';
import { getSettings, phaseAt, currentPrices, ticketsTaken, roomPublic } from '../services/core.js';
import {
  quote, createPublicOrder, presentOrder, getOrderByToken, changePaymentMethod, attachReceipt, verifyMercadoPago,
  mockPay, processPaymentNotification,
} from '../services/orders.js';
import { verifyWebhookSignature } from '../services/mercadopago.js';
import { ticketPublic } from '../services/serializers.js';

const crossChecks = (v, ctx) => {
  if (v?.kind === 'ticket' && !v.gender) ctx.addIssue({ code: 'custom', path: ['gender'], message: 'Elige mujer u hombre.' });
  if (v?.kind === 'room' && !v.roomNumber) ctx.addIssue({ code: 'custom', path: ['roomNumber'], message: 'Elige una habitación.' });
};
const always = { when: () => true };
const kind = z.enum(ORDER_KINDS, { error: 'Elige entrada o habitación.' });
const gender = z.enum(GENDERS, { error: 'Elige mujer u hombre.' }).nullish();
const roomNumber = z.number().int().min(1).max(99).nullish();

const quoteBody = z.object({
  kind, gender, roomNumber,
  cedula: z.string().max(40).optional(), phone: z.string().max(40).optional(), instagram: z.string().max(100).optional(),
}).superRefine(crossChecks, always);

export const companionsSchema = z.array(z.object({ name: text(2, 80), cedula: optCedula })).max(19).default([]);

const orderBody = z.object({
  kind, gender, roomNumber,
  buyer: z.object({ name: text(3, 80), cedula, phone, instagram, email }),
  companions: companionsSchema,
  paymentMethod: z.enum(PUBLIC_PAYMENT_METHODS, { error: 'Elige Mercado Pago o transferencia.' }),
  acceptTerms: z.literal(true, { error: 'Debes confirmar que eres mayor de edad y aceptar la política de devoluciones.' }),
  acceptData: z.literal(true, { error: 'Debes autorizar el tratamiento de tus datos (Ley 1581 de 2012).' }),
}).superRefine((v, ctx) => {
  crossChecks(v, ctx);
  if (v?.kind === 'ticket' && Array.isArray(v.companions) && v.companions.length) {
    ctx.addIssue({ code: 'custom', path: ['companions'], message: 'Los acompañantes solo aplican para habitaciones.' });
  }
}, always);

const idLike = z.union([z.string().max(64), z.number()]).optional();
const webhookQuery = z.looseObject({ 'data.id': idLike, id: idLike, type: z.string().max(64).optional(), topic: z.string().max(64).optional() });
const webhookBody = z.looseObject({
  type: z.string().max(64).optional(), topic: z.string().max(64).optional(), action: z.string().max(64).optional(),
  data: z.looseObject({ id: idLike }).optional(), id: idLike,
});

export function publicRouter(ctx, limits) {
  const r = express.Router();

  r.get('/config', async (req, res) => {
    const settings = await getSettings();
    const phase = phaseAt(settings);
    const [rooms, taken] = await Promise.all([Room.find().sort({ number: 1 }).lean(), ticketsTaken()]);
    res.json({
      event: {
        startsAt: iso(settings.eventStartsAt), presaleEndsAt: iso(settings.presaleEndsAt), phase,
        salesOpen: !!settings.salesOpen, soldOut: taken >= settings.capacity,
      },
      prices: { preventa: { ...settings.prices.preventa }, puerta: { ...settings.prices.puerta }, current: { ...currentPrices(settings, phase) } },
      guestDiscountPercent: settings.guestDiscountPercent,
      parking: { ...settings.parking },
      rooms: rooms.map(roomPublic),
      paymentAccounts: settings.paymentAccounts.map((a) => ({ label: a.label, number: a.number, holder: a.holder || '' })),
      transferInstructions: settings.transferInstructions,
      contact: { ...settings.contact },
      mercadoPago: { enabled: ctx.mp.enabled, mock: ctx.mp.mock },
      counter: settings.publicCounter
        ? { capacity: settings.capacity, sold: taken, remaining: Math.max(0, settings.capacity - taken) }
        : null,
    });
  });

  r.post('/quote', limits.quote, validate({ body: quoteBody }), async (req, res) => {
    const b = req.valid.body;
    res.json(await quote(ctx, { ...b, ids: tryIds(b) }));
  });

  r.post('/orders', limits.orders, validate({ body: orderBody }), async (req, res) => {
    const { order, checkoutUrl } = await createPublicOrder(ctx, req.valid.body);
    res.status(201).json({ order: await presentOrder(order), checkoutUrl });
  });

  r.get('/orders/:token', limits.read, validate({ params: tokenParam }), async (req, res) => {
    const o = await getOrderByToken(req.valid.params.token);
    res.json({ order: await presentOrder(o) });
  });

  r.post('/orders/:token/pay', limits.pay, validate({
    params: tokenParam, body: z.object({ paymentMethod: z.enum(PUBLIC_PAYMENT_METHODS, { error: 'Elige Mercado Pago o transferencia.' }) }),
  }), async (req, res) => {
    const { order, checkoutUrl } = await changePaymentMethod(ctx, req.valid.params.token, req.valid.body.paymentMethod);
    res.json({ order: await presentOrder(order), checkoutUrl });
  });

  r.post('/orders/:token/receipt', limits.receipt, validate({ params: tokenParam }), receiptUpload,
    validate({ body: z.object({ reference: z.preprocess((v) => (v == null ? '' : v), z.string().trim().max(60)) }) }),
    async (req, res) => {
      const id = await attachReceipt(req.valid.params.token, req.file, req.valid.body.reference);
      res.json({ order: await presentOrder(id) });
    });

  r.post('/orders/:token/verify-mp', limits.verify, validate({
    params: tokenParam, body: z.object({ paymentId: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().max(40).optional()) }),
  }), async (req, res) => {
    const id = await verifyMercadoPago(ctx, req.valid.params.token, req.valid.body.paymentId);
    res.json({ order: await presentOrder(id) });
  });

  r.post('/orders/:token/mock-pay', (req, res, next) => {
    if (!ctx.mp.mock) throw notFound('Ruta no encontrada.');
    next();
  }, validate({ params: tokenParam, body: z.object({ outcome: z.enum(['approved', 'rejected']) }) }), async (req, res) => {
    const id = await mockPay(ctx, req.valid.params.token, req.valid.body.outcome);
    res.json({ order: await presentOrder(id) });
  });

  // Webhook de Mercado Pago: valida firma (si hay secreto), responde 200 rápido y re-consulta el pago a MP.
  r.post('/payments/mercadopago/webhook', limits.webhook, (req, res) => {
    const q = webhookQuery.safeParse({ ...req.query }, { error: spanishErrorMap });
    const b = webhookBody.safeParse(req.body ?? {}, { error: spanishErrorMap });
    if (!q.success || !b.success) throw new AppError(400, 'VALIDATION_ERROR', 'Notificación inválida.', { fields: {} });
    const topic = b.data.type || b.data.topic || q.data.type || q.data.topic;
    const queryId = q.data['data.id'];
    const dataId = queryId ?? b.data.data?.id ?? q.data.id ?? b.data.id;
    if (ctx.config.mpWebhookSecret) {
      const ok = verifyWebhookSignature({
        xSignature: req.get('x-signature'), xRequestId: req.get('x-request-id'),
        dataId: queryId ?? b.data.data?.id, secret: ctx.config.mpWebhookSecret,
      });
      if (!ok) throw new AppError(401, 'UNAUTHORIZED', 'Firma inválida.');
    }
    res.status(200).json({ received: true });
    if (topic === 'payment' && dataId != null && /^\d{1,20}$/.test(String(dataId)) && ctx.mp.enabled && !ctx.mp.mock) {
      runInBackground(() => processPaymentNotification(ctx, String(dataId)), ctx.logger);
    }
  });

  r.get('/tickets/:token', limits.read, validate({ params: tokenParam }), async (req, res) => {
    const t = await Ticket.findOne({ token: req.valid.params.token }).lean();
    if (!t) throw notFound('No encontramos esa entrada.');
    const [order, settings] = await Promise.all([Order.findById(t.orderId).select('kind buyer.name').lean(), getSettings()]);
    const loc = settings.location;
    res.json({
      ticket: ticketPublic(t),
      order: { kind: order?.kind ?? (t.kind === 'room' ? 'room' : 'ticket'), buyerName: order?.buyer?.name ?? t.buyerName },
      event: { startsAt: iso(settings.eventStartsAt) },
      location: loc.revealed && ['valid', 'used'].includes(t.status) ? { name: loc.name, mapsUrl: loc.mapsUrl, notes: loc.notes } : null,
    });
  });

  r.post('/recover', limits.recover, validate({ body: z.object({ cedula, phone }) }), async (req, res) => {
    const { cedula: c, phone: p } = req.valid.body;
    const orders = await Order.find({ 'buyer.cedula': c, 'buyer.phone': p, status: { $in: ['paid', 'in_review', 'pending_payment'] } })
      .sort({ createdAt: -1 }).limit(20).select('token kind status createdAt').lean();
    res.json({ orders: orders.map((o) => ({ token: o.token, kind: o.kind, status: o.status, createdAt: iso(o.createdAt) })) });
  });

  return r;
}
