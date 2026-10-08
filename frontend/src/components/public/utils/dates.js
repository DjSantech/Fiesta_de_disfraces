import { TIME_ZONE } from '../../../lib/format';

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "24 de octubre" (hora de Colombia) */
export function dayMonth(value) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('es-CO', { timeZone: TIME_ZONE, day: 'numeric', month: 'long' }).format(d);
}

/** "sáb 31 oct" */
export function shortWeekdayDate(value) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('es-CO', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' })
    .format(d)
    .replace(/\./g, '')
    .replace(',', '');
}

/** Días completos que faltan (0 si ya pasó). */
export function daysUntil(value, now = Date.now()) {
  const d = toDate(value);
  if (!d) return 0;
  return Math.max(0, Math.ceil((d.getTime() - now) / 86400000));
}

/** Partes de una cuenta regresiva. */
export function countdownParts(target, now = Date.now()) {
  const d = toDate(target);
  const diff = d ? d.getTime() - now : 0;
  const total = Math.max(0, diff);
  const sec = Math.floor(total / 1000);
  return {
    diff,
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
  };
}

/** Fase calculada en el navegador (para el respaldo mientras carga la API). */
export function computePhase(presaleEndsAt, now = Date.now()) {
  const d = toDate(presaleEndsAt);
  if (!d) return 'preventa';
  return now <= d.getTime() ? 'preventa' : 'general';
}
