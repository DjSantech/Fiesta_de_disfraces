// Eliminación de compras con auditoría (borrado real + registro inmutable).
import { randomUUID } from 'node:crypto';
import { Order, Ticket, Receipt, Room, Guest, DoorEntry } from '../models/index.js';
import { AppError, notFound } from '../lib/util.js';
import { logAudit, discardAudit, orderSummary } from './audit.js';

export const hasCheckins = () => new AppError(409, 'HAS_CHECKINS',
  'Esta compra tiene entradas que ya ingresaron. Primero deshaz el ingreso (Entradas → Restaurar) o anula la entrada de puerta; después podrás eliminarla.');

/** Elimina una compra completa. Lanza 404 / 409 HAS_CHECKINS. Devuelve el resumen del resultado. */
export async function deleteOrder(orderId, user, reason, batch = null) {
  const order = await Order.findById(orderId).lean();
  if (!order) throw notFound('No encontramos esa compra.');
  const tickets = await Ticket.find({ orderId: order._id }).sort({ seq: 1 }).lean();
  const ids = tickets.map((t) => t._id);
  const entered = tickets.some((t) => t.status === 'used') || (ids.length && await DoorEntry.exists({ 'ticket.id': { $in: ids }, voided: false }));
  if (entered) throw hasCheckins();

  const room = await Room.findOne({ orderId: order._id }).select('number booked holdExpiresAt').lean();
  const guest = await Guest.findOne({ redeemedOrderId: order._id }).select('_id').lean();
  const result = { orderId: String(order._id), tickets: tickets.length, roomReleased: room ? room.number : null, guestUnredeemed: !!guest };

  // Primero el registro; si el borrado falla, se retira.
  const entry = await logAudit(user, {
    action: 'order.delete', target: { type: 'order', id: order._id, summary: orderSummary(order, tickets) }, reason,
    meta: { ticketsDeleted: tickets.length, roomReleased: result.roomReleased, guestUnredeemed: result.guestUnredeemed, ...(batch ? { batch } : {}) },
  });
  try {
    await Room.updateOne({ orderId: order._id }, { $set: { orderId: null, booked: false, holdExpiresAt: null } });
    await Guest.updateOne({ redeemedOrderId: order._id }, { $set: { redeemed: false, redeemedOrderId: null, redeemedEntryId: null, redeemedAt: null } });
    await Receipt.deleteMany({ $or: [{ orderId: order._id }, ...(order.transfer?.receiptId ? [{ _id: order.transfer.receiptId }] : [])] });
    await Ticket.deleteMany({ orderId: order._id });
    await Order.deleteOne({ _id: order._id });
  } catch (err) {
    await discardAudit(entry);
    throw err;
  }
  return { ...result, auditId: String(entry._id) };
}

export const newBatchId = () => randomUUID();
