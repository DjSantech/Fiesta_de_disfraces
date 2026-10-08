// Utilidades de test: Mongo efímero (binario 8.2.6), app y logins.
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { loadConfig } from '../src/config.js';
import { createApp, createContext } from '../src/app.js';
import { createLogger } from '../src/lib/util.js';
import { ensureBaseData } from '../src/services/bootstrap.js';
import { User, Settings } from '../src/models/index.js';

let mms;
export async function startDb() {
  mms = await MongoMemoryServer.create({ binary: { version: '8.2.6' } });
  await mongoose.connect(mms.getUri('fiesta_test'));
}
export async function stopDb() {
  await mongoose.disconnect();
  await mms?.stop();
}

/** Base limpia + datos base + usuarios de prueba. Devuelve { app, ctx, api }. */
export async function setup({ env = {}, mp, rateLimits = false } = {}) {
  await mongoose.connection.dropDatabase();
  const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'x'.repeat(40), ADMIN_PASSWORD: 'admin12345', FRONTEND_URL: 'http://localhost:5173', ...env });
  const logger = createLogger({ silent: !process.env.DEBUG_TESTS });
  await ensureBaseData(config, logger);
  // Preventa vigente por defecto (independiente de la fecha real).
  await Settings.updateOne({ _id: 'main' }, { $set: { presaleEndsAt: new Date(Date.now() + 7 * 864e5) } });
  for (const [username, role] of [['puerta', 'puerta'], ['barra', 'barra']]) {
    await User.create({ username, name: username === 'puerta' ? 'Portería' : 'Barra', role, passwordHash: await bcrypt.hash('clave12345', 4) });
  }
  const ctx = createContext({ config, logger, mp });
  const app = createApp(ctx, { rateLimits });
  return { app, ctx, api: request(app) };
}

export async function login(app, username, password = username === 'admin' ? 'admin12345' : 'clave12345') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login ${username}: ${res.status} ${JSON.stringify(res.body)}`);
  return `Bearer ${res.body.token}`;
}

let n = 0;
export function buyer(over = {}) {
  n++;
  return { name: 'Laura Gómez', cedula: `10881${String(n).padStart(5, '0')}`, phone: `300${String(1000000 + n)}`, instagram: `@laura${n}`, email: '', ...over };
}
export const ticketOrder = (over = {}) => ({
  kind: 'ticket', gender: 'mujer', roomNumber: null, buyer: buyer(), companions: [], paymentMethod: 'transferencia', acceptTerms: true, acceptData: true, ...over,
});

// PNG mínimo válido (magic bytes correctos).
export const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
