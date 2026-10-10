// Portería (/api/door, rol puerta|admin) y barra (/api/bar, rol barra|admin).
import express from 'express';
import { DoorEntry, Room, Product, Sale } from '../models/index.js';
import { VEHICLE_TYPES, POS_METHODS, DOOR_SALE_CATEGORIES, GENDERS, PRODUCT_CATEGORIES } from '../constants.js';
import {
  validate, z, idParam, objectId, text, optText, optCedula, optPhone, plate, money, qParam, flag, pagination, optEnum,
} from '../middleware/validate.js';
import { getSettings } from '../services/core.js';
import {
  scan, checkIn, doorSale, lookup, updateEntry, voidEntry, entryFilter, createSale, voidSale, assertProduct,
} from '../services/ops.js';
import { doorStats, barSummary } from '../services/reports.js';
import { doorEntryOut, productOut, saleOut } from '../services/serializers.js';

const vehicle = z.object({ type: z.enum(VEHICLE_TYPES, { error: 'Elige carro o moto.' }), plate });
const helmetIn = z.object({ stored: z.boolean(), tag: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(20).nullish()), returned: z.boolean().optional() });
const reason = z.object({ reason: text(1, 200) });
const page = (items, total, q) => ({ items, total, page: q.page, limit: q.limit });

export function doorRouter() {
  const r = express.Router();

  r.get('/config', async (req, res) => {
    const [s, rooms] = await Promise.all([getSettings(), Room.find().select('capacity').lean()]);
    res.json({
      prices: { ...s.prices.puerta }, presalePrices: { ...s.prices.preventa }, guest: { presaleDiscount: s.guestPresaleDiscount, generalDiscount: s.guestGeneralDiscount }, parking: { ...s.parking },
      capacity: s.capacity, roomsCapacity: rooms.reduce((a, x) => a + x.capacity, 0),
    });
  });
  r.get('/stats', async (req, res) => res.json(await doorStats()));
  r.post('/scan', validate({ body: z.object({ value: z.string().max(500) }) }), async (req, res) => res.json(await scan(req.valid.body.value)));

  r.post('/checkin', validate({
    body: z.object({
      ticketId: objectId, vehicle: vehicle.nullish(), helmet: helmetIn.nullish(),
      paymentMethod: z.enum(POS_METHODS).optional(), notes: optText(300),
    }),
  }), async (req, res) => res.status(201).json(await checkIn(req.valid.body, req.user)));

  r.post('/sale', validate({
    body: z.object({
      name: text(2, 80), cedula: optCedula.optional(), phone: optPhone.optional(),
      category: z.enum(DOOR_SALE_CATEGORIES, { error: 'Elige mujer, hombre o invitado.' }),
      gender: z.enum(GENDERS).nullish(), paymentMethod: z.enum(POS_METHODS),
      vehicle: vehicle.nullish(), helmet: helmetIn.nullish(), notes: optText(300),
    }).superRefine((v, ctx) => {
      if (v && !v.cedula && !v.phone) ctx.addIssue({ code: 'custom', path: ['cedula'], message: 'Escribe la cédula o el celular.' });
      if (v?.category === 'invitado' && !v.gender) ctx.addIssue({ code: 'custom', path: ['gender'], message: 'Elige el género del invitado.' });
    }, { when: () => true }),
  }), async (req, res) => {
    const b = req.valid.body;
    res.status(201).json({ entry: await doorSale({ ...b, cedula: b.cedula ?? null, phone: b.phone ?? null }, req.user) });
  });

  r.get('/lookup', validate({ query: z.object({ q: z.string().trim().min(3, { error: 'Escribe al menos 3 caracteres.' }).max(100) }) }), async (req, res) => res.json(await lookup(req.valid.query.q)));

  r.get('/entries', validate({
    query: z.object({ q: qParam, vehicle: optEnum([...VEHICLE_TYPES, 'any']), helmet: optEnum(['stored']), includeVoided: flag, ...pagination }),
  }), async (req, res) => {
    const q = req.valid.query;
    const f = entryFilter(q);
    const [rows, total] = await Promise.all([
      DoorEntry.find(f).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      DoorEntry.countDocuments(f),
    ]);
    res.json(page(rows.map(doorEntryOut), total, q));
  });

  r.patch('/entries/:id', validate({ params: idParam, body: z.object({ vehicle: vehicle.nullable().optional(), helmet: helmetIn.nullable().optional(), notes: optText(300).optional() }) }),
    async (req, res) => res.json({ entry: await updateEntry(req.valid.params.id, req.valid.body) }));
  r.post('/entries/:id/void', validate({ params: idParam, body: reason }), async (req, res) => res.json({ entry: await voidEntry(req.valid.params.id, req.valid.body.reason) }));
  return r;
}

export function barRouter() {
  const r = express.Router();
  const fields = {
    name: text(2, 60), category: z.enum(PRODUCT_CATEGORIES), price: money, cost: money.nullish(),
    stock: z.number().int().min(-100_000).max(100_000).nullish(), active: z.boolean().optional(), sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
  };

  r.get('/products', validate({ query: z.object({ all: flag }) }), async (req, res) => {
    const f = { deleted: false };
    if (!req.valid.query.all) f.active = true;
    const rows = await Product.find(f).collation({ locale: 'es' }).sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ items: rows.map(productOut) });
  });
  r.post('/products', validate({ body: z.object(fields) }), async (req, res) => {
    const b = req.valid.body;
    const p = await Product.create({ ...b, cost: b.cost ?? null, stock: b.stock ?? null, active: b.active ?? true, sortOrder: b.sortOrder ?? 0 });
    res.status(201).json({ product: productOut(p.toObject()) });
  });
  r.put('/products/:id', validate({ params: idParam, body: z.object(fields).partial() }), async (req, res) => {
    await assertProduct(req.valid.params.id);
    const set = Object.fromEntries(Object.entries(req.valid.body).filter(([, v]) => v !== undefined));
    const p = await Product.findByIdAndUpdate(req.valid.params.id, { $set: set }, { returnDocument: 'after' }).lean();
    res.json({ product: productOut(p) });
  });
  r.delete('/products/:id', validate({ params: idParam }), async (req, res) => {
    await assertProduct(req.valid.params.id);
    await Product.updateOne({ _id: req.valid.params.id }, { $set: { deleted: true, active: false } });
    res.status(204).end();
  });

  r.post('/sales', validate({
    body: z.object({
      items: z.array(z.object({ productId: objectId, qty: z.number().int().min(1).max(50) })).min(1).max(30),
      paymentMethod: z.enum(POS_METHODS), note: optText(200),
    }),
  }), async (req, res) => res.status(201).json(await createSale(req.valid.body, req.user)));

  r.get('/sales', validate({ query: z.object({ includeVoided: flag, ...pagination }) }), async (req, res) => {
    const q = req.valid.query;
    const f = q.includeVoided ? {} : { voided: false };
    const [rows, total] = await Promise.all([
      Sale.find(f).sort({ createdAt: -1, number: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Sale.countDocuments(f),
    ]);
    res.json(page(rows.map(saleOut), total, q));
  });
  r.post('/sales/:id/void', validate({ params: idParam, body: reason }), async (req, res) => res.json({ sale: await voidSale(req.valid.params.id, req.valid.body.reason) }));
  r.get('/summary', async (req, res) => res.json(await barSummary()));
  return r;
}
