// Flujo de compras: crear, pagar (MP / transferencia / manual), aprobar, rechazar, expirar y conciliar.
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { Order, Room, Receipt } from '../models/index.js';
import { ROOM_HOLD_MINUTES, TICKET_ORDER_EXPIRY_HOURS, MP_RECONCILE_EVERY_MS } from '../constants.js';
import {
  AppError, notFound, invalidState, salesClosed, soldOut, roomUnavailable, randomToken, addMinutes,
  appendNote, isDuplicateKey, OBJECT_ID_RE,
} from '../lib/util.js';
import { fieldError } from '../middleware/validate.js';
import { detectImageType } from '../middleware/http.js';
import {
  getSettings, ticketBreakdown, roomBreakdown, findGuestMatch, isSoldOut, assertCanBuy, findActiveTicketByCedula,
  claimRoom, holdForReview, releaseRoom, roomStatus, finalizePaidOrder, ticketsOf,
} from './core.js';
import { orderPublic, orderAdmin } from './serializers.js';

const STATUS_LABEL = {
  pending_payment: 'pendiente de pago', in_review: 'en revisión', paid: 'pagada', rejected: 'rechazada',
  expired: 'vencida', cancelled: 'cancelada', conflict: 'en conflicto',
};

export async function getOrderByToken(token) {
  const o = await Order.findOne({ token }).lean();
  if (!o) throw notFound('No encontramos esa compra.');
  return o;
}
export async function getOrderById(id) {
  const o = OBJECT_ID_RE.test(String(id)) ? await Order.findById(id).lean() : null;
  if (!o) throw notFound('No encontramos esa compra.');
  return o;
}
/** Relee la orden (auto-repara tickets pendientes de emitir) y la serializa. */
export async function presentOrder(orderOrId, mode = 'public') {
  let o = await Order.findById(orderOrId._id ?? orderOrId).lean();
  if (o?.status === 'paid' && !o.ticketsIssued) o = await finalizePaidOrder(o._id);
  const tickets = await ticketsOf(o._id);
  return mode === 'admin' ? orderAdmin(o, tickets) : orderPublic(o, tickets);
}

function assertMethodEnabled(ctx, method) {
  if (method === 'mercadopago' && !ctx.mp.enabled) {
    throw fieldError('paymentMethod', 'Mercado Pago no está disponible en este momento. Paga por transferencia.');
  }
}

async function insertOrder(doc) {
  for (let i = 0; ; i++) {
    try {
      return (await Order.create({ ...doc, token: randomToken() })).toObject();
    } catch (err) {
      if (!isDuplicateKey(err, 'token') || i >= 2) throw err;
    }
  }
}

/** Cancela órdenes pendientes previas de la cédula (§7.4) y libera sus apartados. */
async function cancelPending(ids, note) {
  for (const id of ids) {
    const o = await Order.findOneAndUpdate(
      { _id: id, status: 'pending_payment' },
      { $set: { status: 'cancelled', expiresAt: null } },
      { returnDocument: 'after' },
    ).lean();
    if (o) {
      await Order.updateOne({ _id: id }, { $set: { notes: appendNote(o.notes, note) } });
      if (o.kind === 'room') await releaseRoom(o.room.number, o._id);
    }
  }
}
const pendingIdsOf = async (cedula, exceptId) =>
  (await Order.find({ 'buyer.cedula': cedula, status: 'pending_payment', _id: { $ne: exceptId } }).select('_id').lean()).map((o) => o._id);

/** Crea la preferencia (o el enlace simulado) y guarda su id. */
async function startCheckout(ctx, order) {
  if (ctx.mp.mock) {
    await Order.updateOne({ _id: order._id }, { $set: { 'mp.preferenceId': `mock-${order._id}` } });
    return `${ctx.config.frontendBaseUrl}/pago/simulado?orden=${encodeURIComponent(order.token)}`;
  }
  const pref = await ctx.mp.createPreference(order);
  await Order.updateOne({ _id: order._id }, { $set: { 'mp.preferenceId': pref.id } });
  return pref.url;
}

/** Marca pagada una orden que vale $0 (descuento de invitado del 100 %). */
async function payFreeOrder(order) {
  await Order.updateOne({ _id: order._id, status: 'pending_payment' }, { $set: { status: 'paid', paidAt: new Date(), expiresAt: null } });
  return finalizePaidOrder(order._id);
}

// ---------- Público ----------
export async function quote(ctx, input) {
  const settings = await getSettings();
  if (input.kind === 'ticket') {
    const guest = await findGuestMatch(input.ids);
    const breakdown = ticketBreakdown(settings, { gender: input.gender, guest });
    let reason = null;
    if (!settings.salesOpen) reason = 'SALES_CLOSED';
    else if (await isSoldOut(settings)) reason = 'SOLD_OUT';
    return { breakdown, available: !reason, reason };
  }
  const room = await Room.findOne({ number: input.roomNumber }).lean();
  if (!room) throw fieldError('roomNumber', 'Esa habitación no existe.');
  let reason = null;
  if (!settings.salesOpen) reason = 'SALES_CLOSED';
  else if (roomStatus(room) !== 'available') reason = 'ROOM_UNAVAILABLE';
  return { breakdown: roomBreakdown(settings, room), available: !reason, reason };
}

export async function createPublicOrder(ctx, input) {
  const settings = await getSettings();
  const now = new Date();
  if (!settings.salesOpen) throw salesClosed();
  assertMethodEnabled(ctx, input.paymentMethod);

  let room = null;
  if (input.kind === 'room') {
    room = await Room.findOne({ number: input.roomNumber }).lean();
    if (!room) throw fieldError('roomNumber', 'Esa habitación no existe.');
    if (input.companions.length > room.capacity - 1) {
      throw fieldError('companions', `Esta habitación admite máximo ${room.capacity - 1} acompañantes.`);
    }
  }
  await assertCanBuy(input.buyer.cedula);
  if (input.kind === 'ticket' && (await isSoldOut(settings))) throw soldOut();

  let breakdown;
  let guest = null;
  if (room) breakdown = roomBreakdown(settings, room, now);
  else {
    guest = await findGuestMatch(input.buyer);
    breakdown = ticketBreakdown(settings, { gender: input.gender, guest, now });
  }

  const _id = new mongoose.Types.ObjectId();
  const older = await pendingIdsOf(input.buyer.cedula, _id);
  const expiresAt = room ? addMinutes(now, ROOM_HOLD_MINUTES) : addMinutes(now, TICKET_ORDER_EXPIRY_HOURS * 60);
  if (room && !(await claimRoom(room.number, _id, { until: expiresAt, takeover: older, now }))) throw roomUnavailable();

  let order;
  try {
    order = await insertOrder({
      _id, kind: input.kind, status: 'pending_payment', paymentMethod: input.paymentMethod,
      amount: breakdown.total, breakdown, gender: input.gender ?? null,
      room: room ? { number: room.number, name: room.name, capacity: room.capacity, privateBathroom: room.privateBathroom } : null,
      buyer: input.buyer, companions: room ? input.companions : [],
      guestId: guest?._id ?? null, guestName: guest?.name ?? null,
      holdExpiresAt: room ? expiresAt : null, expiresAt,
    });
  } catch (err) {
    if (room) await releaseRoom(room.number, _id);
    throw err;
  }

  let checkoutUrl = null;
  if (order.amount === 0) await payFreeOrder(order);
  else if (input.paymentMethod === 'mercadopago') {
    try {
      checkoutUrl = await startCheckout(ctx, order);
    } catch (err) {
      // El comprador nunca recibió el token: se descarta la orden y se libera el apartado.
      await Order.deleteOne({ _id });
      if (room) await releaseRoom(room.number, _id);
      throw err;
    }
  }
  await cancelPending(older, 'Cancelada: el comprador inició una compra nueva.');
  return { order, checkoutUrl };
}

export async function changePaymentMethod(ctx, token, paymentMethod) {
  assertMethodEnabled(ctx, paymentMethod);
  const order = await getOrderByToken(token);
  const now = new Date();
  let updated = null;
  if (order.status === 'pending_payment') {
    if (order.kind === 'room' && (!order.holdExpiresAt || order.holdExpiresAt <= now)) {
      throw invalidState('Tu apartado de la habitación venció. Vuelve a elegirla si sigue disponible.');
    }
    updated = await Order.findOneAndUpdate({ _id: order._id, status: 'pending_payment' }, { $set: { paymentMethod } }, { returnDocument: 'after' }).lean();
  } else if (order.status === 'expired' && order.kind === 'ticket') {
    const settings = await getSettings();
    if (!settings.salesOpen) throw salesClosed();
    if (await isSoldOut(settings)) throw soldOut();
    await assertCanBuy(order.buyer.cedula, order._id);
    const guest = await findGuestMatch(order.buyer);
    const breakdown = ticketBreakdown(settings, { gender: order.gender, guest, now });
    updated = await Order.findOneAndUpdate(
      { _id: order._id, status: 'expired' },
      { $set: {
        status: 'pending_payment', paymentMethod, amount: breakdown.total, breakdown, guestId: guest?._id ?? null,
        guestName: guest?.name ?? null, expiresAt: addMinutes(now, TICKET_ORDER_EXPIRY_HOURS * 60), 'mp.status': null, 'mp.statusDetail': null,
      } },
      { returnDocument: 'after' },
    ).lean();
    if (updated) await cancelPending(await pendingIdsOf(order.buyer.cedula, order._id), 'Cancelada: el comprador reactivó otra compra.');
  } else {
    throw invalidState(`Esta compra ya no está pendiente de pago (está ${STATUS_LABEL[order.status]}).`);
  }
  if (!updated) throw invalidState('La compra cambió de estado. Recarga la página.');
  let checkoutUrl = null;
  if (updated.amount === 0) await payFreeOrder(updated);
  else if (paymentMethod === 'mercadopago') checkoutUrl = await startCheckout(ctx, updated);
  return { order: updated, checkoutUrl };
}

export async function attachReceipt(token, file, reference) {
  const order = await getOrderByToken(token);
  if (order.paymentMethod !== 'transferencia') {
    throw invalidState('Esta compra no es por transferencia. Cambia el método de pago a transferencia antes de subir el comprobante.');
  }
  if (!['pending_payment', 'in_review'].includes(order.status)) {
    throw invalidState(`Ya no se puede subir comprobante: la compra está ${STATUS_LABEL[order.status]}.`);
  }
  if (!file?.buffer?.length) throw fieldError('file', 'Adjunta la imagen del comprobante.');
  const contentType = detectImageType(file.buffer);
  if (!contentType) throw new AppError(415, 'UNSUPPORTED_FILE', 'El comprobante debe ser una imagen JPG, PNG o WEBP.');

  const receipt = await Receipt.create({
    orderId: order._id, contentType, size: file.buffer.length, data: file.buffer,
    sha256: createHash('sha256').update(file.buffer).digest('hex'),
  });
  const now = new Date();
  const set = { status: 'in_review', 'transfer.receiptId': receipt._id, 'transfer.uploadedAt': now, expiresAt: null, holdExpiresAt: null };
  if (reference) set['transfer.reference'] = reference;
  const before = await Order.findOneAndUpdate(
    { _id: order._id, paymentMethod: 'transferencia', status: { $in: ['pending_payment', 'in_review'] } },
    { $set: set },
    { returnDocument: 'before' },
  ).lean();
  if (!before) {
    await Receipt.deleteOne({ _id: receipt._id });
    throw invalidState('La compra cambió de estado. Recarga la página.');
  }
  if (before.transfer?.receiptId) await Receipt.deleteOne({ _id: before.transfer.receiptId });
  // Habitación: queda apartada hasta que el admin decida; si ya la tomó otra orden → conflicto.
  if (order.kind === 'room' && !(await holdForReview(order.room.number, order._id, now))) {
    await Order.updateOne(
      { _id: order._id, status: 'in_review' },
      { $set: { status: 'conflict', notes: appendNote(before.notes, 'Conflicto: al subir el comprobante la habitación ya no estaba disponible.') } },
    );
  }
  return order._id;
}

// ---------- Mercado Pago ----------
/** Aplica el estado de un pago de MP (siempre consultado a MP) a la orden. Idempotente. */
export async function applyMercadoPagoPayment(order, payment, depth = 0) {
  if (!payment || String(payment.external_reference ?? '') !== String(order._id)) return order;
  const now = new Date();
  const mpSet = {
    'mp.paymentId': String(payment.id), 'mp.status': payment.status ?? null,
    'mp.statusDetail': payment.status_detail ?? null, 'mp.lastCheckedAt': now,
  };
  if (payment.status !== 'approved') {
    // Último estado visto, sin pisar un pago ya aprobado.
    await Order.updateOne({ _id: order._id, status: { $ne: 'paid' }, 'mp.status': { $ne: 'approved' } }, { $set: mpSet });
    return Order.findById(order._id).lean();
  }
  if (order.status === 'paid') {
    if (!order.mp?.paymentId) await Order.updateOne({ _id: order._id }, { $set: mpSet });
    return finalizePaidOrder(order._id);
  }
  const toConflict = async (note) => {
    await Order.updateOne({ _id: order._id, status: { $ne: 'paid' } }, { $set: { ...mpSet, status: 'conflict', notes: appendNote(order.notes, note) } });
    return Order.findById(order._id).lean();
  };
  if (payment.currency_id !== 'COP' || !(Number(payment.transaction_amount) >= order.amount)) {
    return toConflict(`Conflicto: pago de Mercado Pago ${payment.id} aprobado por ${payment.currency_id} ${payment.transaction_amount}, no cuadra con $${order.amount}.`);
  }
  if (order.status === 'rejected' || order.status === 'conflict') {
    return toConflict(`Conflicto: pago de Mercado Pago ${payment.id} aprobado con la compra ${STATUS_LABEL[order.status]}.`);
  }
  if (await findActiveTicketByCedula(order.buyer.cedula, order._id)) {
    return toConflict(`Conflicto: pago ${payment.id} aprobado pero la cédula ya tenía otra entrada válida (posible doble pago).`);
  }
  const set = { ...mpSet, status: 'paid', paidAt: now, paymentMethod: 'mercadopago', expiresAt: null };
  if (order.status === 'in_review') set.notes = appendNote(order.notes, 'Pagada por Mercado Pago con un comprobante de transferencia en revisión: revisa si hubo doble pago.');
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: { $in: ['pending_payment', 'expired', 'cancelled', 'in_review'] } },
    { $set: set },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) {
    const fresh = await Order.findById(order._id).lean();
    return depth < 3 && fresh.status !== order.status ? applyMercadoPagoPayment(fresh, payment, depth + 1) : fresh;
  }
  return finalizePaidOrder(updated._id);
}

/** Busca el pago aprobado (o el último) de una orden en MP. */
async function checkOrderPayments(ctx, order) {
  const results = await ctx.mp.searchPayments(String(order._id));
  const payment = results.find((p) => p.status === 'approved') || results[0];
  if (!payment) {
    await Order.updateOne({ _id: order._id }, { $set: { 'mp.lastCheckedAt': new Date() } });
    return order;
  }
  return applyMercadoPagoPayment(order, payment);
}

export async function verifyMercadoPago(ctx, token, paymentId) {
  const order = await getOrderByToken(token);
  if (ctx.mp.mock || !ctx.mp.enabled || (order.status === 'paid' && order.ticketsIssued)) return order._id;
  let current = order;
  if (paymentId && /^\d{1,20}$/.test(paymentId)) {
    const payment = await ctx.mp.getPayment(paymentId);
    if (payment && String(payment.external_reference) === String(order._id)) current = await applyMercadoPagoPayment(order, payment);
  }
  if (current.status !== 'paid') await checkOrderPayments(ctx, current);
  return order._id;
}

export async function mockPay(ctx, token, outcome) {
  if (!ctx.mp.mock) throw notFound('Ruta no encontrada.');
  const order = await getOrderByToken(token);
  if (order.paymentMethod !== 'mercadopago') throw invalidState('Esta compra no es con Mercado Pago.');
  const approved = outcome === 'approved';
  await applyMercadoPagoPayment(order, {
    id: `mock-${Date.now()}`, status: approved ? 'approved' : 'rejected', status_detail: approved ? 'accredited' : 'cc_rejected_other_reason',
    currency_id: 'COP', transaction_amount: order.amount, external_reference: String(order._id),
  });
  return order._id;
}

export async function processPaymentNotification(ctx, paymentId) {
  const payment = await ctx.mp.getPayment(paymentId);
  const ref = String(payment?.external_reference ?? '');
  if (!OBJECT_ID_RE.test(ref)) return;
  const order = await Order.findById(ref).lean();
  if (order) await applyMercadoPagoPayment(order, payment);
}

// ---------- Admin ----------
export async function approveOrder(orderId, admin, notes) {
  const order = await getOrderById(orderId);
  const from = ['pending_payment', 'in_review', 'conflict'];
  if (!from.includes(order.status)) {
    throw invalidState(order.status === 'paid' ? 'Esta compra ya está aprobada.' : `No se puede aprobar: la compra está ${STATUS_LABEL[order.status]}.`);
  }
  if (order.kind === 'room') {
    const room = await Room.findOne({ number: order.room.number }).lean();
    const mine = room && String(room.orderId) === String(order._id);
    const free = room && !room.booked && !room.blocked && (!room.orderId || (room.holdExpiresAt && room.holdExpiresAt < new Date()));
    if (!mine && !free) throw roomUnavailable('La habitación la tiene otra compra. Recházala o libérala antes de aprobar esta.');
  }
  const now = new Date();
  const set = { status: 'paid', paidAt: order.paidAt || now, reviewedBy: admin._id, reviewedByName: admin.name, reviewedAt: now, expiresAt: null };
  if (notes) set.notes = appendNote(order.notes, notes);
  const updated = await Order.findOneAndUpdate({ _id: order._id, status: { $in: from } }, { $set: set }, { returnDocument: 'after' }).lean();
  if (!updated) throw invalidState('La compra cambió de estado mientras la revisabas. Recarga.');
  const final = await finalizePaidOrder(updated._id);
  if (final.status === 'conflict') throw roomUnavailable('La habitación la tomó otra compra. Quedó en conflicto.');
  return final._id;
}

export async function rejectOrder(orderId, admin, reason) {
  const order = await getOrderById(orderId);
  const now = new Date();
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: { $in: ['pending_payment', 'in_review', 'conflict'] } },
    { $set: { status: 'rejected', rejectReason: reason, reviewedBy: admin._id, reviewedByName: admin.name, reviewedAt: now, expiresAt: null } },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw invalidState(`No se puede rechazar: la compra está ${STATUS_LABEL[order.status]}.`);
  if (updated.kind === 'room') await releaseRoom(updated.room.number, updated._id);
  return updated._id;
}

export async function createManualOrder(input, admin) {
  const settings = await getSettings();
  const now = new Date();
  let room = null;
  if (input.kind === 'room') {
    room = await Room.findOne({ number: input.roomNumber }).lean();
    if (!room) throw fieldError('roomNumber', 'Esa habitación no existe.');
    if (input.companions.length > room.capacity - 1) throw fieldError('companions', `Máximo ${room.capacity - 1} acompañantes.`);
  }
  await assertCanBuy(input.buyer.cedula);
  const courtesy = input.manualMethod === 'cortesia';
  const guest = !room && !courtesy ? await findGuestMatch(input.buyer) : null;
  const auto = room ? roomBreakdown(settings, room, now) : ticketBreakdown(settings, { gender: input.gender, guest, now });
  const amount = courtesy ? 0 : input.amount ?? auto.total;
  const discount = Math.max(0, auto.base - amount);
  const breakdown = amount === auto.total
    ? auto
    : { ...auto, discount, discountPercent: auto.base > 0 ? Math.round((discount * 100) / auto.base) : 0, total: amount };

  const _id = new mongoose.Types.ObjectId();
  const older = await pendingIdsOf(input.buyer.cedula, _id);
  if (room && !(await claimRoom(room.number, _id, { book: true, takeover: older, now }))) throw roomUnavailable();
  try {
    await insertOrder({
      _id, kind: input.kind, status: 'paid', paymentMethod: 'manual', manualMethod: input.manualMethod, amount, breakdown,
      gender: input.gender ?? null,
      room: room ? { number: room.number, name: room.name, capacity: room.capacity, privateBathroom: room.privateBathroom } : null,
      buyer: input.buyer, companions: room ? input.companions : [], guestId: guest?._id ?? null, guestName: guest?.name ?? null,
      notes: input.notes || '', reviewedBy: admin._id, reviewedByName: admin.name, reviewedAt: now, paidAt: now,
    });
  } catch (err) {
    if (room) await Room.updateOne({ number: room.number, orderId: _id }, { $set: { orderId: null, booked: false, holdExpiresAt: null } });
    throw err;
  }
  await cancelPending(older, 'Cancelada: el admin registró una venta manual.');
  await finalizePaidOrder(_id);
  return _id;
}

// ---------- Job periódico ----------
export async function runOrderMaintenance(ctx, now = new Date()) {
  const realMp = ctx.mp.enabled && !ctx.mp.mock;
  // 1) Vencer pendientes (antes, última consulta a MP para no vencer algo ya pagado).
  const due = await Order.find({ status: 'pending_payment', expiresAt: { $lte: now } }).limit(200).lean();
  for (const o of due) {
    if (realMp && o.paymentMethod === 'mercadopago' && o.mp?.preferenceId) {
      try {
        const r = await checkOrderPayments(ctx, o);
        if (r?.status !== 'pending_payment') continue;
      } catch (err) {
        ctx.logger.warn('No se pudo consultar MP antes de vencer la orden', String(o._id), err.message);
      }
    }
    const r = await Order.findOneAndUpdate({ _id: o._id, status: 'pending_payment', expiresAt: { $lte: now } }, { $set: { status: 'expired' } }).lean();
    if (r && o.kind === 'room') await releaseRoom(o.room.number, o._id);
  }
  // 2) Apartados vencidos que quedaron sueltos.
  await Room.updateMany({ booked: false, holdExpiresAt: { $lte: now } }, { $set: { orderId: null, holdExpiresAt: null } });
  // 3) Auto-reparación: órdenes pagadas sin tickets emitidos.
  for (const o of await Order.find({ status: 'paid', ticketsIssued: false }).select('_id').limit(50).lean()) {
    await finalizePaidOrder(o._id).catch((err) => ctx.logger.error('No se pudieron emitir tickets', String(o._id), err.message));
  }
  // 4) Conciliación con MP (respaldo si el webhook no llegó).
  if (realMp) {
    const stale = new Date(now.getTime() - MP_RECONCILE_EVERY_MS);
    const list = await Order.find({
      status: 'pending_payment', paymentMethod: 'mercadopago', 'mp.preferenceId': { $ne: null },
      createdAt: { $lte: new Date(now.getTime() - 120_000) },
      $or: [{ 'mp.lastCheckedAt': null }, { 'mp.lastCheckedAt': { $lt: stale } }],
    }).sort({ 'mp.lastCheckedAt': 1 }).limit(10).lean();
    for (const o of list) {
      await checkOrderPayments(ctx, o).catch((err) => ctx.logger.warn('Conciliación MP falló', String(o._id), err.message));
    }
  }
}
