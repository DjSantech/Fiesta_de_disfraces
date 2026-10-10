// Datos base al arrancar (ajustes, habitaciones, admin) y job periódico.
import bcrypt from 'bcryptjs';
import { allModels, Settings, Room, User } from '../models/index.js';
import { DEFAULT_SETTINGS, DEFAULT_ROOMS, SETTINGS_ID, JOB_INTERVAL_MS } from '../constants.js';
import { runOrderMaintenance } from './orders.js';

export const BCRYPT_ROUNDS = 12;

export async function ensureBaseData(config, logger) {
  await Promise.all(allModels.map((m) => m.init())); // índices únicos listos antes de atender
  await Settings.updateOne({ _id: SETTINGS_ID }, { $setOnInsert: DEFAULT_SETTINGS }, { upsert: true });
  // Migración: reglas de invitados (reemplazan guestDiscountPercent).
  for (const k of ['guestPresaleDiscount', 'guestGeneralDiscount']) {
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
  for (const r of DEFAULT_ROOMS) {
    await Room.updateOne({ number: r.number }, { $setOnInsert: r }, { upsert: true });
    // Migración: habitaciones legacy (sin presalePrice) pasan a los nuevos datos; no toca reserva/apartado.
    await Room.updateOne({ number: r.number, presalePrice: null }, { $set: r });
  }
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
