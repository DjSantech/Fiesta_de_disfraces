// Validación con zod (body, query, params) y campos reutilizables con mensajes en español.
import { z } from 'zod';
import {
  AppError, validationError, notFound, collapseSpaces, normalizeCedula, normalizePhone, normalizeInstagram,
  normalizePlate, CEDULA_RE, PHONE_RE, INSTAGRAM_RE, PLATE_RE, TOKEN_RE, OBJECT_ID_RE,
} from '../lib/util.js';

/** Mapa de errores amable en español (se usa en cada safeParse). */
export function spanishErrorMap(iss) {
  const empty = iss.input === undefined || iss.input === null;
  switch (iss.code) {
    case 'invalid_type':
      if (empty) return 'Este campo es obligatorio.';
      if (iss.expected === 'int') return 'Debe ser un número entero.';
      if (iss.expected === 'number') return 'Debe ser un número.';
      if (iss.expected === 'string') return 'Debe ser texto.';
      if (iss.expected === 'boolean') return 'Debe ser verdadero o falso.';
      if (iss.expected === 'array') return 'Debe ser una lista.';
      return 'Formato inválido.';
    case 'too_small':
      if (iss.origin === 'string') return Number(iss.minimum) <= 1 ? 'Este campo es obligatorio.' : `Debe tener al menos ${iss.minimum} caracteres.`;
      if (iss.origin === 'array') return `Debe tener al menos ${iss.minimum} elemento(s).`;
      return `Debe ser mayor o igual a ${iss.minimum}.`;
    case 'too_big':
      if (iss.origin === 'string') return `Máximo ${iss.maximum} caracteres.`;
      if (iss.origin === 'array') return `Máximo ${iss.maximum} elementos.`;
      return `Debe ser menor o igual a ${iss.maximum}.`;
    case 'invalid_format':
      if (iss.format === 'email') return 'Correo inválido.';
      if (iss.format === 'url') return 'Enlace inválido.';
      if (['datetime', 'date'].includes(iss.format)) return 'Fecha inválida.';
      return 'Formato inválido.';
    case 'invalid_value':
      return 'Opción no válida.';
    default:
      return iss.message || 'Valor inválido.';
  }
}

function issuesToFields(issues, fields) {
  for (const i of issues) {
    const key = i.path.length ? i.path.join('.') : 'body';
    if (!fields[key]) fields[key] = i.message;
  }
}

/** Middleware: valida y deja los datos limpios en req.valid (req.query es de solo lectura en Express 5). */
export function validate({ params, query, body } = {}) {
  return (req, res, next) => {
    req.valid = req.valid || {};
    if (params) {
      const r = params.safeParse(req.params, { error: spanishErrorMap });
      if (!r.success) throw notFound(); // id/token mal formado = recurso inexistente
      req.valid.params = r.data;
    }
    const fields = {};
    if (query) {
      const r = query.safeParse({ ...req.query }, { error: spanishErrorMap });
      if (r.success) req.valid.query = r.data;
      else issuesToFields(r.error.issues, fields);
    }
    if (body) {
      const r = body.safeParse(req.body ?? {}, { error: spanishErrorMap });
      if (r.success) req.valid.body = r.data;
      else issuesToFields(r.error.issues, fields);
    }
    if (Object.keys(fields).length) throw validationError(fields);
    next();
  };
}

/** Lanza VALIDATION_ERROR con un mensaje específico (también como mensaje principal). */
export const fieldError = (field, message) => new AppError(400, 'VALIDATION_ERROR', message, { fields: { [field]: message } });

// ---------- Campos ----------
const emptyToNull = (v) => (v === '' || v === undefined || v === null ? null : v);
const emptyToUndef = (v) => (v === '' || v === null ? undefined : v);

export const objectId = z.string().regex(OBJECT_ID_RE);
export const tokenParam = z.object({ token: z.string().regex(TOKEN_RE) });
export const idParam = z.object({ id: objectId });

export const text = (min, max) =>
  z.string().transform(collapseSpaces).refine((v) => v.length >= min, { error: min <= 1 ? 'Este campo es obligatorio.' : `Debe tener al menos ${min} caracteres.` })
    .refine((v) => v.length <= max, { error: `Máximo ${max} caracteres.` });
export const optText = (max) => z.preprocess((v) => (v == null ? '' : v), z.string().trim().max(max));

export const cedula = z.string().transform(normalizeCedula)
  .refine((v) => CEDULA_RE.test(v), { error: 'Cédula inválida: solo números (y letras si es extranjera), sin puntos.' });
export const phone = z.string().transform(normalizePhone)
  .refine((v) => PHONE_RE.test(v), { error: 'Celular inválido: deben ser 10 dígitos y empezar por 3.' });
export const instagram = z.string().transform(normalizeInstagram)
  .refine((v) => INSTAGRAM_RE.test(v), { error: 'Usuario de Instagram inválido.' });
export const optCedula = z.preprocess(emptyToNull, cedula.nullable());
export const optPhone = z.preprocess(emptyToNull, phone.nullable());
export const optInstagram = z.preprocess((v) => (v === '' || v == null || normalizeInstagram(v) === '' ? null : v), instagram.nullable());
export const email = z.preprocess((v) => (v == null ? '' : v),
  z.string().trim().toLowerCase().max(120).pipe(z.union([z.literal(''), z.email({ error: 'Correo inválido.' })])));
export const plate = z.string().transform(normalizePlate).refine((v) => PLATE_RE.test(v), { error: 'Placa inválida.' });
export const money = z.number().int().min(0).max(100_000_000);
export const percent = z.number().min(0).max(100);
export const isoDate = z.iso.datetime({ offset: true, error: 'Fecha inválida.' }).transform((v) => new Date(v));
export const optIsoDate = z.preprocess(emptyToNull, isoDate.nullable());

// Query
export const qParam = z.preprocess(emptyToUndef, z.string().trim().max(100).optional());
export const flag = z.preprocess(emptyToUndef, z.enum(['1', 'true', '0', 'false']).optional()).transform((v) => v === '1' || v === 'true');
export const pagination = {
  page: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).default(1)),
  limit: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).default(50)).transform((v) => Math.min(v, 200)),
};
export const optEnum = (values) => z.preprocess(emptyToUndef, z.enum(values).optional());
export { z };
