// Utilidades del panel de administración (solo las usa /staff/admin/*).

/* ───────────── Fechas en hora de Colombia (UTC−5 fijo, sin horario de verano) ───────────── */

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

function shiftToBogota(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - BOGOTA_OFFSET_MS).toISOString();
}

/** ISO (UTC) → "YYYY-MM-DDTHH:mm" en hora de Colombia, para <input type="datetime-local">. */
export function isoToBogotaInput(iso) {
  return shiftToBogota(iso)?.slice(0, 16) ?? '';
}

/**
 * "YYYY-MM-DDTHH:mm" (hora de Colombia) → ISO UTC (interpreta el valor como -05:00).
 * Si el minuto es :59 se toma hasta el segundo 59 ("hasta las 11:59 p. m." incluye ese minuto).
 */
export function bogotaInputToIso(value) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value || '');
  if (!m) return null;
  const [, date, hh, mm, ss] = m;
  const seconds = ss ?? (mm === '59' ? '59' : '00');
  const d = new Date(`${date}T${hh}:${mm}:${seconds}-05:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO → "YYYY-MM-DD" (fecha en Colombia) para <input type="date">. */
export function isoToBogotaDate(iso) {
  return shiftToBogota(iso)?.slice(0, 10) ?? '';
}

/** "YYYY-MM-DD" → ISO al mediodía de Colombia (así la fecha no cambia en ninguna zona horaria). */
export function bogotaDateToIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  return new Date(`${value}T12:00:00-05:00`).toISOString();
}

/** Fecha de hoy en Colombia: "YYYY-MM-DD". */
export function todayBogota() {
  return new Date(Date.now() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** 90 min → "1 h 30 min"; 3 días → "3 días". */
export function formatDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hours < 48) return min ? `${hours} h ${min} min` : `${hours} h`;
  return `${Math.floor(hours / 24)} días`;
}

/* ───────────── Fase y precios ───────────── */

/** 'preventa' si ahora ≤ presaleEndsAt, si no 'general' (ARQUITECTURA §7.1). */
export function phaseAt(presaleEndsAt, now = Date.now()) {
  const end = presaleEndsAt ? new Date(presaleEndsAt).getTime() : 0;
  return now <= end ? 'preventa' : 'general';
}

/** Precio actual de una entrada en línea según la fase. */
export function currentTicketPrice(settings, gender, now = Date.now()) {
  const phase = phaseAt(settings?.presaleEndsAt, now);
  const table = phase === 'preventa' ? settings?.prices?.preventa : settings?.prices?.puerta;
  return { phase, price: table?.[gender] ?? 0 };
}

/* ───────────── Texto ───────────── */

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

/** Para buscar sin tildes ni mayúsculas. */
export function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** plural(3, 'entrada') → "3 entradas"; plural(1, 'habitación', 'habitaciones') → "1 habitación". */
export function plural(n, singular, pluralForm = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** "3001234567" → "300 123 4567" (legible para llamar o comparar). */
export function formatPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  if (d.length === 12 && d.startsWith('57')) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return phone || '';
}

export function instagramUrl(user) {
  return `https://instagram.com/${encodeURIComponent(String(user || '').replace(/^@/, ''))}`;
}

/* ───────────── Enlaces y WhatsApp ───────────── */

export const orderUrl = (token) => `${window.location.origin}/orden/${token}`;
export const ticketUrl = (token) => `${window.location.origin}/entrada/${token}`;

/** Mensaje de confirmación de una compra pagada (lleva al estado de la orden con los QR). */
export function orderWhatsappText(order) {
  const name = firstName(order?.buyer?.name);
  const link = orderUrl(order?.token);
  if (order?.kind === 'room') {
    const room = order.room?.name || 'tu habitación';
    return `¡Hola ${name}! Tu reserva de la ${room} para la Fiesta de Disfraces está confirmada. Aquí tienes los QR de tu grupo: ${link}`;
  }
  return `¡Hola ${name}! Tu entrada para la Fiesta de Disfraces está confirmada. Aquí tienes tu QR: ${link}`;
}

/** Mensaje para mandarle al comprador el QR de una entrada puntual. */
export function ticketWhatsappText(ticket) {
  const buyer = ticket?.order?.buyer?.name;
  const link = ticketUrl(ticket?.token);
  const same = normalizeSearch(buyer) === normalizeSearch(ticket?.holderName);
  if (same || !ticket?.holderName) {
    return `¡Hola ${firstName(buyer)}! Aquí tienes tu entrada para la Fiesta de Disfraces: ${link}`;
  }
  return `¡Hola ${firstName(buyer)}! Aquí tienes la entrada de ${ticket.holderName} para la Fiesta de Disfraces: ${link}`;
}

/** Copia al portapapeles (con plan B para navegadores sin Clipboard API). */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/* ───────────── Consultas ───────────── */

/** { status: 'paid', q: '' } → "status=paid" (omite vacíos). */
export function toQuery(params) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') sp.set(key, String(value));
  }
  return sp.toString();
}

/* ───────────── Tonos de Badge que no están en lib/labels.js ───────────── */

export const ROOM_STATUS_TONE = { available: 'green', held: 'amber', booked: 'violet', blocked: 'neutral' };
export const ROLE_TONE = { admin: 'red', puerta: 'violet', barra: 'orange' };

/** Nombre de archivo para exportaciones: fiesta-compras-2026-10-08.csv */
export function exportFilename(slug) {
  return `fiesta-${slug}-${todayBogota()}.csv`;
}
