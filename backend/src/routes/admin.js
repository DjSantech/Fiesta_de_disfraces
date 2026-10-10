// Panel de administración (rol admin): /api/admin/*
import express from 'express';
import bcrypt from 'bcryptjs';
import { Order, Ticket, Receipt, Guest, Expense, Room, User, DoorEntry } from '../models/index.js';
import {
  ORDER_STATUSES, ORDER_KINDS, ORDER_PAYMENT_METHODS, MANUAL_METHODS, GENDERS, TICKET_STATUSES, TICKET_KINDS,
  EXPENSE_CATEGORIES, ROLES,
} from '../constants.js';
import {
  notFound, invalidState, textRegex, escapeRegex, normalizeTicketCode, normalizeCedula, normalizePhone, normalizeInstagram,
  CEDULA_RE, PHONE_RE, INSTAGRAM_RE, collapseSpaces, AppError, isDuplicateKey,
} from '../lib/util.js';
import {
  validate, z, idParam, text, optText, cedula, phone, optCedula, optPhone, optInstagram, email, money, percent, optIsoDate,
  isoDate, qParam, pagination, optEnum, fieldError,
} from '../middleware/validate.js';
import { getSettings, updateSettings, roomStatus } from '../services/core.js';
import { presentOrder, approveOrder, rejectOrder, createManualOrder } from '../services/orders.js';
import { dashboard, exportCsv, EXPORT_DATASETS, expenseTotals } from '../services/reports.js';
import { voidEntry } from '../services/ops.js';
import { orderAdmin, ticketAdmin, guestOut, expenseOut, userOut, settingsOut } from '../services/serializers.js';
import { companionsSchema } from './public.js';
import { BCRYPT_ROUNDS } from '../services/bootstrap.js';

const reason = z.object({ reason: text(3, 200) });
const voidReason = z.object({ reason: text(1, 200) });
const page = (items, total, q) => ({ items, total, page: q.page, limit: q.limit });

export function adminRouter() {
  const r = express.Router();

  r.get('/dashboard', async (req, res) => res.json(await dashboard()));

  // ---------- Órdenes ----------
  r.get('/orders', validate({
    query: z.object({ status: optEnum(ORDER_STATUSES), kind: optEnum(ORDER_KINDS), method: optEnum(ORDER_PAYMENT_METHODS), q: qParam, ...pagination }),
  }), async (req, res) => {
    const q = req.valid.query;
    const f = {};
    if (q.status) f.status = q.status;
    if (q.kind) f.kind = q.kind;
    if (q.method) f.paymentMethod = q.method;
    if (q.q) {
      const plain = new RegExp(escapeRegex(q.q), 'i');
      const digits = q.q.replace(/\D/g, '');
      const or = [{ 'buyer.name': textRegex(q.q) }, { 'buyer.cedula': new RegExp(escapeRegex(normalizeCedula(q.q)), 'i') }, { 'buyer.instagram': new RegExp(escapeRegex(normalizeInstagram(q.q)), 'i') }, { 'buyer.email': plain }, { 'transfer.reference': plain }, { token: q.q }];
      if (digits.length >= 3) or.push({ 'buyer.phone': new RegExp(escapeRegex(normalizePhone(digits))) });
      const code = normalizeTicketCode(q.q);
      const tickets = await Ticket.find(code ? { code } : { code: plain }).select('orderId').limit(50).lean();
      if (tickets.length) or.push({ _id: { $in: tickets.map((t) => t.orderId) } });
      f.$or = or;
    }
    const [rows, total] = await Promise.all([
      Order.find(f).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Order.countDocuments(f),
    ]);
    const tickets = await Ticket.find({ orderId: { $in: rows.map((o) => o._id) } }).sort({ seq: 1 }).lean();
    res.json(page(rows.map((o) => orderAdmin(o, tickets.filter((t) => String(t.orderId) === String(o._id)))), total, q));
  });

  r.get('/orders/:id', validate({ params: idParam }), async (req, res) => {
    if (!(await Order.exists({ _id: req.valid.params.id }))) throw notFound('No encontramos esa compra.');
    res.json({ order: await presentOrder(req.valid.params.id, 'admin') });
  });

  r.get('/orders/:id/receipt', validate({ params: idParam }), async (req, res) => {
    const o = await Order.findById(req.valid.params.id).select('transfer').lean();
    const rec = o?.transfer?.receiptId ? await Receipt.findById(o.transfer.receiptId).lean() : null;
    if (!rec) throw notFound('Esta compra no tiene comprobante.');
    res.set({ 'Content-Type': rec.contentType, 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' });
    res.send(Buffer.from(rec.data.buffer ?? rec.data));
  });

  r.post('/orders/manual', validate({
    body: z.object({
      kind: z.enum(ORDER_KINDS), gender: z.enum(GENDERS).nullish(), roomNumber: z.number().int().min(1).nullish(),
      buyer: z.object({ name: text(3, 80), cedula, phone, instagram: optInstagram.optional(), email }),
      companions: companionsSchema, amount: money.nullish(), manualMethod: z.enum(MANUAL_METHODS), notes: optText(500),
    }).superRefine((v, ctx) => {
      if (v?.kind === 'ticket' && !v.gender) ctx.addIssue({ code: 'custom', path: ['gender'], message: 'Elige mujer u hombre.' });
      if (v?.kind === 'room' && !v.roomNumber) ctx.addIssue({ code: 'custom', path: ['roomNumber'], message: 'Elige una habitación.' });
    }, { when: () => true }),
  }), async (req, res) => {
    const b = req.valid.body;
    const id = await createManualOrder({ ...b, buyer: { ...b.buyer, instagram: b.buyer.instagram || '' } }, req.user);
    res.status(201).json({ order: await presentOrder(id, 'admin') });
  });

  r.post('/orders/:id/approve', validate({ params: idParam, body: z.object({ notes: optText(500) }) }), async (req, res) => {
    const id = await approveOrder(req.valid.params.id, req.user, req.valid.body.notes);
    res.json({ order: await presentOrder(id, 'admin') });
  });
  r.post('/orders/:id/reject', validate({ params: idParam, body: reason }), async (req, res) => {
    const id = await rejectOrder(req.valid.params.id, req.user, req.valid.body.reason);
    res.json({ order: await presentOrder(id, 'admin') });
  });

  // ---------- Tickets ----------
  const ticketWithOrder = async (t) => ticketAdmin(t, await Order.findById(t.orderId).select('token kind buyer').lean());
  r.get('/tickets', validate({
    query: z.object({ status: optEnum(TICKET_STATUSES), kind: optEnum(TICKET_KINDS), q: qParam, ...pagination }),
  }), async (req, res) => {
    const q = req.valid.query;
    const f = {};
    if (q.status) f.status = q.status;
    if (q.kind) f.kind = q.kind;
    if (q.q) {
      const plain = new RegExp(escapeRegex(q.q), 'i');
      const or = [{ holderName: textRegex(q.q) }, { buyerName: textRegex(q.q) }, { holderCedula: plain }, { code: plain }];
      const code = normalizeTicketCode(q.q);
      if (code) or.push({ code });
      f.$or = or;
    }
    const [rows, total] = await Promise.all([
      Ticket.find(f).sort({ createdAt: -1, seq: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Ticket.countDocuments(f),
    ]);
    const orders = await Order.find({ _id: { $in: rows.map((t) => t.orderId) } }).select('token kind buyer').lean();
    const byId = new Map(orders.map((o) => [String(o._id), o]));
    res.json(page(rows.map((t) => ticketAdmin(t, byId.get(String(t.orderId)))), total, q));
  });

  r.patch('/tickets/:id', validate({ params: idParam, body: z.object({ holderName: text(2, 80).optional(), holderCedula: optCedula.optional() }) }), async (req, res) => {
    const set = {};
    const b = req.valid.body;
    if (b.holderName !== undefined) set.holderName = b.holderName;
    if (b.holderCedula !== undefined) set.holderCedula = b.holderCedula;
    const t = await Ticket.findByIdAndUpdate(req.valid.params.id, { $set: set }, { returnDocument: 'after' }).lean();
    if (!t) throw notFound('No encontramos esa entrada.');
    res.json({ ticket: await ticketWithOrder(t) });
  });

  r.post('/tickets/:id/void', validate({ params: idParam, body: voidReason }), async (req, res) => {
    const t = await Ticket.findOneAndUpdate(
      { _id: req.valid.params.id, status: { $in: ['valid', 'used'] } },
      { $set: { status: 'void', voidReason: req.valid.body.reason, voidedAt: new Date() } },
      { returnDocument: 'after' },
    ).lean();
    if (!t) {
      if (!(await Ticket.exists({ _id: req.valid.params.id }))) throw notFound('No encontramos esa entrada.');
      throw invalidState('Esta entrada ya estaba anulada.');
    }
    res.json({ ticket: await ticketWithOrder(t) });
  });

  // void → valid; used → valid deshaciendo el check-in (anula la entrada de puerta asociada).
  r.post('/tickets/:id/restore', validate({ params: idParam }), async (req, res) => {
    const cur = await Ticket.findById(req.valid.params.id).lean();
    if (!cur) throw notFound('No encontramos esa entrada.');
    if (cur.status === 'valid') throw invalidState('Esta entrada ya está válida.');
    const t = await Ticket.findOneAndUpdate(
      { _id: cur._id, status: cur.status },
      { $set: { status: 'valid', voidReason: null, voidedAt: null, checkedInAt: null, checkedInBy: null, checkedInByName: null, entryId: null } },
      { returnDocument: 'after' },
    ).lean();
    if (!t) throw invalidState('La entrada cambió de estado. Recarga.');
    const entries = await DoorEntry.find({ 'ticket.id': cur._id, voided: false }).select('_id').lean();
    for (const e of entries) await voidEntry(e._id, 'Check-in deshecho por el admin').catch(() => {});
    res.json({ ticket: await ticketWithOrder(await Ticket.findById(cur._id).lean()) });
  });

  // ---------- Invitados ----------
  const guestFields = {
    name: text(2, 80), cedula: optCedula.optional(), phone: optPhone.optional(), instagram: optInstagram.optional(),
    discountPercent: percent.nullish(), note: optText(300).optional(),
  };
  const needsId = (v, ctx) => {
    if (v && !v.cedula && !v.phone && !v.instagram) ctx.addIssue({ code: 'custom', path: ['cedula'], message: 'Escribe al menos cédula, celular o Instagram.' });
  };
  async function assertNoDuplicateGuest(g, exceptId) {
    for (const k of ['cedula', 'phone', 'instagram']) {
      if (!g[k]) continue;
      const f = { [k]: g[k] };
      if (exceptId) f._id = { $ne: exceptId };
      if (await Guest.exists(f)) throw fieldError(k, `Ya hay un invitado con ese ${k === 'cedula' ? 'número de cédula' : k === 'phone' ? 'celular' : 'Instagram'}.`);
    }
  }

  r.get('/guests', validate({ query: z.object({ q: qParam }) }), async (req, res) => {
    const q = req.valid.query.q;
    const f = q ? { $or: [{ name: textRegex(q) }, { cedula: new RegExp(escapeRegex(q), 'i') }, { phone: new RegExp(escapeRegex(q), 'i') }, { instagram: new RegExp(escapeRegex(q.replace(/^@/, '')), 'i') }] } : {};
    const rows = await Guest.find(f).collation({ locale: 'es' }).sort({ name: 1 }).lean();
    res.json({ items: rows.map(guestOut) });
  });

  r.post('/guests', validate({ body: z.object(guestFields).superRefine(needsId, { when: () => true }) }), async (req, res) => {
    const b = req.valid.body;
    const g = { name: b.name, cedula: b.cedula ?? null, phone: b.phone ?? null, instagram: b.instagram ?? null, discountPercent: b.discountPercent ?? null, note: b.note || '' };
    await assertNoDuplicateGuest(g);
    res.status(201).json({ guest: guestOut((await Guest.create(g)).toObject()) });
  });

  r.post('/guests/bulk', validate({ body: z.object({ text: z.string().max(100_000) }) }), async (req, res) => {
    let created = 0;
    let skipped = 0;
    const errors = [];
    const lines = req.valid.body.text.split(/\r?\n/);
    for (let i = 0; i < lines.length && i < 3000; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
      const [rawName = '', rawCed = '', rawPhone = '', rawIg = ''] = line.split(sep).map((s) => s.trim());
      const name = collapseSpaces(rawName);
      const ced = normalizeCedula(rawCed);
      const ph = normalizePhone(rawPhone);
      const ig = normalizeInstagram(rawIg);
      const g = { name, cedula: ced || null, phone: ph || null, instagram: ig || null };
      let msg = null;
      if (name.length < 2 || name.length > 80) msg = 'Nombre inválido (2 a 80 caracteres).';
      else if (g.cedula && !CEDULA_RE.test(g.cedula)) msg = 'Cédula inválida.';
      else if (g.phone && !PHONE_RE.test(g.phone)) msg = 'Celular inválido (10 dígitos, empieza por 3).';
      else if (g.instagram && !INSTAGRAM_RE.test(g.instagram)) msg = 'Instagram inválido.';
      else if (!g.cedula && !g.phone && !g.instagram) msg = 'Falta cédula, celular o Instagram.';
      if (msg) {
        errors.push({ line: i + 1, message: msg });
        continue;
      }
      const or = ['cedula', 'phone', 'instagram'].filter((k) => g[k]).map((k) => ({ [k]: g[k] }));
      if (await Guest.exists({ $or: or })) {
        skipped++;
        continue;
      }
      await Guest.create(g);
      created++;
    }
    res.json({ created, skipped, errors });
  });

  r.put('/guests/:id', validate({ params: idParam, body: z.object({ ...guestFields, name: text(2, 80).optional() }) }), async (req, res) => {
    const cur = await Guest.findById(req.valid.params.id).lean();
    if (!cur) throw notFound('No encontramos ese invitado.');
    const b = req.valid.body;
    const next = { ...cur };
    for (const k of ['name', 'cedula', 'phone', 'instagram', 'discountPercent', 'note']) if (b[k] !== undefined) next[k] = b[k];
    if (!next.cedula && !next.phone && !next.instagram) throw fieldError('cedula', 'Escribe al menos cédula, celular o Instagram.');
    await assertNoDuplicateGuest(next, cur._id);
    const { name, cedula: c, phone: p, instagram: ig, discountPercent, note } = next;
    const g = await Guest.findByIdAndUpdate(cur._id, { $set: { name, cedula: c, phone: p, instagram: ig, discountPercent, note: note || '' } }, { returnDocument: 'after' }).lean();
    res.json({ guest: guestOut(g) });
  });

  r.delete('/guests/:id', validate({ params: idParam }), async (req, res) => {
    const d = await Guest.findByIdAndDelete(req.valid.params.id).lean();
    if (!d) throw notFound('No encontramos ese invitado.');
    res.status(204).end();
  });

  // ---------- Gastos ----------
  const expenseFields = {
    concept: text(2, 120), category: z.enum(EXPENSE_CATEGORIES), amount: money, paid: z.boolean().optional(),
    dueDate: optIsoDate.optional(), responsible: optText(60).optional(), notes: optText(500).optional(),
  };
  r.get('/expenses', async (req, res) => {
    const { rows, totals } = await expenseTotals();
    res.json({ items: rows.map(expenseOut), totals });
  });
  r.post('/expenses', validate({ body: z.object(expenseFields) }), async (req, res) => {
    const b = req.valid.body;
    const x = await Expense.create({ ...b, paid: !!b.paid, paidAt: b.paid ? new Date() : null, responsible: b.responsible || '', notes: b.notes || '' });
    res.status(201).json({ expense: expenseOut(x.toObject()) });
  });
  r.put('/expenses/:id', validate({ params: idParam, body: z.object(expenseFields).partial() }), async (req, res) => {
    const cur = await Expense.findById(req.valid.params.id).lean();
    if (!cur) throw notFound('No encontramos ese gasto.');
    const set = Object.fromEntries(Object.entries(req.valid.body).filter(([, v]) => v !== undefined));
    if (set.paid !== undefined && set.paid !== cur.paid) set.paidAt = set.paid ? new Date() : null;
    const x = await Expense.findByIdAndUpdate(cur._id, { $set: set }, { returnDocument: 'after' }).lean();
    res.json({ expense: expenseOut(x) });
  });
  r.delete('/expenses/:id', validate({ params: idParam }), async (req, res) => {
    if (!(await Expense.findByIdAndDelete(req.valid.params.id))) throw notFound('No encontramos ese gasto.');
    res.status(204).end();
  });

  // ---------- Habitaciones ----------
  const roomAdmin = async (room) => {
    const status = roomStatus(room);
    const o = room.orderId && ['held', 'booked'].includes(status) ? await Order.findById(room.orderId).lean() : null;
    return {
      number: room.number, name: room.name, capacity: room.capacity, minPeople: room.minPeople ?? 1, price: room.price, presalePrice: room.presalePrice ?? room.price, beds: room.beds || '', privateBathroom: !!room.privateBathroom,
      blocked: !!room.blocked, status,
      order: o ? { id: String(o._id), token: o.token, status: o.status, buyerName: o.buyer.name, buyerPhone: o.buyer.phone, holdExpiresAt: o.holdExpiresAt ? o.holdExpiresAt.toISOString() : null } : null,
    };
  };
  r.get('/rooms', async (req, res) => {
    const rooms = await Room.find().sort({ number: 1 }).lean();
    res.json({ items: await Promise.all(rooms.map(roomAdmin)) });
  });
  r.put('/rooms/:number', validate({
    params: z.object({ number: z.coerce.number().int().min(1).max(99) }),
    body: z.object({ name: text(2, 60).optional(), capacity: z.number().int().min(1).max(20).optional(), minPeople: z.number().int().min(1).max(20).optional(), price: money.optional(), presalePrice: money.optional(), beds: text(0, 80).optional(), privateBathroom: z.boolean().optional(), blocked: z.boolean().optional() }),
  }), async (req, res) => {
    const set = Object.fromEntries(Object.entries(req.valid.body).filter(([, v]) => v !== undefined));
    if (set.minPeople !== undefined || set.capacity !== undefined) {
      const cur = await Room.findOne({ number: req.valid.params.number }).lean();
      if (!cur) throw notFound('Esa habitación no existe.');
      if ((set.minPeople ?? cur.minPeople ?? 1) > (set.capacity ?? cur.capacity)) throw fieldError('minPeople', 'El mínimo de personas no puede superar el máximo.');
    }
    const room = await Room.findOneAndUpdate({ number: req.valid.params.number }, { $set: set }, { returnDocument: 'after' }).lean();
    if (!room) throw notFound('Esa habitación no existe.');
    res.json({ room: await roomAdmin(room) });
  });

  // ---------- Ajustes ----------
  const pricePair = z.object({ mujer: money.optional(), hombre: money.optional() });
  r.get('/settings', async (req, res) => res.json({ settings: settingsOut(await getSettings()) }));
  r.put('/settings', validate({
    body: z.object({
      eventStartsAt: isoDate.optional(), presaleEndsAt: isoDate.optional(), salesOpen: z.boolean().optional(),
      capacity: z.number().int().min(0).max(100_000).optional(),
      prices: z.object({ preventa: pricePair.optional(), puerta: pricePair.optional() }).optional(),
      guestPresaleDiscount: money.optional(),
      guestGeneralDiscount: money.optional(),
      parking: z.object({ carro: money.optional(), moto: money.optional(), casco: money.optional() }).optional(),
      paymentAccounts: z.array(z.object({ label: text(1, 30), number: text(1, 40), holder: optText(60) })).max(6).optional(),
      transferInstructions: optText(500).optional(),
      contact: z.object({
        whatsapp: z.preprocess((v) => (v == null ? '' : String(v).replace(/\D/g, '')), z.string().max(15)).optional(),
        instagram: z.preprocess((v) => normalizeInstagram(v ?? ''), z.string().max(30)).optional(),
        adminName: optText(60).optional(),
      }).optional(),
      location: z.object({
        revealed: z.boolean().optional(), name: optText(100).optional(),
        mapsUrl: z.preprocess((v) => (v == null ? '' : String(v).trim()), z.union([z.literal(''), z.url({ protocol: /^https$/, error: 'El enlace debe empezar por https://' })])).optional(),
        notes: optText(300).optional(),
      }).optional(),
      publicCounter: z.boolean().optional(),
    }),
  }), async (req, res) => res.json({ settings: settingsOut(await updateSettings(req.valid.body)) }));

  // ---------- Usuarios ----------
  const username = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, { error: 'Usuario: 3 a 30 caracteres (a-z, 0-9, punto, guion).' });
  const password = z.string().min(8, { error: 'La contraseña debe tener al menos 8 caracteres.' }).max(200);
  r.get('/users', async (req, res) => res.json({ items: (await User.find().sort({ createdAt: 1 }).lean()).map(userOut) }));
  r.post('/users', validate({ body: z.object({ username, name: text(2, 60), password, role: z.enum(ROLES) }) }), async (req, res) => {
    const b = req.valid.body;
    if (await User.exists({ username: b.username })) throw new AppError(409, 'USERNAME_TAKEN', 'Ese usuario ya existe. Elige otro.');
    try {
      const u = await User.create({ username: b.username, name: b.name, role: b.role, passwordHash: await bcrypt.hash(b.password, BCRYPT_ROUNDS) });
      res.status(201).json({ user: userOut(u.toObject()) });
    } catch (err) {
      if (isDuplicateKey(err, 'username')) throw new AppError(409, 'USERNAME_TAKEN', 'Ese usuario ya existe. Elige otro.');
      throw err;
    }
  });
  r.put('/users/:id', validate({ params: idParam, body: z.object({ name: text(2, 60).optional(), role: z.enum(ROLES).optional(), password: password.optional(), active: z.boolean().optional() }) }), async (req, res) => {
    const b = req.valid.body;
    const self = req.valid.params.id === req.user.id;
    if (self && b.role && b.role !== 'admin') throw fieldError('role', 'No puedes quitarte el rol de administrador.');
    if (self && b.active === false) throw fieldError('active', 'No puedes desactivar tu propio usuario.');
    const set = {};
    const inc = {};
    if (b.name !== undefined) set.name = b.name;
    if (b.role !== undefined) set.role = b.role;
    if (b.active !== undefined) set.active = b.active;
    if (b.password) set.passwordHash = await bcrypt.hash(b.password, BCRYPT_ROUNDS);
    if (b.password || b.active === false) inc.tokenVersion = 1; // cierra sesiones abiertas
    const u = await User.findByIdAndUpdate(req.valid.params.id, { $set: set, ...(inc.tokenVersion ? { $inc: inc } : {}) }, { returnDocument: 'after' }).lean();
    if (!u) throw notFound('No encontramos ese usuario.');
    res.json({ user: userOut(u) });
  });
  r.delete('/users/:id', validate({ params: idParam }), async (req, res) => {
    if (req.valid.params.id === req.user.id) throw fieldError('id', 'No puedes borrar tu propio usuario.');
    if (!(await User.findByIdAndDelete(req.valid.params.id))) throw notFound('No encontramos ese usuario.');
    res.status(204).end();
  });

  // ---------- CSV ----------
  r.get('/export/:dataset.csv', validate({ params: z.object({ dataset: z.enum(EXPORT_DATASETS) }) }), async (req, res) => {
    const { dataset } = req.valid.params;
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${dataset}.csv"`, 'Cache-Control': 'no-store' });
    res.send(await exportCsv(dataset));
  });

  return r;
}
