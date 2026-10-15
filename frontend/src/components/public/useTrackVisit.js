import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiUrl } from '../../lib/api';

// Medidor de visitas anónimo (ver docs/ARQUITECTURA.md "Analítica anónima").
// Solo envía: id aleatorio del navegador, ruta, referrer (primera página de la sesión) y utm/src. Nada personal.
const VID_KEY = 'fd_vid';
const NOTRACK_KEY = 'fd_notrack';
const STAFF_KEY = 'fd_staff_token';
const VID_RE = /^[A-Za-z0-9_-]{16,40}$/;

let memoryVid = null; // si el almacenamiento falla, el id dura lo que dure la sesión de la pestaña
let referrerSent = false;

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* almacenamiento bloqueado */
  }
};

function randomId() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '');
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

function getVid() {
  const stored = read(VID_KEY);
  if (stored && VID_RE.test(stored)) return stored;
  if (memoryVid) return memoryVid;
  const id = randomId();
  memoryVid = id;
  write(VID_KEY, id);
  return id;
}

function send(payload) {
  const url = apiUrl('/api/public/track');
  const body = JSON.stringify(payload);
  try {
    if (typeof fetch === 'function') {
      // text/plain evita el preflight de CORS; credentials 'omit' = sin cookies.
      fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, keepalive: true, credentials: 'omit' }).catch(() => {});
    } else if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    }
  } catch {
    /* nunca debe romper la página */
  }
}

/** Registra cada cambio de ruta pública. Se monta una vez dentro del Router. */
export default function useTrackVisit() {
  const { pathname } = useLocation();
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('notrack') === '1') write(NOTRACK_KEY, '1');
      if (read(NOTRACK_KEY) === '1') return;
      if (read(STAFF_KEY)) return; // el admin/staff no se cuenta a sí mismo
      if (navigator.doNotTrack === '1') return;
      if (pathname === '/staff' || pathname.startsWith('/staff/')) return;
      const payload = { vid: getVid(), path: pathname };
      if (!referrerSent) {
        referrerSent = true;
        if (document.referrer) payload.referrer = document.referrer.slice(0, 300);
      }
      const utm = params.get('utm_source') || params.get('src');
      if (utm) payload.utm = utm.slice(0, 40);
      send(payload);
    } catch {
      /* ignorar */
    }
  }, [pathname]);
}
