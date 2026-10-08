// App Express: seguridad, CORS, JSON y rutas. Se exporta como función para los tests.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { isDbUp } from './db.js';
import { createLogger } from './lib/util.js';
import { createLimiters, requireAuth, requireRole, notFoundHandler, errorHandler, redactPath } from './middleware/http.js';
import { createMercadoPagoService } from './services/mercadopago.js';
import { publicRouter } from './routes/public.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { doorRouter, barRouter } from './routes/ops.js';

const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** ctx = { config, mp, logger }. Opciones: rateLimits (por defecto true), accessLog. */
export function createContext({ config, mp, logger }) {
  return { config, logger: logger || createLogger(), mp: mp || createMercadoPagoService(config) };
}

export function createApp(ctx, { rateLimits = true, accessLog = false } = {}) {
  const { config, logger } = ctx;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render está detrás de un proxy
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const allowed = new Set(config.frontendOrigins);
  app.use(cors({
    origin(origin, cb) {
      cb(null, Boolean(origin) && (allowed.has(origin) || (!config.isProd && DEV_ORIGIN.test(origin))) ? origin : false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  }));
  if (accessLog) {
    app.use((req, res, next) => {
      const t = Date.now();
      res.on('finish', () => logger.info(`${req.method} ${redactPath(req.originalUrl)} ${res.statusCode} ${Date.now() - t}ms`));
      next();
    });
  }
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (req, res) => res.type('text/plain').send('Fiesta de Disfraces API — OK'));
  app.get('/api/health', async (req, res) => {
    if (await isDbUp()) res.json({ ok: true, db: 'up', time: new Date().toISOString() });
    else res.status(503).json({ ok: false, db: 'down' });
  });

  const limits = createLimiters(rateLimits);
  app.use('/api/public', publicRouter(ctx, limits));
  app.use('/api/auth', authRouter(ctx, limits));
  app.use('/api/admin', requireAuth(ctx), requireRole('admin'), adminRouter(ctx));
  app.use('/api/door', requireAuth(ctx), requireRole('puerta', 'admin'), doorRouter(ctx));
  app.use('/api/bar', requireAuth(ctx), requireRole('barra', 'admin'), barRouter(ctx));
  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
