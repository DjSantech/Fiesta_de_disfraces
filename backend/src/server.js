// Arranque: valida config, conecta a Mongo con reintentos, crea datos base, escucha y programa el job.
import mongoose from 'mongoose';
import { loadConfig } from './config.js';
import { connectWithRetry } from './db.js';
import { createLogger, drainBackground } from './lib/util.js';
import { createApp, createContext } from './app.js';
import { ensureBaseData, startJobs } from './services/bootstrap.js';

const logger = createLogger();
let config;
try {
  config = loadConfig();
} catch (err) {
  logger.error(err.message);
  process.exit(1);
}
for (const w of config.warnings) logger.warn(w);

try {
  await connectWithRetry(config.mongoUri, logger);
  await ensureBaseData(config, logger);
} catch (err) {
  logger.error(err.message);
  process.exit(1);
}

const ctx = createContext({ config, logger });
const app = createApp(ctx, { accessLog: config.nodeEnv !== 'test' });
const server = app.listen(config.port, () => {
  logger.info(`API escuchando en http://localhost:${config.port} (${config.nodeEnv}${ctx.mp.mock ? ', Mercado Pago SIMULADO' : ''})`);
});
server.keepAliveTimeout = 75_000;
server.headersTimeout = 80_000;
server.on('error', (err) => {
  logger.error(err.code === 'EADDRINUSE' ? `El puerto ${config.port} ya está en uso.` : err.message);
  process.exit(1);
});
const jobs = startJobs(ctx);

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  logger.info(`${signal}: cerrando…`);
  setTimeout(() => process.exit(1), 10_000).unref();
  jobs.stop();
  await new Promise((r) => server.close(r));
  await drainBackground(5000);
  await mongoose.disconnect().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
