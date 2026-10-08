// Utilidades de Portería: normalización, precios y etiquetas (ARQUITECTURA §7, CONTRATO §4).
import { staffApi } from '../../../lib/api';
import { DOOR_CATEGORY_LABEL, GENDER_LABEL, VEHICLE_LABEL } from '../../../lib/labels';

// ───────────── Normalización (§7.3) ─────────────

export const normalizeCedula = (v) => String(v || '').replace(/[\s.\-]/g, '').toUpperCase();
export const isValidCedula = (v) => /^[A-Z0-9]{5,15}$/.test(v);

export function normalizePhone(v) {
  let digits = String(v || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('57')) digits = digits.slice(2);
  return digits;
}
export const isValidPhone = (v) => /^3\d{9}$/.test(v);

export const normalizePlate = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Lo que se ve en el campo de código mientras se escribe: "7kq2m9" → "7KQ2-M9". */
export function formatCodeTyping(raw) {
  const text = String(raw || '');
  if (/[/:]/.test(text)) return text; // pegaron la URL del QR: se deja tal cual
  let s = text.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('FD') && s.length > 8) s = s.slice(2);
  s = s.slice(0, 8);
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

/**
 * Valor a enviar a /api/door/scan desde el campo manual.
 * 8 caracteres → "FD-XXXX-XXXX" (Crockford: O→0, I/L→1). Cualquier otra cosa se envía igual.
 */
export function normalizeTicketInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/[/:]/.test(text)) return text;
  let s = text.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('FD') && s.length === 10) s = s.slice(2);
  if (s.length !== 8) return text.toUpperCase();
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1');
  return `FD-${s.slice(0, 4)}-${s.slice(4)}`;
}

// ───────────── Precios (§7.2, §7.11) ─────────────

/** Redondeo a múltiplos de $500. */
export const roundTo500 = (n) => Math.round(n / 500) * 500;

/** Descuento de invitado vigente: el de la persona en la lista o el general. */
export function guestPercent(config, guest) {
  return guest?.discountPercent ?? config?.guestDiscountPercent ?? 0;
}

/** Precio de la entrada en puerta (sin vehículo/casco). */
export function doorEntryPrice(config, category, gender, guest) {
  const g = category === 'invitado' ? gender : category;
  const base = config?.prices?.[g];
  if (!base) return 0;
  if (category !== 'invitado') return base;
  return roundTo500(base * (1 - guestPercent(config, guest) / 100));
}

export const parkingPrice = (config, vehicleType) => (vehicleType ? config?.parking?.[vehicleType] ?? 0 : 0);
export const helmetPrice = (config, stored) => (stored ? config?.parking?.casco ?? 0 : 0);

/** Parqueadero + casco de unos `extras` ({ vehicleType, helmet }). */
export function extrasTotal(config, extras) {
  return parkingPrice(config, extras?.vehicleType) + helmetPrice(config, extras?.helmet);
}

// ───────────── Vehículo / casco ─────────────

export const EMPTY_EXTRAS = { vehicleType: '', plate: '', helmet: false, tag: '' };

/** Errores de los campos de vehículo/casco antes de enviar. */
export function validateExtras(extras) {
  const errors = {};
  if (extras.vehicleType) {
    const plate = normalizePlate(extras.plate);
    if (!plate) errors.plate = 'Escribe la placa';
    else if (plate.length < 4 || plate.length > 8) errors.plate = 'Placa inválida';
  }
  if (extras.helmet && extras.tag.trim().length > 20) errors.tag = 'Máximo 20 caracteres';
  return errors;
}

/** { vehicle, helmet } para el body del backend (null si no aplica). */
export function extrasBody(extras) {
  return {
    vehicle: extras.vehicleType ? { type: extras.vehicleType, plate: normalizePlate(extras.plate) } : null,
    helmet: extras.helmet ? { stored: true, ...(extras.tag.trim() ? { tag: extras.tag.trim() } : {}) } : null,
  };
}

/** Errores del backend (details.fields) → claves de los formularios de portería. */
export function mapFieldErrors(err) {
  const fields = err?.details?.fields || {};
  const out = {};
  for (const [path, msg] of Object.entries(fields)) {
    if (path.startsWith('vehicle')) out.plate = out.plate || msg;
    else if (path.startsWith('helmet')) out.tag = out.tag || msg;
    else if (path === 'paymentMethod') out.method = msg;
    else out[path] = msg;
  }
  return out;
}

// ───────────── Etiquetas ─────────────

/** Tipo de entrada para mostrar en portería: Preventa / General / Invitado / Habitación N / Cortesía. */
export function ticketTypeLabel(t) {
  if (!t) return '';
  if (t.kind === 'room') return t.roomNumber ? `Habitación ${t.roomNumber}` : 'Habitación';
  if (t.kind === 'cortesia') return 'Cortesía';
  if (t.isGuest) return 'Invitado';
  if (t.phase === 'preventa') return 'Preventa';
  return 'General';
}

export const genderLabel = (g) => GENDER_LABEL[g] || '';

/** Tono de Badge por categoría de puerta. */
export const CATEGORY_TONE = { mujer: 'violet', hombre: 'orange', invitado: 'green', habitacion: 'amber', cortesia: 'neutral' };

export const categoryLabel = (c) => DOOR_CATEGORY_LABEL[c] || c;

/** "Carro · ABC123" */
export function vehicleText(vehicle) {
  if (!vehicle?.type) return '';
  return `${VEHICLE_LABEL[vehicle.type] || vehicle.type}${vehicle.plate ? ` · ${vehicle.plate}` : ''}`;
}

/** Orden natural para fichas ("2" antes que "10"). */
export const compareTags = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true, sensitivity: 'base' });

// ───────────── API de portería (CONTRATO §4) ─────────────

export const doorApi = {
  config: (signal) => staffApi('/api/door/config', { signal }),
  stats: (signal) => staffApi('/api/door/stats', { signal }),
  scan: (value, signal) => staffApi('/api/door/scan', { method: 'POST', body: { value }, signal }),
  checkin: (body) => staffApi('/api/door/checkin', { method: 'POST', body }),
  sale: (body) => staffApi('/api/door/sale', { method: 'POST', body }),
  lookup: (q, signal) => staffApi(`/api/door/lookup?q=${encodeURIComponent(q)}`, { signal }),
  entries: (params, signal) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    return staffApi(`/api/door/entries?${qs}`, { signal });
  },
  patchEntry: (id, body) => staffApi(`/api/door/entries/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  voidEntry: (id, reason) => staffApi(`/api/door/entries/${encodeURIComponent(id)}/void`, { method: 'POST', body: { reason } }),
  /** Marca el casco como devuelto conservando la ficha. */
  returnHelmet: (entry) =>
    staffApi(`/api/door/entries/${encodeURIComponent(entry.id)}`, {
      method: 'PATCH',
      body: { helmet: { stored: true, ...(entry.helmet?.tag ? { tag: entry.helmet.tag } : {}), returned: true } },
    }),
};
