// Conexión a MongoDB con reintentos y chequeo de salud.
import mongoose from 'mongoose';
import { sleep } from './lib/util.js';

mongoose.set('strictQuery', true);

const safeUri = (uri) => uri.replace(/\/\/[^@/]*@/, '//***@');

/** Intenta cada 2 s hasta ~60 s (sondeo corto) y luego abre la conexión definitiva. */
export async function connectWithRetry(uri, logger, { maxWaitMs = 60_000, retryDelayMs = 2_000 } = {}) {
  const started = Date.now();
  for (let attempt = 1; ; attempt++) {
    const probe = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 2000 });
    try {
      await probe.asPromise();
      await probe.close();
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 20 });
      logger.info(`MongoDB conectado (${safeUri(uri)})`);
      return mongoose.connection;
    } catch (err) {
      await probe.close().catch(() => {});
      if (Date.now() - started + retryDelayMs > maxWaitMs) {
        throw new Error(`No se pudo conectar a MongoDB en ${Math.round(maxWaitMs / 1000)} s (${safeUri(uri)}): ${err.message}. En local, ¿corriste "npm run db"?`);
      }
      logger.warn(`MongoDB no responde (intento ${attempt}): ${err.message}. Reintentando en 2 s…`);
      await sleep(retryDelayMs);
    }
  }
}

export async function isDbUp() {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    await Promise.race([mongoose.connection.db.admin().ping(), sleep(2000).then(() => { throw new Error('timeout'); })]);
    return true;
  } catch {
    return false;
  }
}
