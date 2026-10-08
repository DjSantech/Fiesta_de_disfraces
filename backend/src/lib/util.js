// Utilidades compartidas: errores, normalización, tokens, búsqueda, fechas, CSV, logger y tareas en segundo plano.
import { randomBytes, randomInt } from 'node:crypto';

// ---------- Errores de la API (formato del contrato) ----------
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
export const validationError = (fields, message = 'Revisa los datos marcados.') =>
  new AppError(400, 'VALIDATION_ERROR', message, { fields });
export const unauthorized = (m = 'Inicia sesión para continuar.') => new AppError(401, 'UNAUTHORIZED', m);
export const forbidden = (m = 'No tienes permiso para hacer esto.') => new AppError(403, 'FORBIDDEN', m);
export const notFound = (m = 'No encontramos lo que buscas.') => new AppError(404, 'NOT_FOUND', m);
export const invalidState = (m) => new AppError(409, 'INVALID_STATE', m);
export const salesClosed = () =>
  new AppError(403, 'SALES_CLOSED', 'Las ventas en línea están cerradas por ahora. Escríbenos por WhatsApp.');
export const soldOut = () => new AppError(409, 'SOLD_OUT', 'Se agotaron las entradas. Escríbenos por WhatsApp por si se libera un cupo.');
export const roomUnavailable = (m = 'Esta habitación ya no está disponible. Elige otra o compra entrada general.') =>
  new AppError(409, 'ROOM_UNAVAILABLE', m);
export const alreadyHasTicket = (m, details) =>
  new AppError(
    409,
    'ALREADY_HAS_TICKET',
    m || 'Esta cédula ya tiene una entrada o una compra en revisión. Si no la encuentras, recupérala con tu cédula y celular.',
    details,
  );
export const paymentProviderError = (cause) => {
  const e = new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'No pudimos conectar con Mercado Pago. Intenta de nuevo en unos minutos o paga por transferencia.');
  e.cause = cause;
  return e;
};

// ---------- Normalización (ARQUITECTURA §7.3) ----------
export const CEDULA_RE = /^[A-Z0-9]{5,15}$/;
export const PHONE_RE = /^3\d{9}$/;
export const INSTAGRAM_RE = /^[a-z0-9._]{1,30}$/;
export const PLATE_RE = /^[A-Z0-9]{3,10}$/;
export const collapseSpaces = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const normalizeCedula = (s) => String(s ?? '').replace(/[\s.-]/g, '').toUpperCase();
export function normalizePhone(s) {
  let d = String(s ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return d;
}
export function normalizeInstagram(s) {
  let v = String(s ?? '').trim().toLowerCase();
  const m = v.match(/instagram\.com\/([^/?#\s]+)/);
  if (m) v = m[1];
  return v.replace(/^@+/, '');
}
export const normalizePlate = (s) => String(s ?? '').replace(/[\s-]/g, '').toUpperCase();
export const maskPhone = (p) => (p && p.length >= 7 ? `${p.slice(0, 3)}•••${p.slice(-4)}` : p || '');
export const last4 = (s) => (s ? String(s).slice(-4) : null);
/** Normaliza y devuelve null si no es válido (útil para búsquedas tolerantes). */
export function tryIds({ cedula, phone, instagram } = {}) {
  const c = normalizeCedula(cedula);
  const p = normalizePhone(phone);
  const i = normalizeInstagram(instagram);
  return { cedula: CEDULA_RE.test(c) ? c : null, phone: PHONE_RE.test(p) ? p : null, instagram: INSTAGRAM_RE.test(i) ? i : null };
}

// ---------- Tokens y códigos ----------
export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
export const randomToken = () => randomBytes(18).toString('base64url'); // 24 caracteres
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function randomTicketCode() {
  let s = '';
  for (let i = 0; i < 8; i++) s += CROCKFORD[randomInt(32)];
  return `FD-${s.slice(0, 4)}-${s.slice(4)}`;
}
/** "fd 7kq2-m9x4" → "FD-7KQ2-M9X4" (tolera O/I/L). null si no parece código. */
export function normalizeTicketCode(input) {
  let v = String(input ?? '').toUpperCase().replace(/[\s\-_.]/g, '');
  if (v.length === 10 && v.startsWith('FD')) v = v.slice(2);
  if (v.length !== 8) return null;
  v = v.replace(/O/g, '0').replace(/[IL]/g, '1');
  if (!/^[0-9A-HJKMNP-TV-Z]{8}$/.test(v)) return null;
  return `FD-${v.slice(0, 4)}-${v.slice(4)}`;
}

// ---------- Búsqueda ----------
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const VARIANTS = { a: 'aáàâä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôö', u: 'uúùûü', n: 'nñ' };
const stripAccents = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Regex sin distinguir mayúsculas ni tildes, con el texto escapado. */
export function textRegex(q) {
  const base = escapeRegex(stripAccents(String(q).trim()).toLowerCase());
  return new RegExp(base.replace(/[aeioun]/g, (ch) => `[${VARIANTS[ch]}${VARIANTS[ch].toUpperCase()}]`), 'i');
}

// ---------- Fechas ----------
export const iso = (d) => (d ? new Date(d).toISOString() : null);
export const addMinutes = (d, m) => new Date(d.getTime() + m * 60_000);
/** Formato de Mercado Pago con zona de Bogotá (-05:00, sin horario de verano). */
export const toMpDate = (d) => new Date(d.getTime() - 5 * 3600_000).toISOString().replace('Z', '-05:00');
export function bogotaDateTime(d) {
  if (!d) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(d)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
export const bogotaTime = (d) =>
  new Date(d).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });

// ---------- CSV (Excel en español: BOM + ';') ----------
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s;
  if (typeof value === 'number') s = String(value);
  else if (typeof value === 'boolean') s = value ? 'Sí' : 'No';
  else if (value instanceof Date) s = bogotaDateTime(value);
  else {
    s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita inyección de fórmulas
  }
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (headers, rows) =>
  `﻿${[headers, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')}\r\n`;

// ---------- Notas ----------
export function appendNote(current, note) {
  if (!note) return current || '';
  if (!current) return note;
  if (note.startsWith(current)) return note; // el formulario ya traía las notas previas
  if (current.includes(note)) return current;
  return `${current}\n${note}`;
}

// ---------- Logger ----------
export function createLogger({ silent = false } = {}) {
  const ts = () => new Date().toISOString();
  return {
    info: (...a) => !silent && console.log(ts(), ...a),
    warn: (...a) => !silent && console.warn(ts(), 'ADVERTENCIA', ...a),
    error: (...a) => !silent && console.error(ts(), 'ERROR', ...a),
  };
}

// ---------- Tareas en segundo plano (webhook) ----------
const pending = new Set();
export function runInBackground(fn, logger) {
  const p = Promise.resolve()
    .then(fn)
    .catch((err) => logger?.error('Tarea en segundo plano falló:', err?.message || err))
    .finally(() => pending.delete(p));
  pending.add(p);
  return p;
}
export async function drainBackground(timeoutMs = 5000) {
  const t = new Promise((r) => setTimeout(r, timeoutMs).unref());
  await Promise.race([Promise.allSettled([...pending]), t]);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const isDuplicateKey = (err, field) =>
  err?.code === 11000 && (!field || err.keyPattern?.[field] || String(err.message).includes(field));
