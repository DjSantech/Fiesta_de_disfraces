// Datos base al arrancar (ajustes, habitaciones, admin) y job periódico.
import bcrypt from 'bcryptjs';
import { allModels, Settings, Room, User } from '../models/index.js';
import { DEFAULT_SETTINGS, DEFAULT_ROOMS, ROOM_LAYOUT_VERSION, SETTINGS_ID, JOB_INTERVAL_MS } from '../constants.js';
import { runOrderMaintenance } from './orders.js';

export const BCRYPT_ROUNDS = 12;

/**
 * Migración idempotente a la distribución de 4 habitaciones (layoutVersion 2) para bases ya existentes.
 * v2: solo toca habitaciones SIN layoutVersion: hab. 2 y 3 reciben las camas/capacidad nuevas (sin tocar nombre, precios,
 * bloqueo ni reserva por órdenes); la hab. 1 queda reservada (vendida fuera de la web). La hab. 4 la crea el bucle de
 * DEFAULT_ROOMS.
 * v3: para layoutVersion < 3 fija SOLO `beds` de la hab. 2 ('...dos camas king') y sube todas a 3.
 * Las bases nuevas se crean con layoutVersion 3 y no se tocan.
 */
async function migrateRoomLayout() {
  // v2: solo documentos sin layoutVersion (legacy).
  const pending = { layoutVersion: { $exists: false } };
  await Room.updateOne({ number: 1, ...pending }, { $set: { reserved: true } });
  for (const n of [2, 3]) {
    const { beds, minPeople, capacity, privateBathroom } = DEFAULT_ROOMS.find((x) => x.number === n);
    await Room.updateOne({ number: n, ...pending }, { $set: { beds, minPeople, capacity, privateBathroom } });
  }
  await Room.updateMany(pending, { $set: { layoutVersion: 2 } });
  // v3: la hab. 2 pasa a "dos camas king" (SOLO `beds`); todas quedan en layoutVersion 3.
  const old = { layoutVersion: { $lt: 3 } };
  await Room.updateOne({ number: 2, ...old }, { $set: { beds: DEFAULT_ROOMS.find((x) => x.number === 2).beds } });
  await Room.updateMany(old, { $set: { layoutVersion: ROOM_LAYOUT_VERSION } });
}

export async function ensureBaseData(config, logger) {
  await Promise.all(allModels.map((m) => m.init())); // índices únicos listos antes de atender
  await Settings.updateOne({ _id: SETTINGS_ID }, { $setOnInsert: DEFAULT_SETTINGS }, { upsert: true });
  // Migración: reglas de invitados (reemplazan guestDiscountPercent) y susto al entrar (nuevo, activo por defecto).
  for (const k of ['guestPresaleDiscount', 'guestGeneralDiscount', 'jumpscare']) {
    await Settings.updateOne({ _id: SETTINGS_ID, [k]: { $exists: false } }, { $set: { [k]: DEFAULT_SETTINGS[k] } });
  }
  await Settings.collection.updateOne({ _id: SETTINGS_ID }, { $unset: { guestDiscountPercent: '' } });
  // Migración: Daviplata sale; cuentas por defecto pasan a Bre-B (llave) + Nequi.
  await Settings.updateOne(
    { _id: SETTINGS_ID, paymentAccounts: { $elemMatch: { label: /daviplata/i } } },
    { $set: { paymentAccounts: DEFAULT_SETTINGS.paymentAccounts.map((a) => ({ ...a })) } },
  );
  await Settings.updateOne(
    { _id: SETTINGS_ID, transferInstructions: /daviplata/i },
    { $set: { transferInstructions: DEFAULT_SETTINGS.transferInstructions } },
  );
  // Migración: la meta de asistentes pasó de 100 a 120 (solo si sigue en el valor viejo; otros valores se respetan).
  await Settings.updateOne({ _id: SETTINGS_ID, capacity: 100 }, { $set: { capacity: 120 } });
  for (const r of DEFAULT_ROOMS) {
    await Room.updateOne({ number: r.number }, { $setOnInsert: { ...r, reserved: false, layoutVersion: ROOM_LAYOUT_VERSION } }, { upsert: true });
    // Migración: habitaciones legacy (sin presalePrice) pasan a los nuevos datos; no toca reserva/apartado.
    await Room.updateOne({ number: r.number, presalePrice: null }, { $set: r });
  }
  await migrateRoomLayout();
  if ((await User.countDocuments()) > 0) return;
  if (!config.adminPassword) {
    if (config.isProd) throw new Error('No hay usuarios: define ADMIN_PASSWORD para crear el administrador inicial.');
    logger.warn('No hay usuarios y ADMIN_PASSWORD está vacío: no se creó el administrador.');
    return;
  }
  if (config.adminPassword.length < 8) throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres.');
  try {
    await User.create({
      username: config.adminUsername, name: 'Administrador', role: 'admin', active: true,
      passwordHash: await bcrypt.hash(config.adminPassword, BCRYPT_ROUNDS),
    });
    logger.info(`Usuario administrador "${config.adminUsername}" creado.`);
  } catch (err) {
    if (err?.code !== 11000) throw err; // otro proceso lo creó a la vez
  }
}

/** Cada 60 s: vence órdenes, libera habitaciones, emite tickets pendientes y concilia con MP. */
export function startJobs(ctx) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runOrderMaintenance(ctx);
    } catch (err) {
      ctx.logger.error('Job periódico falló:', err?.message || err);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, JOB_INTERVAL_MS);
  timer.unref();
  tick();
  return { stop: () => clearInterval(timer), tick };
}
