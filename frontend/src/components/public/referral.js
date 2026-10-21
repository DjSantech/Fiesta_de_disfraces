import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiUrl } from '../../lib/api';
import { getVid } from './useTrackVisit';

// Link de promotores (?ref=CODIGO). Ver docs/ARQUITECTURA.md §12.
// Se guarda el código con su fecha en localStorage (fd_ref) por 30 días; el último ref gana.
const REF_KEY = 'fd_ref';
const REF_TTL_MS = 30 * 864e5;
const CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const normalizeRef = (v) => {
  const c = String(v || '').trim().toUpperCase();
  return CODE_RE.test(c) ? c : null;
};

/** Código de promotor vigente en este navegador, o null. */
export function currentRef() {
  try {
    const saved = JSON.parse(read(REF_KEY) || 'null');
    const code = normalizeRef(saved?.code);
    if (!code) return null;
    if (!(Date.now() - Number(saved.at) < REF_TTL_MS)) {
      localStorage.removeItem(REF_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

function saveRef(code) {
  try {
    localStorage.setItem(REF_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    /* almacenamiento bloqueado */
  }
}

/** No se cuenta: staff, el propio promotor con sesión abierta, ?notrack o Do Not Track. */
function shouldSkip() {
  return Boolean(read('fd_staff_token') || read('fd_promoter_token') || read('fd_notrack') === '1' || navigator.doNotTrack === '1');
}

/** Evento anónimo para el promotor: 'visit' o 'whatsapp'. Nunca rompe la página. */
export function sendRefEvent(type, code = currentRef()) {
  try {
    if (!code || shouldSkip()) return;
    const url = apiUrl(`/api/public/ref/${type === 'whatsapp' ? 'whatsapp' : 'visit'}`);
    const body = JSON.stringify({ code, vid: getVid() });
    // sendBeacon sobrevive a que el clic abra WhatsApp; si no, fetch keepalive (text/plain = sin preflight).
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
    fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, keepalive: true, credentials: 'omit' }).catch(() => {});
  } catch {
    /* ignorar */
  }
}

/** Antepone "Código promotor: X" al mensaje de WhatsApp: así el admin sabe qué promotor trajo la venta
 * (va al inicio porque varios mensajes terminan en "Mi nombre es: " para que la persona lo complete). */
export function withRefNote(text) {
  const code = currentRef();
  return code ? `Código promotor: ${code}
${text}` : text;
}

/** Guarda ?ref=CODIGO al entrar y registra la visita. Se monta una vez dentro del Router. */
export function useReferral() {
  const { search } = useLocation();
  useEffect(() => {
    try {
      const code = normalizeRef(new URLSearchParams(search).get('ref'));
      if (!code) return;
      saveRef(code);
      sendRefEvent('visit', code);
    } catch {
      /* ignorar */
    }
  }, [search]);
}
