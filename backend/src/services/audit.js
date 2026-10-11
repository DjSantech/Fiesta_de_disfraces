// Auditoría: registro inmutable de acciones sensibles del admin (quién, cuándo, por qué).
import { AuditLog } from '../models/index.js';
import { last4 } from '../lib/util.js';

export const actorOf = (u) => ({ id: String(u.id ?? u._id), username: u.username, name: u.name, role: u.role });

/** Escribe el registro y devuelve el documento. Hacerlo ANTES de la acción destructiva. */
export async function logAudit(user, { action, target, reason = null, meta = {} }) {
  return AuditLog.create({
    at: new Date(), actor: actorOf(user), action,
    target: { type: target.type, id: String(target.id), summary: target.summary ?? {} },
    reason: reason || null, meta,
  });
}

/** Mejor esfuerzo: si la acción falló, quita el registro recién creado. */
export const discardAudit = (entry) => AuditLog.deleteOne({ _id: entry._id }).catch(() => {});

/** Resumen mínimo de una compra (sin cédula completa, celular ni token). */
export function orderSummary(o, tickets) {
  return {
    buyerName: o.buyer?.name ?? '', cedulaLast4: last4(o.buyer?.cedula), instagram: o.buyer?.instagram || null,
    kind: o.kind, gender: o.gender ?? null, roomNumber: o.room?.number ?? null, amount: o.amount,
    paymentMethod: o.paymentMethod, status: o.status, phase: o.breakdown?.phase ?? null, createdAt: o.createdAt ?? null,
    ticketCodes: tickets.map((t) => t.code), ticketCount: tickets.length,
  };
}

export function ticketSummary(t, order) {
  return {
    code: t.code, holderName: t.holderName, cedulaLast4: last4(t.holderCedula), kind: t.kind, gender: t.gender ?? null,
    roomNumber: t.roomNumber ?? null, status: t.status, buyerName: t.buyerName || order?.buyer?.name || '',
  };
}
