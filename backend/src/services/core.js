// Reglas base: ajustes, precios (§7.1–7.2), aforo (§7.5), habitaciones (§7.6) y emisión de tickets (§7.8–7.9).
import { Settings, Room, Order, Ticket, Guest } from '../models/index.js';
import { DEFAULT_SETTINGS, SETTINGS_ID } from '../constants.js';
import { randomToken, randomTicketCode, appendNote, alreadyHasTicket } from '../lib/util.js';

// ---------- Ajustes ----------
function withDefaults(defaults, value) {
  if (Array.isArray(defaults)) return Array.isArray(value) ? value : defaults;
  if (defaults && typeof defaults === 'object' && !(defaults instanceof Date)) {
    const out = {};
    for (const k of Object.keys(defaults)) out[k] = withDefaults(defaults[k], value?.[k]);
    return out;
  }
  return value === undefined || value === null ? defaults : value;
}

export async function getSettings() {
  let doc = await Settings.findById(SETTINGS_ID).lean();
  if (!doc) {
    await Settings.updateOne({ _id: SETTINGS_ID }, { $setOnInsert: DEFAULT_SETTINGS }, { upsert: true });
    doc = await Settings.findById(SETTINGS_ID).lean();
  }
  return { ...withDefaults(DEFAULT_SETTINGS, doc), updatedAt: doc.updatedAt };
}

/** Merge profundo: aplana a rutas con punto; los arrays (paymentAccounts) se reemplazan completos. */
export async function updateSettings(patch) {
  const set = {};
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) walk(v, path);
      else set[path] = v;
    }
  };
  walk(patch, '');
  await getSettings(); // garantiza que exista
  if (Object.keys(set).length) await Settings.updateOne({ _id: SETTINGS_ID }, { $set: set });
  return getSettings();
}

// ---------- Precios ----------
export const roundTo500 = (v) => Math.round(v / 500) * 500;
export const phaseAt = (settings, now = new Date()) =>
  now.getTime() <= new Date(settings.presaleEndsAt).getTime() ? 'preventa' : 'general';
export const currentPrices = (settings, phase) => (phase === 'preventa' ? settings.prices.preventa : settings.prices.puerta);
/** base × (1 − %/100) redondeado a múltiplos de $500 (aritmética entera para evitar errores de coma flotante). */
export const applyDiscount = (base, pct) => Math.min(base, Math.round((base * (100 - pct)) / 50000) * 500);

export function ticketBreakdown(settings, { gender, guest = null, now = new Date(), prices = null }) {
  const phase = phaseAt(settings, now);
  const base = (prices || currentPrices(settings, phase))[gender];
  if (!guest) return { phase, base, isGuest: false, discountPercent: 0, discount: 0, total: base };
  const pct = guest.discountPercent ?? settings.guestDiscountPercent;
  const total = applyDiscount(base, pct);
  return { phase, base, isGuest: true, discountPercent: pct, discount: base - total, total };
}
export const roomPriceAt = (settings, room, now = new Date()) =>
  (phaseAt(settings, now) === 'preventa' && room.presalePrice != null ? room.presalePrice : room.price);
export const roomBreakdown = (settings, room, now = new Date()) => {
  const p = roomPriceAt(settings, room, now);
  return { phase: phaseAt(settings, now), base: p, isGuest: false, discountPercent: 0, discount: 0, total: p };
};

/** Invitado no redimido que coincide por cédula, celular o Instagram (ya normalizados). */
export async function findGuestMatch({ cedula, phone, instagram } = {}) {
  const or = [];
  if (cedula) or.push({ cedula });
  if (phone) or.push({ phone });
  if (instagram) or.push({ instagram });
  if (!or.length) return null;
  return Guest.findOne({ $or: or, redeemed: false }).sort({ createdAt: 1 }).lean();
}

// ---------- Aforo ----------
/** Cupos ocupados: tickets general+cortesía válidos/usados + órdenes de entrada en revisión. */
export async function ticketsTaken() {
  const [tickets, review] = await Promise.all([
    Ticket.countDocuments({ status: { $in: ['valid', 'used'] }, kind: { $in: ['general', 'cortesia'] } }),
    Order.countDocuments({ kind: 'ticket', status: 'in_review' }),
  ]);
  return tickets + review;
}
export const isSoldOut = async (settings) => (await ticketsTaken()) >= settings.capacity;

// ---------- Una entrada por cédula ----------
export function findActiveTicketByCedula(cedula, excludeOrderId) {
  const filter = { holderCedula: cedula, status: { $in: ['valid', 'used'] } };
  if (excludeOrderId) filter.orderId = { $ne: excludeOrderId };
  return Ticket.findOne(filter).select('_id orderId status').lean();
}
export async function assertCanBuy(cedula, excludeOrderId) {
  const reviewFilter = { 'buyer.cedula': cedula, status: 'in_review' };
  if (excludeOrderId) reviewFilter._id = { $ne: excludeOrderId };
  const [ticket, review] = await Promise.all([findActiveTicketByCedula(cedula, excludeOrderId), Order.exists(reviewFilter)]);
  if (ticket || review) {
    throw alreadyHasTicket();
  }
}

// ---------- Habitaciones ----------
export function roomStatus(room, now = new Date()) {
  if (room.booked) return 'booked';
  if (room.orderId && (!room.holdExpiresAt || room.holdExpiresAt > now)) return 'held';
  if (room.blocked) return 'blocked';
  return 'available';
}
export const roomPublic = (r, settings) => ({
  number: r.number, name: r.name, capacity: r.capacity, minPeople: r.minPeople ?? 1, price: r.price,
  presalePrice: r.presalePrice ?? r.price, currentPrice: settings ? roomPriceAt(settings, r) : r.price, beds: r.beds || '', privateBathroom: !!r.privateBathroom, status: roomStatus(r),
});

/**
 * Aparta (o reserva con book=true) atómicamente: libre, con apartado vencido, o apartada por
 * órdenes pendientes anteriores de la misma cédula (takeover). Devuelve null si no se pudo.
 */
export function claimRoom(number, orderId, { until = null, book = false, takeover = [], now = new Date() } = {}) {
  const or = [{ orderId: null }, { holdExpiresAt: { $lt: now } }];
  if (takeover.length) or.push({ orderId: { $in: takeover } });
  return Room.findOneAndUpdate(
    { number, blocked: false, booked: false, $or: or },
    { $set: { orderId, holdExpiresAt: book ? null : until, booked: book } },
    { returnDocument: 'after' },
  ).lean();
}
/** Reserva definitiva al pagar (idempotente si ya es de esta orden; respeta bloqueos para habitaciones libres). */
export function bookRoom(number, orderId, now = new Date()) {
  return Room.findOneAndUpdate(
    { number, $or: [{ orderId }, { orderId: null, booked: false, blocked: false }, { booked: false, blocked: false, holdExpiresAt: { $lt: now } }] },
    { $set: { orderId, booked: true, holdExpiresAt: null } },
    { returnDocument: 'after' },
  ).lean();
}
/** Apartado sin vencimiento mientras el admin revisa el comprobante. */
export function holdForReview(number, orderId, now = new Date()) {
  return Room.findOneAndUpdate(
    { number, booked: false, $or: [{ orderId }, { orderId: null, blocked: false }, { blocked: false, holdExpiresAt: { $lt: now } }] },
    { $set: { orderId, holdExpiresAt: null } },
    { returnDocument: 'after' },
  ).lean();
}
export const releaseRoom = (number, orderId) =>
  Room.updateOne({ number, orderId, booked: false }, { $set: { orderId: null, holdExpiresAt: null } });

// ---------- Tickets ----------
export function buildTicketSpecs(order) {
  const base = { holderName: order.buyer.name, holderCedula: order.buyer.cedula || null };
  if (order.kind === 'ticket') {
    const courtesy = order.manualMethod === 'cortesia';
    return [{
      seq: 0, ...base, kind: courtesy ? 'cortesia' : 'general', gender: order.gender ?? null,
      phase: courtesy ? null : order.breakdown?.phase ?? null, isGuest: !courtesy && !!order.breakdown?.isGuest, roomNumber: null,
    }];
  }
  const n = order.room.number;
  const specs = [{ seq: 0, ...base, kind: 'room', gender: order.gender ?? null, phase: null, isGuest: false, roomNumber: n }];
  for (let i = 1; i < order.room.capacity; i++) {
    const c = order.companions?.[i - 1];
    specs.push({ seq: i, holderName: c?.name || `Acompañante ${i} · Hab. ${n}`, holderCedula: c?.cedula || null, kind: 'room', gender: null, phase: null, isGuest: false, roomNumber: n });
  }
  return specs;
}

async function insertMissingTickets(order) {
  const specs = buildTicketSpecs(order);
  for (let attempt = 0; attempt < 6; attempt++) {
    const have = new Set((await Ticket.find({ orderId: order._id }).select('seq').lean()).map((t) => t.seq));
    const missing = specs.filter((s) => !have.has(s.seq));
    if (!missing.length) return;
    const docs = missing.map((s) => ({ ...s, orderId: order._id, buyerName: order.buyer.name, token: randomToken(), code: randomTicketCode(), status: 'valid' }));
    try {
      await Ticket.insertMany(docs, { ordered: false });
    } catch (err) {
      // Duplicado de (orderId, seq) = otro proceso ya lo emitió; de token/código = se reintenta con otros.
      if (err?.code !== 11000 && !err?.writeErrors?.every((w) => (w.err ?? w).code === 11000)) throw err;
    }
  }
  throw new Error(`No se pudieron emitir los tickets de la orden ${order._id}`);
}

/**
 * Completa una orden pagada: reserva la habitación y emite los tickets una sola vez.
 * Idempotente y seguro con llamadas simultáneas (webhook + verify-mp). Si la habitación
 * ya es de otra orden, la orden pasa a `conflict`.
 */
export async function finalizePaidOrder(orderId) {
  const order = await Order.findById(orderId).lean();
  if (!order || order.status !== 'paid' || order.ticketsIssued) return order;
  if (order.kind === 'room' && !(await bookRoom(order.room.number, order._id))) {
    await Order.updateOne(
      { _id: order._id, status: 'paid', ticketsIssued: false },
      { $set: { status: 'conflict', notes: appendNote(order.notes, 'Conflicto: la habitación ya la tiene otra orden.') } },
    );
    return Order.findById(order._id).lean();
  }
  await insertMissingTickets(order);
  await Order.updateOne({ _id: order._id, status: 'paid' }, { $set: { ticketsIssued: true } });
  if (order.guestId) {
    await Guest.updateOne({ _id: order.guestId, redeemed: false }, { $set: { redeemed: true, redeemedOrderId: order._id, redeemedAt: new Date() } });
  }
  return Order.findById(order._id).lean();
}

export const ticketsOf = (orderId) => Ticket.find({ orderId }).sort({ seq: 1 }).lean();
