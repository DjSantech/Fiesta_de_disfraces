// Cliente HTTP compartido. Contrato: docs/CONTRATO_API.md
// Local: VITE_API_URL vacío → rutas relativas /api/... (proxy de Vite).
// Producción: VITE_API_URL = URL del backend en Render.

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'fd_staff_token';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* almacenamiento bloqueado: la sesión dura lo que dure la pestaña */
    }
  },
};

export function apiUrl(path) {
  return `${BASE}${path}`;
}

/**
 * Llama a la API.
 * @param {string} path  ej. '/api/public/config'
 * @param {object} opts  { method, body (objeto o FormData), auth, signal, headers, responseType: 'json'|'blob'|'text' }
 * @throws {ApiError}    con .status, .code, .message (en español) y .details
 */
export async function api(path, { method = 'GET', body, auth = false, signal, headers = {}, responseType = 'json' } = {}) {
  const finalHeaders = { Accept: 'application/json', ...headers };
  let payload = body;
  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (auth) {
    const token = tokenStore.get();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(apiUrl(path), { method, headers: finalHeaders, body: payload, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
  }

  if (res.status === 401 && auth) {
    tokenStore.set(null);
    window.dispatchEvent(new Event('fd:unauthorized'));
  }

  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* respuesta sin JSON */
    }
    const e = data?.error || {};
    const fallback = res.status === 429
      ? 'Demasiados intentos. Espera un momento y vuelve a intentar.'
      : 'Ocurrió un error inesperado. Intenta de nuevo.';
    throw new ApiError(res.status, e.code || `HTTP_${res.status}`, e.message || fallback, e.details);
  }

  if (res.status === 204) return null;
  if (responseType === 'blob') return res.blob();
  if (responseType === 'text') return res.text();
  return res.json();
}

/** Igual que api() pero con el token del staff. */
export function staffApi(path, opts = {}) {
  return api(path, { ...opts, auth: true });
}

/** Descarga un archivo protegido (CSV, imagen) y lo guarda con `filename`. */
export async function downloadFile(path, filename) {
  const blob = await staffApi(path, { responseType: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Pide una imagen protegida (comprobante) y devuelve un blob URL. Recuerda revocarlo. */
export async function fetchBlobUrl(path) {
  const blob = await staffApi(path, { responseType: 'blob' });
  return URL.createObjectURL(blob);
}

/** Mensaje de campo desde un ApiError de validación: fieldError(err, 'buyer.cedula') */
export function fieldError(err, field) {
  return err?.details?.fields?.[field] || null;
}
