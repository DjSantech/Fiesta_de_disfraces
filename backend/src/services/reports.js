// Estadísticas (dashboard, portería, barra) y exportación CSV.
import { Ticket, Order, Room, DoorEntry, Sale, Product, Expense } from '../models/index.js';
import { POS_METHODS, EXPENSE_CATEGORIES } from '../constants.js';
import { toCsv } from '../lib/util.js';
import { getSettings, roomStatus } from './core.js';

const countBy = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));

async function doorTotals() {
  const [r] = await DoorEntry.aggregate([
    { $match: { voided: false } },
    { $group: {
      _id: null, entries: { $sum: 1 }, doorSales: { $sum: { $cond: [{ $eq: ['$source', 'door_sale'] }, 1, 0] } },
      roomsInside: { $sum: { $cond: [{ $eq: ['$category', 'habitacion'] }, 1, 0] } },
      entryMoney: { $sum: '$entryAmount' }, parking: { $sum: '$parkingAmount' }, helmets: { $sum: '$helmetAmount' }, total: { $sum: '$totalAmount' },
    } },
  ]);
  return r || { entries: 0, doorSales: 0, roomsInside: 0, entryMoney: 0, parking: 0, helmets: 0, total: 0 };
}

export async function dashboard() {
  const settings = await getSettings();
  const active = { status: { $in: ['valid', 'used'] } };
  const [byKind, byGender, byPhase, guests, orderCounts, income, rooms, door, bar, exp] = await Promise.all([
    Ticket.aggregate([{ $match: active }, { $group: { _id: '$kind', n: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: { ...active, kind: 'general' } }, { $group: { _id: '$gender', n: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: { ...active, kind: 'general' } }, { $group: { _id: '$phase', n: { $sum: 1 } } }]),
    Ticket.countDocuments({ ...active, kind: 'general', isGuest: true }),
    Order.aggregate([{ $group: { _id: { s: '$status', k: '$kind' }, n: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: { k: '$kind', m: '$paymentMethod' }, sum: { $sum: '$amount' } } }]),
    Room.find().lean(),
    doorTotals(),
    Sale.aggregate([{ $match: { voided: false } }, { $group: { _id: null, sum: { $sum: '$total' } } }]),
    Expense.aggregate([{ $group: { _id: '$paid', sum: { $sum: '$amount' } } }]),
  ]);
  const kinds = countBy(byKind);
  const oc = (s, k) => orderCounts.filter((r) => r._id.s === s && (!k || r._id.k === k)).reduce((a, r) => a + r.n, 0);
  const sumIncome = (pred) => income.filter((r) => pred(r._id)).reduce((a, r) => a + r.sum, 0);
  const g = countBy(byGender);
  const p = countBy(byPhase);
  const statuses = rooms.map((r) => roomStatus(r));
  const ticketsIncome = sumIncome((i) => i.k === 'ticket');
  const roomsIncome = sumIncome((i) => i.k === 'room');
  const barIncome = bar[0]?.sum || 0;
  const total = ticketsIncome + roomsIncome + door.total + barIncome;
  const expPaid = exp.find((e) => e._id === true)?.sum || 0;
  const expPending = exp.find((e) => e._id !== true)?.sum || 0;
  const expTotal = expPaid + expPending;
  return {
    tickets: {
      sold: (kinds.general || 0) + (kinds.cortesia || 0), capacity: settings.capacity,
      byGender: { mujer: g.mujer || 0, hombre: g.hombre || 0 }, byPhase: { preventa: p.preventa || 0, general: p.general || 0 },
      guests, courtesy: kinds.cortesia || 0, pendingReview: oc('in_review', 'ticket'), pendingPayment: oc('pending_payment', 'ticket'),
    },
    rooms: {
      booked: statuses.filter((s) => s === 'booked').length, held: statuses.filter((s) => s === 'held').length, total: rooms.length,
      people: rooms.filter((r) => r.booked).reduce((a, r) => a + r.capacity, 0), peopleCapacity: rooms.reduce((a, r) => a + r.capacity, 0),
    },
    door: { inside: door.entries - door.roomsInside, roomsInside: door.roomsInside, entries: door.entries, doorSales: door.doorSales },
    income: {
      tickets: ticketsIncome, rooms: roomsIncome,
      byMethod: { mercadopago: sumIncome((i) => i.m === 'mercadopago'), transferencia: sumIncome((i) => i.m === 'transferencia'), manual: sumIncome((i) => i.m === 'manual') },
      door: { entries: door.entryMoney, parking: door.parking, helmets: door.helmets, total: door.total },
      bar: barIncome, total,
    },
    expenses: { total: expTotal, paid: expPaid, pending: expPending },
    balance: { net: total - expTotal, coveredPercent: expTotal > 0 ? Math.round(Math.min(100, (total / expTotal) * 100) * 10) / 10 : 100 },
    alerts: { pendingReview: oc('in_review'), conflicts: oc('conflict') },
  };
}

export async function doorStats() {
  const settings = await getSettings();
  const nv = { voided: false };
  const [byCat, tk, veh, helm, money, rooms] = await Promise.all([
    DoorEntry.aggregate([{ $match: nv }, { $group: { _id: '$category', n: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: { status: { $in: ['valid', 'used'] } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    DoorEntry.aggregate([{ $match: { ...nv, vehicle: { $ne: null } } }, { $group: { _id: '$vehicle.type', n: { $sum: 1 } } }]),
    DoorEntry.aggregate([{ $match: { ...nv, 'helmet.stored': true } }, { $group: { _id: '$helmet.returned', n: { $sum: 1 } } }]),
    DoorEntry.aggregate([{ $match: nv }, { $group: { _id: '$paymentMethod', e: { $sum: '$entryAmount' }, p: { $sum: '$parkingAmount' }, h: { $sum: '$helmetAmount' }, t: { $sum: '$totalAmount' } } }]),
    Room.find().select('capacity').lean(),
  ]);
  const c = { mujer: 0, hombre: 0, invitado: 0, cortesia: 0, habitacion: 0, ...countBy(byCat) };
  const t = countBy(tk);
  const sum = (k) => money.reduce((a, r) => a + r[k], 0);
  const hs = helm.reduce((a, r) => a + r.n, 0);
  return {
    inside: c.mujer + c.hombre + c.invitado + c.cortesia, capacity: settings.capacity,
    roomsInside: c.habitacion, roomsCapacity: rooms.reduce((a, r) => a + r.capacity, 0),
    byCategory: { mujer: c.mujer, hombre: c.hombre, invitado: c.invitado, cortesia: c.cortesia, habitacion: c.habitacion },
    tickets: { sold: (t.valid || 0) + (t.used || 0), checkedIn: t.used || 0, pending: t.valid || 0 },
    vehicles: { carro: 0, moto: 0, ...countBy(veh) },
    helmets: { stored: hs, returned: helm.find((r) => r._id === true)?.n || 0 },
    money: {
      entries: sum('e'), parking: sum('p'), helmets: sum('h'), total: sum('t'),
      byMethod: { ...zeros(POS_METHODS), ...Object.fromEntries(money.map((r) => [r._id, r.t])) },
    },
  };
}

export async function barSummary() {
  const nv = { $match: { voided: false } };
  const [tot, byMethod, byProduct, products] = await Promise.all([
    Sale.aggregate([nv, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 }, cc: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cortesia'] }, 1, 0] } }, cv: { $sum: '$courtesyValue' } } }]),
    Sale.aggregate([nv, { $group: { _id: '$paymentMethod', sum: { $sum: '$total' } } }]),
    Sale.aggregate([nv, { $unwind: '$items' }, { $group: {
      _id: '$items.productId', name: { $last: '$items.name' }, category: { $last: '$items.category' }, qty: { $sum: '$items.qty' },
      revenue: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cortesia'] }, 0, '$items.subtotal'] } },
    } }, { $sort: { revenue: -1, qty: -1 } }]),
    Product.find().select('cost').lean(),
  ]);
  const cost = new Map(products.map((p) => [String(p._id), p.cost]));
  const items = byProduct.map((r) => {
    const unit = cost.get(String(r._id));
    const c = unit === null || unit === undefined ? null : unit * r.qty;
    return { productId: String(r._id), name: r.name, category: r.category, qty: r.qty, revenue: r.revenue, cost: c, profit: c === null ? null : r.revenue - c };
  });
  const cats = new Map();
  for (const i of items) {
    const x = cats.get(i.category) || { category: i.category, qty: 0, revenue: 0 };
    x.qty += i.qty;
    x.revenue += i.revenue;
    cats.set(i.category, x);
  }
  const bm = countByKey(byMethod);
  return {
    total: tot[0]?.total || 0, count: tot[0]?.count || 0,
    byMethod: { efectivo: bm.efectivo || 0, nequi: bm.nequi || 0, breb: bm.breb || 0, tarjeta: bm.tarjeta || 0 },
    byProduct: items, byCategory: [...cats.values()].sort((a, b) => b.revenue - a.revenue),
    courtesy: { count: tot[0]?.cc || 0, value: tot[0]?.cv || 0 },
  };
}
const countByKey = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.sum]));

// ---------- CSV ----------
const L = {
  status: { pending_payment: 'Pendiente de pago', in_review: 'En revisión', paid: 'Pagada', rejected: 'Rechazada', expired: 'Expirada', cancelled: 'Cancelada', conflict: 'Conflicto' },
  kind: { ticket: 'Entrada', room: 'Habitación' },
  method: { mercadopago: 'Mercado Pago', transferencia: 'Transferencia', manual: 'Venta manual' },
  manual: { efectivo: 'Efectivo', nequi: 'Nequi', breb: 'Bre-B', transferencia: 'Transferencia', cortesia: 'Cortesía' },
  gender: { mujer: 'Mujer', hombre: 'Hombre' },
  phase: { preventa: 'Preventa', general: 'Venta general' },
  tkind: { general: 'General', room: 'Habitación', cortesia: 'Cortesía' },
  tstatus: { valid: 'Válida', used: 'Ya ingresó', void: 'Anulada' },
  cat: { mujer: 'Mujer', hombre: 'Hombre', invitado: 'Invitado', habitacion: 'Habitación', cortesia: 'Cortesía' },
  pos: { efectivo: 'Efectivo', nequi: 'Nequi', breb: 'Bre-B', tarjeta: 'Tarjeta', cortesia: 'Cortesía' },
  vehicle: { carro: 'Carro', moto: 'Moto' },
  expense: { finca: 'Finca / alquiler', sonido_luces: 'Sonido y luces', djs: 'DJs', bebidas: 'Bebidas / barra', decoracion: 'Decoración', seguridad: 'Seguridad / logística', publicidad: 'Publicidad', transporte: 'Transporte', otros: 'Otros' },
};
const lbl = (map, v) => (v == null ? '' : map[v] ?? v);
const d = (v) => (v ? new Date(v) : '');

const DATASETS = {
  async orders() {
    const rows = await Order.find().sort({ createdAt: -1 }).lean();
    return [
      ['ID', 'Fecha', 'Estado', 'Tipo', 'Método de pago', 'Método manual', 'Comprador', 'Cédula', 'Celular', 'Instagram', 'Correo', 'Género', 'Habitación', 'Acompañantes', 'Fase', 'Precio base', 'Descuento %', 'Descuento', 'Total', 'Invitado (lista)', 'Referencia transferencia', 'Pago Mercado Pago', 'Estado Mercado Pago', 'Pagada el', 'Revisada por', 'Motivo de rechazo', 'Notas'],
      rows.map((o) => [String(o._id), d(o.createdAt), lbl(L.status, o.status), lbl(L.kind, o.kind), lbl(L.method, o.paymentMethod), lbl(L.manual, o.manualMethod), o.buyer.name, o.buyer.cedula, o.buyer.phone, o.buyer.instagram, o.buyer.email, lbl(L.gender, o.gender), o.room?.name || '', (o.companions || []).map((c) => c.name).join(', '), lbl(L.phase, o.breakdown?.phase), o.breakdown?.base, o.breakdown?.discountPercent, o.breakdown?.discount, o.amount, o.guestName || '', o.transfer?.reference || '', o.mp?.paymentId || '', o.mp?.status || '', d(o.paidAt), o.reviewedByName || '', o.rejectReason || '', o.notes || '']),
    ];
  },
  async tickets() {
    const rows = await Ticket.find().sort({ createdAt: -1 }).lean();
    return [
      ['Código', 'Titular', 'Cédula', 'Tipo', 'Género', 'Fase', 'Invitado', 'Habitación', 'Estado', 'Ingresó el', 'Registró', 'Motivo de anulación', 'Comprador', 'Creada el'],
      rows.map((t) => [t.code, t.holderName, t.holderCedula || '', lbl(L.tkind, t.kind), lbl(L.gender, t.gender), lbl(L.phase, t.phase), !!t.isGuest, t.roomNumber ?? '', lbl(L.tstatus, t.status), d(t.checkedInAt), t.checkedInByName || '', t.voidReason || '', t.buyerName || '', d(t.createdAt)]),
    ];
  },
  async door() {
    const rows = await DoorEntry.find().sort({ createdAt: -1 }).lean();
    return [
      ['Fecha', 'Origen', 'Código ticket', 'Nombre', 'Cédula', 'Celular', 'Categoría', 'Género', 'En lista', 'Método de pago', 'Entrada', 'Vehículo', 'Placa', 'Parqueadero', 'Casco', 'Ficha casco', 'Casco devuelto', 'Valor casco', 'Total', 'Notas', 'Registró', 'Anulada', 'Motivo de anulación'],
      rows.map((e) => [d(e.createdAt), e.source === 'ticket' ? 'QR' : 'Venta en puerta', e.ticket?.code || '', e.name, e.cedula || '', e.phone || '', lbl(L.cat, e.category), lbl(L.gender, e.gender), !!e.guestListMatch, lbl(L.pos, e.paymentMethod), e.entryAmount, lbl(L.vehicle, e.vehicle?.type), e.vehicle?.plate || '', e.parkingAmount, !!e.helmet?.stored, e.helmet?.tag || '', !!e.helmet?.returned, e.helmetAmount, e.totalAmount, e.notes || '', e.createdByName || '', !!e.voided, e.voidReason || '']),
    ];
  },
  async bar() {
    const rows = await Sale.find().sort({ number: -1 }).lean();
    return [
      ['Número', 'Fecha', 'Productos', 'Total', 'Valor cortesía', 'Método de pago', 'Nota', 'Vendió', 'Anulada', 'Motivo de anulación'],
      rows.map((s) => [s.number, d(s.createdAt), s.items.map((i) => `${i.qty}x ${i.name}`).join(', '), s.total, s.courtesyValue || 0, lbl(L.pos, s.paymentMethod), s.note || '', s.createdByName || '', !!s.voided, s.voidReason || '']),
    ];
  },
  async expenses() {
    const rows = await Expense.find().sort({ createdAt: -1 }).lean();
    return [
      ['Concepto', 'Categoría', 'Valor', 'Pagado', 'Pagado el', 'Fecha límite', 'Responsable', 'Notas', 'Creado el'],
      rows.map((x) => [x.concept, lbl(L.expense, x.category), x.amount, !!x.paid, d(x.paidAt), d(x.dueDate), x.responsible || '', x.notes || '', d(x.createdAt)]),
    ];
  },
};
export const EXPORT_DATASETS = Object.keys(DATASETS);
export async function exportCsv(dataset) {
  const [headers, rows] = await DATASETS[dataset]();
  return toCsv(headers, rows);
}

export async function expenseTotals() {
  const rows = await Expense.find().sort({ createdAt: -1 }).lean();
  const totals = { total: 0, paid: 0, pending: 0, byCategory: zeros(EXPENSE_CATEGORIES) };
  for (const x of rows) {
    totals.total += x.amount;
    totals[x.paid ? 'paid' : 'pending'] += x.amount;
    totals.byCategory[x.category] = (totals.byCategory[x.category] || 0) + x.amount;
  }
  return { rows, totals };
}
