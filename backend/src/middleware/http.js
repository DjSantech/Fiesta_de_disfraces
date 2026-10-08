// Middlewares HTTP: auth (JWT + roles), rate limits, subida de comprobantes, 404 y manejador central de errores.
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { User } from '../models/index.js';
import { AppError, unauthorized, forbidden, notFound, validationError, OBJECT_ID_RE } from '../lib/util.js';
import { MAX_RECEIPT_BYTES } from '../constants.js';

// ---------- Auth ----------
export function signToken(config, user) {
  return jwt.sign({ sub: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '12h' });
}

/** Verifica el JWT y que el usuario siga activo (el rol se toma de la base, no del token). */
export function requireAuth(ctx) {
  return async (req, res, next) => {
    const m = (req.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
    if (!m) throw unauthorized();
    let payload;
    try {
      payload = jwt.verify(m[1], ctx.config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw unauthorized('Tu sesión venció. Inicia sesión de nuevo.');
    }
    if (!OBJECT_ID_RE.test(String(payload?.sub))) throw unauthorized();
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.active || (user.tokenVersion ?? 0) !== (payload.tv ?? 0)) {
      throw unauthorized('Tu sesión ya no es válida. Inicia sesión de nuevo.');
    }
    req.user = { id: String(user._id), _id: user._id, username: user.username, name: user.name, role: user.role, doc: user };
    next();
  };
}
export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) throw forbidden();
  next();
};

// ---------- Rate limits (formato de error del contrato) ----------
export function createLimiters(enabled) {
  const make = (windowMs, limit, extra = {}) =>
    enabled
      ? rateLimit({
        windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, ...extra,
        handler: (req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Espera un momento y vuelve a intentar.' } }),
      })
      : (req, res, next) => next();
  return {
    quote: make(60_000, 30),
    orders: make(60_000, 10),
    receipt: make(10 * 60_000, 10),
    recover: make(15 * 60_000, 5),
    login: make(15 * 60_000, 10, { skipSuccessfulRequests: true }),
    pay: make(60_000, 10),
    verify: make(60_000, 20),
    read: make(60_000, 120),
    webhook: make(60_000, 300),
  };
}

// ---------- Comprobantes: multer en memoria + magic bytes ----------
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_BYTES, files: 1, fields: 5, fieldSize: 1024, parts: 8 },
}).single('file');

export function receiptUpload(req, res, next) {
  uploader(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'FILE_TOO_LARGE', 'El comprobante pesa más de 5 MB. Sube una imagen más liviana.'));
    return next(validationError({ file: 'No pudimos leer el archivo. Sube una sola imagen en el campo "file".' }));
  });
}

/** Tipo real de la imagen según sus primeros bytes (no se confía en el cliente). */
export function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// ---------- 404 y errores ----------
export const notFoundHandler = () => {
  throw notFound('Ruta no encontrada.');
};

function toResponse(err) {
  if (err instanceof AppError) {
    const error = { code: err.code, message: err.message };
    if (err.details !== undefined) error.details = err.details;
    return [err.status, { error }];
  }
  if (err?.type === 'entity.parse.failed') return [400, { error: { code: 'VALIDATION_ERROR', message: 'El JSON enviado no es válido.', details: { fields: {} } } }];
  if (err?.type === 'entity.too.large') return [400, { error: { code: 'VALIDATION_ERROR', message: 'Los datos enviados son demasiado grandes.', details: { fields: {} } } }];
  if (err?.name === 'ValidationError' && err.errors) {
    const fields = Object.fromEntries(Object.keys(err.errors).map((k) => [k, 'Valor inválido.']));
    return [400, { error: { code: 'VALIDATION_ERROR', message: 'Revisa los datos marcados.', details: { fields } } }];
  }
  if (err?.name === 'CastError') return [404, { error: { code: 'NOT_FOUND', message: 'No encontramos lo que buscas.' } }];
  if (err?.code === 11000) {
    if (err.keyPattern?.username) return [409, { error: { code: 'USERNAME_TAKEN', message: 'Ese usuario ya existe. Elige otro.' } }];
    return [409, { error: { code: 'INVALID_STATE', message: 'Ya existe un registro con esos datos.' } }];
  }
  if (err?.type && Number.isInteger(err.status) && err.status < 500) {
    return [400, { error: { code: 'VALIDATION_ERROR', message: 'Solicitud inválida.', details: { fields: {} } } }];
  }
  return [500, { error: { code: 'INTERNAL', message: 'Ocurrió un error inesperado. Intenta de nuevo.' } }];
}

export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const [status, body] = toResponse(err);
    if (status >= 500) logger.error(`${req.method} ${redactPath(req.originalUrl)} →`, err?.stack || err);
    if (res.headersSent) return res.end();
    res.status(status).json(body);
  };
}

/** Oculta tokens de las rutas en los logs. */
export const redactPath = (p) => String(p).split('?')[0].replace(/\/[A-Za-z0-9_-]{20,64}(?=\/|$)/g, '/:token');
