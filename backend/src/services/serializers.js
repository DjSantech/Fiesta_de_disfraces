// Formas de respuesta exactas del contrato (docs/CONTRATO_API.md). Nunca _id, __v ni passwordHash.
import { iso, maskPhone, last4 } from '../lib/util.js';

const id = (v) => (v ? String(v) : null);

export const breakdownOut = (b = {}) => ({
  phase: b.phase ?? null, base: b.base ?? 0, isGuest: !!b.isGuest,
  discountPercent: b.discountPercent ?? 0, discount: b.discount ?? 0, total: b.total ?? 0,
});
const roomSnap = (r) => (r ? { number: r.number, name: r.name, capacity: r.capacity, privateBathroom: !!r.privateBathroom } : null);
const holdOut = (o) => (o.kind === 'room' && o.status === 'pending_payment' ? iso(o.holdExpiresAt) : null);

export const ticketPublic = (t) => ({
  token: t.token, code: t.code, holderName: t.holderName, kind: t.kind,
  gender: t.gender ?? null, phase: t.phase ?? null, isGuest: !!t.isGuest,
  roomNumber: t.kind === 'room' ? t.roomNumber ?? null : null,
  status: t.status, checkedInAt: iso(t.checkedInAt),
});

export const orderPublic = (o, tickets = []) => ({
  token: o.token, kind: o.kind, status: o.status, paymentMethod: o.paymentMethod,
  amount: o.amount, breakdown: breakdownOut(o.breakdown), gender: o.gender ?? null, room: roomSnap(o.room),
  buyer: { name: o.buyer.name, instagram: o.buyer.instagram || '', phoneMasked: maskPhone(o.buyer.phone) },
  companionsCount: o.companions?.length ?? 0,
  holdExpiresAt: holdOut(o),
  receiptUploaded: !!o.transfer?.receiptId,
  transferReference: o.transfer?.reference || null,
  mpStatus: o.mp?.status ?? null,
  rejectReason: o.rejectReason ?? null,
  createdAt: iso(o.createdAt), paidAt: iso(o.paidAt),
  tickets: o.status === 'paid' ? tickets.map(ticketPublic) : [],
});

export const orderAdmin = (o, tickets = []) => ({
  id: id(o._id), token: o.token, kind: o.kind, status: o.status,
  paymentMethod: o.paymentMethod, manualMethod: o.manualMethod ?? null,
  amount: o.amount, breakdown: breakdownOut(o.breakdown), gender: o.gender ?? null, room: roomSnap(o.room),
  buyer: { name: o.buyer.name, cedula: o.buyer.cedula, phone: o.buyer.phone, instagram: o.buyer.instagram || '', email: o.buyer.email || '' },
  companions: (o.companions || []).map((c) => ({ name: c.name, cedula: c.cedula ?? null })),
  guest: o.guestId ? { id: id(o.guestId), name: o.guestName } : null,
  transfer: o.paymentMethod === 'transferencia'
    ? { hasReceipt: !!o.transfer?.receiptId, reference: o.transfer?.reference || null, uploadedAt: iso(o.transfer?.uploadedAt) }
    : null,
  mp: o.mp?.preferenceId || o.mp?.paymentId
    ? { preferenceId: o.mp.preferenceId ?? null, paymentId: o.mp.paymentId ?? null, status: o.mp.status ?? null, statusDetail: o.mp.statusDetail ?? null }
    : null,
  holdExpiresAt: holdOut(o),
  rejectReason: o.rejectReason ?? null,
  notes: o.notes || '',
  reviewedBy: o.reviewedBy ? { id: id(o.reviewedBy), name: o.reviewedByName } : null,
  reviewedAt: iso(o.reviewedAt),
  tickets: tickets.map(ticketPublic),
  createdAt: iso(o.createdAt), updatedAt: iso(o.updatedAt), paidAt: iso(o.paidAt),
});

export const ticketAdmin = (t, order) => ({
  ...ticketPublic(t),
  id: id(t._id),
  holderCedula: t.holderCedula ?? null,
  order: order
    ? { id: id(order._id), token: order.token, kind: order.kind, buyer: { name: order.buyer.name, phone: order.buyer.phone, instagram: order.buyer.instagram || '' } }
    : null,
  checkedInBy: t.checkedInBy ? { id: id(t.checkedInBy), name: t.checkedInByName } : null,
  voidReason: t.voidReason ?? null,
  createdAt: iso(t.createdAt),
});

export const ticketDoor = (t) => ({
  id: id(t._id), code: t.code, holderName: t.holderName, cedulaLast4: last4(t.holderCedula),
  gender: t.gender ?? null, kind: t.kind, phase: t.phase ?? null, isGuest: !!t.isGuest,
  roomNumber: t.kind === 'room' ? t.roomNumber ?? null : null, buyerName: t.buyerName || '',
  status: t.status, checkedInAt: iso(t.checkedInAt), checkedInByName: t.checkedInByName ?? null,
});

export const doorEntryOut = (e) => ({
  id: id(e._id), source: e.source,
  ticket: e.ticket ? { id: id(e.ticket.id), code: e.ticket.code, kind: e.ticket.kind, roomNumber: e.ticket.roomNumber ?? null } : null,
  name: e.name, cedula: e.cedula ?? null, phone: e.phone ?? null,
  category: e.category, gender: e.gender ?? null, guestListMatch: !!e.guestListMatch,
  paymentMethod: e.paymentMethod, entryAmount: e.entryAmount,
  vehicle: e.vehicle ? { type: e.vehicle.type, plate: e.vehicle.plate } : null, parkingAmount: e.parkingAmount,
  helmet: e.helmet ? { stored: !!e.helmet.stored, tag: e.helmet.tag ?? null, returned: !!e.helmet.returned, returnedAt: iso(e.helmet.returnedAt) } : null,
  helmetAmount: e.helmetAmount, totalAmount: e.totalAmount, notes: e.notes || '',
  createdBy: { id: id(e.createdBy), name: e.createdByName || '' }, createdAt: iso(e.createdAt),
  voided: !!e.voided, voidReason: e.voidReason ?? null,
});

export const userOut = (u) => ({
  id: id(u._id), username: u.username, name: u.name, role: u.role, active: !!u.active,
  createdAt: iso(u.createdAt), lastLoginAt: iso(u.lastLoginAt),
});

export const guestOut = (g) => ({
  id: id(g._id), name: g.name, cedula: g.cedula ?? null, phone: g.phone ?? null, instagram: g.instagram ?? null,
  discountPercent: g.discountPercent ?? null, note: g.note || '', redeemed: !!g.redeemed,
  redeemedOrderId: id(g.redeemedOrderId), createdAt: iso(g.createdAt),
});

export const expenseOut = (x) => ({
  id: id(x._id), concept: x.concept, category: x.category, amount: x.amount, paid: !!x.paid,
  paidAt: iso(x.paidAt), dueDate: iso(x.dueDate), responsible: x.responsible || '', notes: x.notes || '',
  createdAt: iso(x.createdAt), updatedAt: iso(x.updatedAt),
});

export const productOut = (p) => ({
  id: id(p._id), name: p.name, category: p.category, price: p.price, cost: p.cost ?? null,
  stock: p.stock ?? null, active: !!p.active, sortOrder: p.sortOrder ?? 0, soldQty: p.soldQty ?? 0,
});

export const saleOut = (s) => ({
  id: id(s._id), number: s.number,
  items: s.items.map((i) => ({ productId: id(i.productId), name: i.name, category: i.category, price: i.price, qty: i.qty, subtotal: i.subtotal })),
  total: s.total, courtesyValue: s.courtesyValue ?? 0, paymentMethod: s.paymentMethod, note: s.note || '',
  createdBy: { id: id(s.createdBy), name: s.createdByName || '' }, createdAt: iso(s.createdAt),
  voided: !!s.voided, voidedAt: iso(s.voidedAt), voidReason: s.voidReason ?? null,
});

export const settingsOut = (s) => ({
  eventStartsAt: iso(s.eventStartsAt), presaleEndsAt: iso(s.presaleEndsAt), salesOpen: !!s.salesOpen,
  capacity: s.capacity,
  prices: { preventa: { ...s.prices.preventa }, puerta: { ...s.prices.puerta } },
  guestDiscountPercent: s.guestDiscountPercent,
  parking: { carro: s.parking.carro, moto: s.parking.moto, casco: s.parking.casco },
  paymentAccounts: s.paymentAccounts.map((a) => ({ label: a.label, number: a.number, holder: a.holder || '' })),
  transferInstructions: s.transferInstructions,
  contact: { whatsapp: s.contact.whatsapp, instagram: s.contact.instagram, adminName: s.contact.adminName },
  location: { revealed: !!s.location.revealed, name: s.location.name, mapsUrl: s.location.mapsUrl, notes: s.location.notes },
  publicCounter: !!s.publicCounter,
  updatedAt: iso(s.updatedAt),
});
