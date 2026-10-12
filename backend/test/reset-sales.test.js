import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { startDb, stopDb, setup } from './helpers.js';
import {
  Settings, Room, Order, Receipt, Ticket, Guest, Expense, User, DoorEntry, Product, Sale, Counter, AuditLog,
} from '../src/models/index.js';
import { resetSales, describeUri, parseArgs } from '../scripts/reset-sales.js';

before(startDb);
after(stopDb);

let guest, order;
beforeEach(async () => {
  await setup();
  await Counter.deleteMany({});
  guest = await Guest.create({ name: 'Ana', instagram: 'ana' });
  order = await Order.create({
    token: 't1', kind: 'room', status: 'paid', paymentMethod: 'transferencia', amount: 500000,
    breakdown: { phase: 'preventa', base: 500000, total: 500000 }, buyer: { name: 'Laura', cedula: '1', phone: '300' },
    room: { number: 3, name: 'Hab 3', capacity: 4 }, guestId: guest._id,
  });
  await Room.updateOne({ number: 3 }, { $set: { booked: true, orderId: order._id, holdExpiresAt: new Date() } });
  await Room.updateOne({ number: 1 }, { $set: { blocked: true } });
  await Guest.updateOne({ _id: guest._id }, { $set: { redeemed: true, redeemedOrderId: order._id, redeemedAt: new Date() } });
  await Receipt.create({ orderId: order._id, contentType: 'image/png', data: Buffer.from('abc') });
  await Ticket.create([1, 2].map((seq) => ({ token: `tk${seq}`, code: `C${seq}`, orderId: order._id, seq, holderName: 'Laura', kind: 'room' })));
  await DoorEntry.create({ source: 'door_sale', name: 'Pedro', category: 'hombre', paymentMethod: 'efectivo', entryAmount: 35000 });
  await Product.create({ name: 'Cerveza', category: 'cervezas', price: 8000, stock: 40, soldQty: 3 });
  await Expense.create({ concept: 'Sonido', category: 'sonido_luces', amount: 100 });
  await Sale.create({ number: 1, total: 8000, paymentMethod: 'efectivo' });
  await Counter.create({ _id: 'bar_sale', seq: 1 });
});

const snapshot = async () => ({
  orders: await Order.countDocuments(), tickets: await Ticket.countDocuments(), receipts: await Receipt.countDocuments(),
  door: await DoorEntry.countDocuments(), sales: await Sale.countDocuments(), audit: await AuditLog.countDocuments(),
  rooms: await Room.countDocuments({ booked: true }), guests: await Guest.countDocuments({ redeemed: true }),
});

test('dry-run no cambia nada y devuelve conteos', async () => {
  const before = await snapshot();
  const r = await resetSales({ includeBar: true, dryRun: true });
  assert.equal(r.dryRun, true);
  assert.deepEqual(r.counts, { orders: 1, tickets: 2, receipts: 1, doorEntries: 1, barSales: 1, roomsReleased: 1, guestsRestored: 1 });
  assert.deepEqual(await snapshot(), before);
  // dry-run es el valor por defecto
  assert.equal((await resetSales({})).dryRun, true);
  assert.deepEqual(await snapshot(), before);
});

test('apply sin motivo (o muy corto) falla y no borra', async () => {
  const before = await snapshot();
  await assert.rejects(resetSales({ dryRun: false }), /motivo/);
  await assert.rejects(resetSales({ dryRun: false, reason: 'ab' }), /motivo/);
  assert.deepEqual(await snapshot(), before);
});

test('apply borra lo transaccional, revierte y conserva lo demás con 1 auditoría', async () => {
  const auditBefore = await AuditLog.countDocuments();
  const r = await resetSales({ dryRun: false, reason: 'Fin de pruebas', operator: 'Santiago' });
  assert.equal(r.dryRun, false);

  assert.equal(await Order.countDocuments(), 0);
  assert.equal(await Ticket.countDocuments(), 0);
  assert.equal(await Receipt.countDocuments(), 0);
  assert.equal(await DoorEntry.countDocuments(), 0);

  const room = await Room.findOne({ number: 3 }).lean();
  assert.equal(room.booked, false);
  assert.equal(room.orderId, null);
  assert.equal(room.holdExpiresAt, null);
  assert.equal((await Room.findOne({ number: 1 }).lean()).blocked, true); // config intacta

  const g = await Guest.findById(guest._id).lean();
  assert.equal(g.redeemed, false);
  assert.equal(g.redeemedOrderId, null);
  assert.equal(g.redeemedAt, null);
  assert.equal(g.name, 'Ana');

  assert.ok(await Settings.findById('main'));
  assert.ok((await User.countDocuments()) >= 3);
  assert.equal(await Expense.countDocuments(), 1);
  const prod = await Product.findOne().lean();
  assert.equal(prod.stock, 40);
  assert.equal(await Sale.countDocuments(), 1); // sin --include-bar
  assert.equal((await Counter.findById('bar_sale').lean()).seq, 1);

  assert.equal(await AuditLog.countDocuments(), auditBefore + 1);
  const logs = await AuditLog.find({ action: 'data.reset' }).lean();
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0].actor, { id: null, username: 'script', name: 'Santiago', role: 'system' });
  assert.equal(logs[0].reason, 'Fin de pruebas');
  assert.deepEqual(
    { ...logs[0].meta, backup: undefined },
    { orders: 1, tickets: 2, receipts: 1, doorEntries: 1, barSales: 0, roomsReleased: 1, guestsRestored: 1, includeBar: false, backup: undefined },
  );

  // idempotente: segunda corrida no falla y deja ceros
  const again = await resetSales({ dryRun: false, reason: 'Repetido', operator: 'Santiago' });
  assert.deepEqual(again.counts, { orders: 0, tickets: 0, receipts: 0, doorEntries: 0, barSales: 0, roomsReleased: 0, guestsRestored: 0 });
});

test('--include-bar borra ventas y reinicia contador sin tocar productos', async () => {
  const r = await resetSales({ includeBar: true, dryRun: false, reason: 'Limpieza total', operator: 'Santiago' });
  assert.equal(r.counts.barSales, 1);
  assert.equal(await Sale.countDocuments(), 0);
  assert.equal(await Counter.findById('bar_sale'), null);
  const prod = await Product.findOne().lean();
  assert.equal(prod.stock, 40);
  assert.equal(prod.price, 8000);
  assert.equal(await Expense.countDocuments(), 1);
  const log = await AuditLog.findOne({ action: 'data.reset' }).lean();
  assert.equal(log.meta.includeBar, true);
  assert.equal(log.meta.barSales, 1);
});

test('respaldo JSON se escribe antes de borrar y la auditoría usa OPERATOR/SO por defecto', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reset-bk-'));
  try {
    const backupDir = path.join(dir, 'bk');
    await resetSales({ dryRun: false, reason: 'Con respaldo', backupDir });
    const orders = JSON.parse(fs.readFileSync(path.join(backupDir, 'orders.json'), 'utf8'));
    assert.equal(orders.length, 1);
    assert.equal(orders[0].token, 't1');
    assert.equal(JSON.parse(fs.readFileSync(path.join(backupDir, 'tickets.json'), 'utf8')).length, 2);
    assert.equal(JSON.parse(fs.readFileSync(path.join(backupDir, 'receipts.json'), 'utf8')).length, 1);
    assert.equal(await Order.countDocuments(), 0);
    const log = await AuditLog.findOne({ action: 'data.reset' }).lean();
    assert.ok(log.actor.name && log.actor.name !== 'script');
    assert.equal(log.meta.backup, 'bk');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('helpers del CLI: enmascara la URI y detecta producción', () => {
  assert.deepEqual(describeUri('mongodb://127.0.0.1:27017/fiesta_disfraces'), { host: '127.0.0.1:27017', dbName: 'fiesta_disfraces', production: false });
  const prod = describeUri('mongodb+srv://user:secreto@cluster0.abc.mongodb.net/fiesta?retryWrites=true');
  assert.equal(prod.host, 'cluster0.abc.mongodb.net');
  assert.equal(prod.dbName, 'fiesta');
  assert.equal(prod.production, true);
  assert.ok(!JSON.stringify(prod).includes('secreto'));
  assert.equal(describeUri('mongodb://u:p@db.ejemplo.com:27017/x').production, true);
  assert.equal(describeUri('basura'), null);
  const a = parseArgs(['--apply', '--reason', 'Fin de pruebas', '--include-bar', '--no-backup', '--confirm-db=fiesta']);
  assert.deepEqual(
    { apply: a.apply, reason: a.reason, includeBar: a.includeBar, backup: a.backup, confirmDb: a.confirmDb },
    { apply: true, reason: 'Fin de pruebas', includeBar: true, backup: false, confirmDb: 'fiesta' },
  );
  assert.equal(parseArgs([]).apply, false);
});

test('la conexión de prueba es la de memoria (nunca una base real)', () => {
  assert.match(mongoose.connection.host, /127\.0\.0\.1|localhost/);
  assert.equal(mongoose.connection.name, 'fiesta_test');
});
