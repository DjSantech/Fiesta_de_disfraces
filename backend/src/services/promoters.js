// Promotores: código único, atribución anónima de su link (?ref=CODIGO) y estadísticas. Ver ARQUITECTURA §12.
import { randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Promoter, PromoterEvent, Order } from '../models/index.js';
import { isDuplicateKey, unauthorized, OBJECT_ID_RE, iso } from '../lib/util.js';
import { isBot, bogotaDay } from './visits.js';

// Sin 0/O, 1/I/L ni U para que se pueda dictar y teclear sin confusiones.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const PROMOTER_CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;
export const STATS_DAYS = 14;

export function randomPromoterCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}
/** " ab3k9p " → "AB3K9P"; null si no tiene forma de código. */
export function normalizePromoterCode(v) {
  const c = String(v ?? '').trim().toUpperCase();
  return PROMOTER_CODE_RE.test(c) ? c : null;
}

/** Crea el promotor con un código único (reintenta si choca). */
export async function createPromoter({ name, phone, passwordHash }) {
  for (let i = 0; ; i++) {
    try {
      return (await Promoter.create({ name, phone, passwordHash, code: randomPromoterCode() })).toObject();
    } catch (err) {
      if (!isDuplicateKey(err, 'code') || i >= 5) throw err;
    }
  }
}

/** Promotor activo con ese código, o null (desactivado = su link ya no atribuye). */
export async function activePromoterByCode(raw) {
  const code = normalizePromoterCode(raw);
  if (!code) return null;
  return Promoter.findOne({ code, active: true }).lean();
}

// ---------- Sesión (JWT propio, separado del staff) ----------
const PROMOTER_TYP = 'promoter';
export function signPromoterToken(config, p) {
  return jwt.sign({ sub: String(p._id), typ: PROMOTER_TYP, role: 'promotor', tv: p.tokenVersion ?? 0 }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '30d' });
}

/** Verifica el token de promotor y que siga activo. Un token de staff no sirve aquí (ni al revés). */
export function requirePromoter(ctx) {
  return async (req, res, next) => {
    const m = (req.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
    if (!m) throw unauthorized();
    let payload;
    try {
      payload = jwt.verify(m[1], ctx.config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw unauthorized('Tu sesión venció. Inicia sesión de nuevo.');
    }
    if (payload?.typ !== PROMOTER_TYP || !OBJECT_ID_RE.test(String(payload?.sub))) throw unauthorized();
    const p = await Promoter.findById(payload.sub).lean();
    if (!p || !p.active || (p.tokenVersion ?? 0) !== (payload.tv ?? 0)) {
      throw unauthorized('Tu sesión ya no es válida. Inicia sesión de nuevo.');
    }
    req.promoter = p;
    next();
  };
}

// ---------- Eventos del link ----------
/** Registra visita o clic a WhatsApp: cuenta una vez por visitante, tipo y día. Devuelve true si contó. */
export async function recordPromoterEvent(type, { code, vid }, userAgent) {
  if (isBot(userAgent)) return false;
  const p = await activePromoterByCode(code);
  if (!p) return false;
  const at = new Date();
  const day = bogotaDay(at);
  const r = await PromoterEvent.updateOne(
    { promoterId: p._id, type, day, vid },
    { $setOnInsert: { at } },
    { upsert: true },
  ).catch((err) => {
    if (err?.code === 11000) return { upsertedCount: 0 }; // carrera: ya existía
    throw err;
  });
  return r.upsertedCount > 0;
}

// ---------- Estadísticas ----------
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const bogotaDayExpr = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: 'America/Bogota' } });
// Entradas que representa una compra pagada: una por entrada; en habitación, su capacidad (tickets emitidos).
const ticketsExpr = { $cond: [{ $eq: ['$kind', 'room'] }, { $ifNull: ['$room.capacity', 1] }, 1] };

const emptyTotals = () => ({ visits: 0, whatsapp: 0, orders: 0, paidOrders: 0, paidTickets: 0, sold: 0 });

/** Totales por promotor (todos o los ids dados): Map(id → totales). */
export async function promoterTotals(promoters) {
  const ids = promoters.map((p) => p._id);
  const codes = promoters.map((p) => p.code);
  const [events, orders] = await Promise.all([
    PromoterEvent.aggregate([
      { $match: { promoterId: { $in: ids } } },
      { $group: { _id: { p: '$promoterId', t: '$type' }, n: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { promoterCode: { $in: codes } } },
      {
        $group: {
          _id: '$promoterCode', orders: { $sum: 1 },
          paidOrders: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
          paidTickets: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, ticketsExpr, 0] } },
          sold: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
        },
      },
    ]),
  ]);
  const byCode = new Map(orders.map((o) => [o._id, o]));
  const out = new Map();
  for (const p of promoters) {
    const t = emptyTotals();
    const o = byCode.get(p.code);
    if (o) Object.assign(t, { orders: o.orders, paidOrders: o.paidOrders, paidTickets: o.paidTickets, sold: o.sold });
    out.set(String(p._id), t);
  }
  for (const e of events) {
    const t = out.get(String(e._id.p));
    if (t) t[e._id.t === 'visit' ? 'visits' : 'whatsapp'] = e.n;
  }
  return out;
}

/** Estadísticas de UN promotor: totales + por día de los últimos `days` días (Bogotá, incluye hoy). */
export async function promoterStats(p, days = STATS_DAYS) {
  const today = bogotaDay();
  const startDay = addDays(today, -(days - 1));
  const startAt = new Date(Date.parse(`${startDay}T05:00:00Z`)); // 00:00 Bogotá
  const [totalsMap, events, created, paid] = await Promise.all([
    promoterTotals([p]),
    PromoterEvent.aggregate([
      { $match: { promoterId: p._id, day: { $gte: startDay } } },
      { $group: { _id: { d: '$day', t: '$type' }, n: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { promoterCode: p.code, createdAt: { $gte: startAt } } },
      { $group: { _id: bogotaDayExpr('$createdAt'), n: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { promoterCode: p.code, status: 'paid', paidAt: { $gte: startAt } } },
      { $group: { _id: bogotaDayExpr('$paidAt'), n: { $sum: 1 }, tickets: { $sum: ticketsExpr }, sold: { $sum: '$amount' } } },
    ]),
  ]);
  const rows = new Map();
  for (let i = 0; i < days; i++) {
    const day = addDays(startDay, i);
    rows.set(day, { day, visits: 0, whatsapp: 0, orders: 0, paidOrders: 0, paidTickets: 0, sold: 0 });
  }
  for (const e of events) {
    const r = rows.get(e._id.d);
    if (r) r[e._id.t === 'visit' ? 'visits' : 'whatsapp'] = e.n;
  }
  for (const o of created) if (rows.has(o._id)) rows.get(o._id).orders = o.n;
  for (const o of paid) {
    const r = rows.get(o._id);
    if (r) Object.assign(r, { paidOrders: o.n, paidTickets: o.tickets, sold: o.sold });
  }
  return { totals: totalsMap.get(String(p._id)) || emptyTotals(), days, byDay: [...rows.values()] };
}

export const promoterOut = (p) => ({
  id: String(p._id), name: p.name, phone: p.phone, code: p.code, active: !!p.active,
  createdAt: iso(p.createdAt), lastLoginAt: iso(p.lastLoginAt),
});
