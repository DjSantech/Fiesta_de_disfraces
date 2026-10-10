// Operación de la noche: portería (escaneo, check-in, venta en puerta) y barra (ventas con stock).
import { Ticket, DoorEntry, Guest, Order, Product, Sale, nextSequence } from '../models/index.js';
import {
  AppError, notFound, invalidState, alreadyHasTicket, normalizeTicketCode, TOKEN_RE, bogotaTime, iso, last4,
  textRegex, escapeRegex, normalizePlate,
} from '../lib/util.js';
import { fieldError } from '../middleware/validate.js';
import { getSettings, guestBreakdown, findGuestMatch } from './core.js';
import { ticketDoor, doorEntryOut, saleOut } from './serializers.js';

// ---------- Portería ----------
/** Texto crudo del QR o tecleado → { token } | { code } | {}. */
export function parseScanValue(raw) {
  const value = String(raw ?? '').trim();
  const m = value.match(/\/entrada\/([A-Za-z0-9_-]+)/);
  if (m) return { token: m[1] };
  const code = normalizeTicketCode(value);
  if (code) return { code };
  if (TOKEN_RE.test(value)) return { token: value };
  return {};
}

async function entryForTicket(t) {
  if (t.entryId) {
    const e = await DoorEntry.findById(t.entryId).lean();
    if (e) return e;
  }
  return DoorEntry.findOne({ 'ticket.id': t._id, voided: false }).sort({ createdAt: -1 }).lean();
}

export async function scan(value) {
  const p = parseScanValue(value);
  const t = p.token ? await Ticket.findOne({ token: p.token }).lean() : p.code ? await Ticket.findOne({ code: p.code }).lean() : null;
  if (!t) return { result: 'not_found', ticket: null, entry: null };
  const entry = t.status === 'used' ? await entryForTicket(t) : null;
  return { result: t.status, ticket: ticketDoor(t), entry: entry ? doorEntryOut(entry) : null };
}

/** Parqueadero y casco según ajustes; cortesía = $0. */
function extras(settings, { vehicle, helmet, paymentMethod }) {
  const free = paymentMethod === 'cortesia';
  const parkingAmount = vehicle && !free ? settings.parking[vehicle.type] : 0;
  const helmetAmount = helmet?.stored && !free ? settings.parking.casco : 0;
  return {
    vehicle: vehicle ? { type: vehicle.type, plate: vehicle.plate } : null,
    helmet: helmet?.stored ? { stored: true, tag: helmet.tag || null, returned: !!helmet.returned, returnedAt: helmet.returned ? new Date() : null } : null,
    parkingAmount, helmetAmount,
  };
}
const categoryOf = (t) => (t.kind === 'room' ? 'habitacion' : t.kind === 'cortesia' ? 'cortesia' : t.isGuest ? 'invitado' : t.gender || 'mujer');

export async function checkIn(input, user) {
  const settings = await getSettings();
  const now = new Date();
  // Un solo uso: solo gana quien encuentre el ticket todavía 'valid'.
  const t = await Ticket.findOneAndUpdate(
    { _id: input.ticketId, status: 'valid' },
    { $set: { status: 'used', checkedInAt: now, checkedInBy: user._id, checkedInByName: user.name } },
    { returnDocument: 'after' },
  ).lean();
  if (!t) {
    const cur = await Ticket.findById(input.ticketId).lean();
    if (!cur) throw notFound('No encontramos esa entrada.');
    if (cur.status === 'used') {
      throw new AppError(409, 'TICKET_ALREADY_USED', `YA INGRESÓ a las ${bogotaTime(cur.checkedInAt)}${cur.checkedInByName ? ` (registró: ${cur.checkedInByName})` : ''}.`,
        { checkedInAt: iso(cur.checkedInAt), checkedInByName: cur.checkedInByName ?? null });
    }
    throw new AppError(409, 'TICKET_VOID', 'Esta entrada está anulada. No puede ingresar con ella.');
  }
  const paymentMethod = input.paymentMethod || 'efectivo';
  const x = extras(settings, { ...input, paymentMethod });
  let entry;
  try {
    entry = await DoorEntry.create({
      source: 'ticket', ticket: { id: t._id, code: t.code, kind: t.kind, roomNumber: t.roomNumber ?? null },
      name: t.holderName, cedula: t.holderCedula, phone: null, category: categoryOf(t), gender: t.gender, guestListMatch: !!t.isGuest,
      paymentMethod, entryAmount: 0, ...x, totalAmount: x.parkingAmount + x.helmetAmount,
      notes: input.notes || '', createdBy: user._id, createdByName: user.name,
    });
  } catch (err) {
    await Ticket.updateOne({ _id: t._id, status: 'used', checkedInAt: now }, { $set: { status: 'valid', checkedInAt: null, checkedInBy: null, checkedInByName: null } });
    throw err;
  }
  const ticket = await Ticket.findByIdAndUpdate(t._id, { $set: { entryId: entry._id } }, { returnDocument: 'after' }).lean();
  return { entry: doorEntryOut(entry.toObject()), ticket: ticketDoor(ticket) };
}

export async function doorSale(input, user) {
  const settings = await getSettings();
  if (input.cedula) {
    const t = await Ticket.findOne({ holderCedula: input.cedula, status: 'valid' }).select('_id').lean();
    if (t) throw alreadyHasTicket('Esta cédula ya tiene una entrada válida: haz el check-in en vez de cobrar.', { ticketId: String(t._id) });
  }
  const gender = input.category === 'invitado' ? input.gender : input.category;
  const guest = await findGuestMatch({ cedula: input.cedula, phone: input.phone });
  const base = settings.prices.puerta[gender];
  let entryAmount = base;
  if (input.category === 'invitado') entryAmount = guestBreakdown(settings, { gender, guest, phase: 'general', base }).total;
  if (input.paymentMethod === 'cortesia') entryAmount = 0;
  const x = extras(settings, input);
  const entry = await DoorEntry.create({
    source: 'door_sale', ticket: null, name: input.name, cedula: input.cedula, phone: input.phone,
    category: input.category, gender, guestListMatch: !!guest, guestId: input.category === 'invitado' ? guest?._id ?? null : null,
    paymentMethod: input.paymentMethod, entryAmount, ...x, totalAmount: entryAmount + x.parkingAmount + x.helmetAmount,
    notes: input.notes || '', createdBy: user._id, createdByName: user.name,
  });
  if (input.category === 'invitado' && guest) {
    await Guest.updateOne({ _id: guest._id, redeemed: false }, { $set: { redeemed: true, redeemedEntryId: entry._id, redeemedAt: new Date() } });
  }
  return doorEntryOut(entry.toObject());
}

export async function updateEntry(id, patch) {
  const e = await DoorEntry.findById(id).lean();
  if (!e) throw notFound('No encontramos ese registro.');
  if (e.voided) throw invalidState('Este registro está anulado.');
  const settings = await getSettings();
  const free = e.paymentMethod === 'cortesia';
  const set = {};
  if (patch.vehicle !== undefined) {
    set.vehicle = patch.vehicle ? { type: patch.vehicle.type, plate: patch.vehicle.plate } : null;
    set.parkingAmount = patch.vehicle && !free ? settings.parking[patch.vehicle.type] : 0;
  }
  if (patch.helmet !== undefined) {
    if (!patch.helmet || !patch.helmet.stored) {
      set.helmet = null;
      set.helmetAmount = 0;
    } else {
      const returned = patch.helmet.returned ?? e.helmet?.returned ?? false;
      set.helmet = {
        stored: true, tag: patch.helmet.tag !== undefined ? patch.helmet.tag || null : e.helmet?.tag ?? null, returned,
        returnedAt: returned ? e.helmet?.returnedAt || new Date() : null,
      };
      set.helmetAmount = free ? 0 : settings.parking.casco;
    }
  }
  if (patch.notes !== undefined) set.notes = patch.notes;
  const parking = set.parkingAmount ?? e.parkingAmount;
  const helmet = set.helmetAmount ?? e.helmetAmount;
  set.totalAmount = e.entryAmount + parking + helmet;
  return doorEntryOut(await DoorEntry.findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after' }).lean());
}

/** Anula un registro de puerta; si venía de un QR, el ticket vuelve a 'valid'. */
export async function voidEntry(id, reason) {
  const e = await DoorEntry.findOneAndUpdate({ _id: id, voided: false }, { $set: { voided: true, voidReason: reason, voidedAt: new Date() } }, { returnDocument: 'after' }).lean();
  if (!e) {
    if (!(await DoorEntry.exists({ _id: id }))) throw notFound('No encontramos ese registro.');
    throw invalidState('Este registro ya estaba anulado.');
  }
  if (e.ticket?.id) {
    await Ticket.updateOne({ _id: e.ticket.id, status: 'used', entryId: e._id }, { $set: { status: 'valid', checkedInAt: null, checkedInBy: null, checkedInByName: null, entryId: null } });
  }
  if (e.guestId) await Guest.updateOne({ _id: e.guestId, redeemedEntryId: e._id }, { $set: { redeemed: false, redeemedEntryId: null, redeemedAt: null } });
  return doorEntryOut(e);
}

export function entryFilter({ q, vehicle, helmet, includeVoided }) {
  const f = {};
  if (!includeVoided) f.voided = false;
  if (vehicle === 'any') f.vehicle = { $ne: null };
  else if (vehicle) f['vehicle.type'] = vehicle;
  if (helmet === 'stored') f['helmet.stored'] = true;
  if (q) {
    const rx = textRegex(q);
    const plain = new RegExp(escapeRegex(q), 'i');
    const or = [{ name: rx }, { cedula: plain }, { phone: plain }, { 'vehicle.plate': new RegExp(escapeRegex(normalizePlate(q)), 'i') }, { 'ticket.code': plain }, { 'helmet.tag': plain }];
    const code = normalizeTicketCode(q);
    if (code) or.push({ 'ticket.code': code });
    f.$or = or;
  }
  return f;
}

export async function lookup(q) {
  const rx = textRegex(q);
  const plain = new RegExp(escapeRegex(q), 'i');
  const digits = q.replace(/\D/g, '');
  const code = normalizeTicketCode(q);
  const orderIds = digits.length >= 3
    ? (await Order.find({ 'buyer.phone': new RegExp(escapeRegex(digits)) }).select('_id').limit(50).lean()).map((o) => o._id)
    : [];
  const tor = [{ holderName: rx }, { buyerName: rx }, { holderCedula: plain }, { code: plain }];
  if (code) tor.push({ code });
  if (orderIds.length) tor.push({ orderId: { $in: orderIds } });
  const settings = await getSettings();
  const [tickets, guests, entries] = await Promise.all([
    Ticket.find({ $or: tor }).sort({ createdAt: -1 }).limit(10).lean(),
    Guest.find({ redeemed: false, $or: [{ name: rx }, { cedula: plain }, { phone: plain }, { instagram: plain }] }).limit(10).lean(),
    DoorEntry.find(entryFilter({ q })).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  return {
    tickets: tickets.map(ticketDoor),
    guests: guests.map((g) => ({ id: String(g._id), name: g.name, cedulaLast4: last4(g.cedula), discountPercent: g.discountPercent ?? null })),
    entries: entries.map(doorEntryOut),
  };
}

// ---------- Barra ----------
export async function createSale(input, user) {
  // Suma cantidades si el mismo producto viene repetido.
  const qty = new Map();
  for (const it of input.items) qty.set(it.productId, (qty.get(it.productId) || 0) + it.qty);
  const products = await Product.find({ _id: { $in: [...qty.keys()] }, deleted: false }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const fields = {};
  input.items.forEach((it, i) => {
    const p = byId.get(it.productId);
    if (!p || !p.active) fields[`items.${i}.productId`] = 'Este producto ya no está disponible.';
  });
  if (Object.keys(fields).length) throw new AppError(400, 'VALIDATION_ERROR', 'Hay productos que ya no están disponibles.', { fields });

  const items = [...qty.entries()].map(([pid, q]) => {
    const p = byId.get(pid);
    return { productId: p._id, name: p.name, category: p.category, price: p.price, qty: q, subtotal: p.price * q };
  });
  const gross = items.reduce((s, i) => s + i.subtotal, 0);
  const courtesy = input.paymentMethod === 'cortesia';
  const number = await nextSequence('bar_sale');
  const sale = await Sale.create({
    number, items, total: courtesy ? 0 : gross, courtesyValue: courtesy ? gross : 0, paymentMethod: input.paymentMethod,
    note: input.note || '', createdBy: user._id, createdByName: user.name,
  });
  const warnings = [];
  try {
    for (const it of items) {
      const p = await Product.findOneAndUpdate(
        { _id: it.productId },
        byId.get(String(it.productId)).stock === null ? { $inc: { soldQty: it.qty } } : { $inc: { soldQty: it.qty, stock: -it.qty } },
        { returnDocument: 'after' },
      ).lean();
      if (p?.stock !== null && p?.stock !== undefined) {
        if (p.stock === 0) warnings.push(`${p.name} quedó sin stock`);
        else if (p.stock < 0) warnings.push(`${p.name} tiene stock negativo (${p.stock}): revisa el inventario`);
      }
    }
  } catch (err) {
    await Sale.deleteOne({ _id: sale._id });
    throw err;
  }
  return { sale: saleOut(sale.toObject()), warnings };
}

export async function voidSale(id, reason) {
  const s = await Sale.findOneAndUpdate({ _id: id, voided: false }, { $set: { voided: true, voidedAt: new Date(), voidReason: reason } }, { returnDocument: 'after' }).lean();
  if (!s) {
    if (!(await Sale.exists({ _id: id }))) throw notFound('No encontramos esa venta.');
    throw invalidState('Esta venta ya estaba anulada.');
  }
  for (const it of s.items) {
    await Product.updateOne({ _id: it.productId, stock: { $ne: null } }, { $inc: { stock: it.qty } });
    await Product.updateOne({ _id: it.productId }, { $inc: { soldQty: -it.qty } });
  }
  return saleOut(s);
}

export const assertProduct = async (id) => {
  const p = await Product.findOne({ _id: id, deleted: false }).lean();
  if (!p) throw notFound('No encontramos ese producto.');
  return p;
};
export { fieldError };
