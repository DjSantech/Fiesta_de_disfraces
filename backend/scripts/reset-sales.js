// Deja la base "desde cero" (como si nadie hubiera comprado). DESTRUCTIVO e IRREVERSIBLE salvo por el respaldo.
// Por defecto es DRY-RUN (no borra nada). Ver docs/REINICIO_DATOS.md.
//   node backend/scripts/reset-sales.js                                   → dry-run
//   node backend/scripts/reset-sales.js --apply --reason "Fin de pruebas" → borra (pide confirmación)
// Borra: órdenes, tickets, comprobantes, entradas de portería (+ ventas de barra con --include-bar).
// Revierte: habitaciones (libres) e invitados (sin redimir). Conserva: Settings, usuarios, invitados, productos, gastos, AuditLog.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { Order, Ticket, Receipt, DoorEntry, Sale, Room, Guest, Counter, AuditLog } from '../src/models/index.js';

const ROOM_FILTER = { $or: [{ booked: true }, { orderId: { $ne: null } }, { holdExpiresAt: { $ne: null } }] };
const GUEST_FILTER = { $or: [{ redeemed: true }, { redeemedOrderId: { $ne: null } }, { redeemedEntryId: { $ne: null } }, { redeemedAt: { $ne: null } }] };
const COUNTER_FILTER = { _id: { $regex: '^(order|ticket|door)' } }; // contadores ligados a órdenes/tickets (hoy no existen; por si se agregan)

const pad = (n) => String(n).padStart(2, '0');
export const stamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

/** Cuenta lo que se borraría / revertiría (solo lectura). */
export async function countAffected({ includeBar = false } = {}) {
  const [orders, tickets, receipts, doorEntries, rooms, guests, barSales] = await Promise.all([
    Order.countDocuments(), Ticket.countDocuments(), Receipt.countDocuments(), DoorEntry.countDocuments(),
    Room.countDocuments(ROOM_FILTER), Guest.countDocuments(GUEST_FILTER), includeBar ? Sale.countDocuments() : 0,
  ]);
  return { orders, tickets, receipts, doorEntries, barSales, roomsReleased: rooms, guestsRestored: guests };
}

/** Respaldo JSON (EJSON, conserva ObjectId/Date/Buffer) escribiendo de a un documento para no cargar todo en memoria. */
async function backupAll(dir, { includeBar }) {
  const { EJSON } = mongoose.mongo.BSON;
  fs.mkdirSync(dir, { recursive: true });
  const sets = [
    ['orders', Order, {}], ['tickets', Ticket, {}], ['receipts', Receipt, {}], ['doorentries', DoorEntry, {}],
    ['rooms', Room, ROOM_FILTER], ['guests', Guest, GUEST_FILTER],
  ];
  if (includeBar) sets.push(['sales', Sale, {}], ['counters', Counter, { _id: 'bar_sale' }]);
  const files = {};
  for (const [name, Model, filter] of sets) {
    const file = path.join(dir, `${name}.json`);
    const fd = fs.openSync(file, 'w');
    try {
      fs.writeSync(fd, '[');
      let first = true;
      for await (const doc of Model.find(filter).lean().cursor()) {
        fs.writeSync(fd, (first ? '\n' : ',\n') + EJSON.stringify(doc, { relaxed: false }));
        first = false;
      }
      fs.writeSync(fd, '\n]\n');
    } finally { fs.closeSync(fd); }
    files[name] = path.basename(file);
  }
  return files;
}

/**
 * Función principal (testeable; el CLI solo la invoca). Requiere mongoose ya conectado.
 * dryRun (por defecto true): solo cuenta. Con dryRun=false exige reason (>=3 caracteres).
 * backupDir: carpeta destino del respaldo (null = sin respaldo).
 */
export async function resetSales({ includeBar = false, reason, operator, dryRun = true, backupDir = null } = {}) {
  const motive = typeof reason === 'string' ? reason.trim() : '';
  if (!dryRun && motive.length < 3) throw new Error('El motivo (reason) es obligatorio y debe tener al menos 3 caracteres.');
  const counts = await countAffected({ includeBar });
  if (dryRun) return { dryRun: true, counts, backupDir: null };

  const name = String(operator || process.env.OPERATOR || os.userInfo().username || 'desconocido');
  let files = null;
  if (backupDir) files = await backupAll(backupDir, { includeBar });

  // Auditoría ANTES de borrar (inmutable). Si algo falla después, se descarta para no mentir.
  const audit = await AuditLog.create({
    at: new Date(),
    actor: { id: null, username: 'script', name, role: 'system' },
    action: 'data.reset',
    target: { type: 'order', id: 'reset', summary: { scope: includeBar ? 'ventas + barra' : 'ventas' } }, // el enum de target no tiene 'system'
    reason: motive,
    meta: { ...counts, includeBar, backup: backupDir ? path.basename(backupDir) : null },
  });
  try {
    await Room.updateMany(ROOM_FILTER, { $set: { booked: false, orderId: null, holdExpiresAt: null } });
    await Guest.updateMany(GUEST_FILTER, { $set: { redeemed: false, redeemedOrderId: null, redeemedEntryId: null, redeemedAt: null } });
    await Promise.all([Receipt.deleteMany({}), Ticket.deleteMany({}), DoorEntry.deleteMany({})]);
    await Order.deleteMany({});
    await Counter.deleteMany(COUNTER_FILTER);
    if (includeBar) {
      await Sale.deleteMany({});
      await Counter.deleteOne({ _id: 'bar_sale' });
    }
  } catch (err) {
    err.message = `Reinicio incompleto (puedes volver a ejecutarlo, es idempotente; respaldo: ${backupDir ?? 'no hecho'}): ${err.message}`;
    throw err;
  }
  return { dryRun: false, counts, backupDir, files, auditId: String(audit._id) };
}

// ---------------- CLI ----------------
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

/** Host y base sin usuario ni clave (nunca se imprime la URI completa). */
export function describeUri(uri) {
  const m = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)\/?([^?]*)/i.exec(uri || '');
  if (!m) return null;
  const srv = !!m[1];
  const host = m[2];
  const hosts = host.split(',').map((h) => h.replace(/:\d+$/, '').toLowerCase());
  const local = hosts.every((h) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(h));
  const production = srv || /atlas|mongodb\.net/i.test(host) || !local;
  return { host, dbName: decodeURIComponent(m[3] || '') || 'test', production };
}

export function parseArgs(argv) {
  const o = { apply: false, includeBar: false, backup: true, reason: null, confirmDb: null, confirmProd: null, help: false, unknown: [] };
  for (let i = 0; i < argv.length; i++) {
    let [k, v] = argv[i].startsWith('--') && argv[i].includes('=') ? [argv[i].slice(0, argv[i].indexOf('=')), argv[i].slice(argv[i].indexOf('=') + 1)] : [argv[i], undefined];
    const val = () => (v !== undefined ? v : argv[++i]);
    if (k === '--apply') o.apply = true;
    else if (k === '--include-bar') o.includeBar = true;
    else if (k === '--no-backup') o.backup = false;
    else if (k === '--reason') o.reason = val();
    else if (k === '--confirm-db') o.confirmDb = val();
    else if (k === '--confirm-prod') o.confirmProd = val();
    else if (k === '--help' || k === '-h') o.help = true;
    else o.unknown.push(argv[i]);
  }
  return o;
}

const HELP = `Uso: node backend/scripts/reset-sales.js [opciones]   (MONGODB_URI en el entorno)
  (sin opciones)       DRY-RUN: muestra qué se borraría y NO borra nada
  --apply              borra de verdad (requiere --reason y confirmación)
  --reason "texto"     motivo (obligatorio con --apply, mín. 3 caracteres)
  --include-bar        borra también ventas de barra y reinicia su consecutivo
  --no-backup          no hacer respaldo JSON en backups/
  --confirm-db <base>  confirmación sin teclado (obligatoria si no hay TTY)
  --confirm-prod PRODUCCION   igual, para hosts de producción sin TTY`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return console.log(HELP);
  if (args.unknown.length) { console.error(red(`Opciones desconocidas: ${args.unknown.join(' ')}`)); console.error(HELP); process.exit(1); }
  const uri = process.env.MONGODB_URI;
  const info = describeUri(uri);
  if (!info) { console.error(red('Falta MONGODB_URI (o no es una URI de MongoDB válida).')); process.exit(1); }
  if (args.apply && (args.reason ?? '').trim().length < 3) { console.error(red('Con --apply debes indicar --reason "motivo" (mínimo 3 caracteres).')); process.exit(1); }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const dbName = mongoose.connection.name;
  const production = info.production;
  try {
    console.log(bold('\nReinicio de datos de la fiesta'));
    console.log(`  Servidor: ${info.host}\n  Base:     ${dbName}\n  Modo:     ${args.apply ? red('APPLY (borra de verdad)') : 'DRY-RUN (no borra nada)'}${args.includeBar ? ' + barra' : ''}`);
    if (production) console.log(red('\n  *** ATENCION: parece una base de PRODUCCION (no es localhost) ***'));
    const c = await countAffected({ includeBar: args.includeBar });
    console.log('\nSe BORRARIA:');
    console.log(`  Órdenes: ${c.orders} · Tickets: ${c.tickets} · Comprobantes: ${c.receipts} · Entradas de portería: ${c.doorEntries}`);
    console.log(`  Ventas de barra: ${args.includeBar ? c.barSales : 'no (usa --include-bar)'}`);
    console.log('Se REVERTIRIA:');
    console.log(`  Habitaciones a libres: ${c.roomsReleased} · Invitados sin redimir: ${c.guestsRestored}`);
    console.log('Se CONSERVA: ajustes, usuarios, lista de invitados, productos y stock, gastos, habitaciones (config) y TODA la auditoría.');

    if (!args.apply) { console.log('\nDry-run terminado. No se cambió nada. Para borrar: agrega --apply --reason "..."\n'); return; }

    // Confirmaciones
    if (process.stdin.isTTY && process.stdout.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      try {
        const a = (await rl.question(`\nEscribe EXACTAMENTE el nombre de la base (${dbName}) para confirmar: `)).trim();
        if (a !== dbName) { console.error(red('No coincide. Cancelado, no se borró nada.')); process.exitCode = 1; return; }
        if (production) {
          const p = (await rl.question(red('Base de PRODUCCION. Escribe PRODUCCION para continuar: '))).trim();
          if (p !== 'PRODUCCION') { console.error(red('No coincide. Cancelado, no se borró nada.')); process.exitCode = 1; return; }
        }
      } finally { rl.close(); }
    } else {
      if (args.confirmDb !== dbName) { console.error(red(`Sin TTY: debes pasar --confirm-db ${dbName}. Cancelado.`)); process.exitCode = 1; return; }
      if (production && args.confirmProd !== 'PRODUCCION') { console.error(red('Sin TTY y base de producción: agrega --confirm-prod PRODUCCION. Cancelado.')); process.exitCode = 1; return; }
    }

    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const backupDir = args.backup ? path.join(root, 'backups', stamp()) : null;
    const r = await resetSales({ includeBar: args.includeBar, reason: args.reason, operator: undefined, dryRun: false, backupDir });
    if (backupDir) console.log(`\nRespaldo guardado en: ${backupDir}`);
    else console.log('\nSin respaldo (--no-backup).');
    console.log(bold('Listo. Base reiniciada y registrada en la auditoría (data.reset).'));
    console.log(`  Borrado: ${r.counts.orders} órdenes, ${r.counts.tickets} tickets, ${r.counts.receipts} comprobantes, ${r.counts.doorEntries} entradas de portería, ${r.counts.barSales} ventas de barra.`);
    console.log(`  Revertido: ${r.counts.roomsReleased} habitaciones, ${r.counts.guestsRestored} invitados.\n`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => { console.error(red(`Error: ${err.message}`)); process.exit(1); });
}
