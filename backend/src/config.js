// Lectura y validación de variables de entorno. En producción falla rápido si falta algo crítico.
import { randomBytes } from 'node:crypto';

const DEFAULT_MONGO = 'mongodb://127.0.0.1:27017/fiesta_disfraces';

export function loadConfig(env = process.env) {
  const nodeEnv = (env.NODE_ENV || 'development').trim();
  const isProd = nodeEnv === 'production';
  const errors = [];
  const warnings = [];

  const port = Number(env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT debe ser un puerto válido.');

  const mongoUri = (env.MONGODB_URI || '').trim() || (isProd ? '' : DEFAULT_MONGO);
  if (!mongoUri) errors.push('Falta MONGODB_URI (cadena de conexión de MongoDB Atlas).');

  let jwtSecret = (env.JWT_SECRET || '').trim();
  if (isProd && jwtSecret.length < 32) errors.push('JWT_SECRET debe tener al menos 32 caracteres en producción.');
  if (!jwtSecret) {
    jwtSecret = randomBytes(48).toString('base64url');
    if (nodeEnv !== 'test') warnings.push('JWT_SECRET vacío: se generó uno temporal (las sesiones se cierran al reiniciar).');
  }

  const frontendOrigins = [];
  for (const raw of String(env.FRONTEND_URL || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      const u = new URL(raw);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
      frontendOrigins.push(u.origin);
    } catch {
      errors.push(`FRONTEND_URL inválida: ${raw}`);
    }
  }
  if (!frontendOrigins.length) {
    if (isProd) errors.push('Falta FRONTEND_URL (URL pública del frontend).');
    frontendOrigins.push('http://localhost:5173');
  }

  const backendPublicUrl = (env.BACKEND_PUBLIC_URL || '').trim().replace(/\/+$/, '') || `http://localhost:${port}`;
  const mpAccessToken = (env.MP_ACCESS_TOKEN || '').trim();
  const mpWebhookSecret = (env.MP_WEBHOOK_SECRET || '').trim();
  const mpMock = !mpAccessToken && !isProd;
  if (isProd && !mpAccessToken) warnings.push('Sin MP_ACCESS_TOKEN: Mercado Pago queda deshabilitado (solo transferencia).');
  if (mpAccessToken && !mpWebhookSecret) warnings.push('Sin MP_WEBHOOK_SECRET: no se valida la firma del webhook (igual se re-consulta cada pago).');
  if (mpAccessToken && !backendPublicUrl.startsWith('https://')) warnings.push('BACKEND_PUBLIC_URL no es https: Mercado Pago no enviará webhooks (se usa verify-mp y la conciliación periódica).');

  if (errors.length) {
    const e = new Error(`Configuración inválida:\n - ${errors.join('\n - ')}`);
    e.configErrors = errors;
    throw e;
  }

  return Object.freeze({
    nodeEnv, isProd, port, mongoUri, jwtSecret,
    frontendOrigins, frontendBaseUrl: frontendOrigins[0], backendPublicUrl,
    adminUsername: (env.ADMIN_USERNAME || 'admin').trim().toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD || '',
    mpAccessToken, mpWebhookSecret, mpMock,
    warnings,
  });
}
