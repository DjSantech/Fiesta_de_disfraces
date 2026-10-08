// Formatos para UI. Todas las fechas se muestran en hora de Colombia.

export const TIME_ZONE = 'America/Bogota';

const numberFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** 20000 → "$20.000" */
export function formatCOP(value) {
  const n = Math.round(Number(value) || 0);
  return `${n < 0 ? '-' : ''}$${numberFmt.format(Math.abs(n))}`;
}

/** 1234 → "1.234" */
export function formatNumber(value) {
  return numberFmt.format(Math.round(Number(value) || 0));
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "sábado, 31 de octubre" */
export function formatLongDate(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleDateString('es-CO', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' });
}

/** "31 oct 2026" */
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleDateString('es-CO', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' });
}

/** "9:00 p. m." */
export function formatTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleTimeString('es-CO', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' });
}

/** "31 oct, 9:00 p. m." */
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleString('es-CO', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "hace 5 min" / "hace 2 h" / fecha */
export function formatRelative(value) {
  const d = toDate(value);
  if (!d) return '';
  const diff = Math.round((Date.now() - d.getTime()) / 1000);
  if (diff < 45) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
  return formatDateTime(d);
}

/** "3001234567" → "300•••4567" */
export function maskPhone(phone) {
  const s = String(phone || '');
  if (s.length < 7) return s;
  return `${s.slice(0, 3)}•••${s.slice(-4)}`;
}

/** "1088123456" → "••••3456" */
export function maskCedula(cedula) {
  const s = String(cedula || '');
  if (s.length <= 4) return s;
  return `••••${s.slice(-4)}`;
}

/** Enlace de WhatsApp con mensaje. phone: 10 dígitos colombianos o con 57. */
export function whatsappLink(phone, text = '') {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `57${digits}`;
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${q}`;
}

/** Porcentaje 0–100 con 1 decimal máximo. */
export function formatPercent(value) {
  const n = Number(value) || 0;
  return `${String(Math.round(n * 10) / 10).replace('.', ',')}%`;
}
