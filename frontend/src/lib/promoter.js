// Sesión de promotores: token propio (fd_promoter_token), separado del staff. Contrato: docs/CONTRATO_API.md §Promotores.
import { api } from './api';

const KEY = 'fd_promoter_token';

export const promoterToken = {
  get() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      if (token) localStorage.setItem(KEY, token);
      else localStorage.removeItem(KEY);
    } catch {
      /* almacenamiento bloqueado */
    }
  },
};

/** Igual que api() pero con el token del promotor. Si la sesión ya no vale, la borra. */
export async function promoterApi(path, opts = {}) {
  const token = promoterToken.get();
  try {
    return await api(path, { ...opts, headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  } catch (err) {
    if (err?.status === 401) promoterToken.set(null);
    throw err;
  }
}

/** Link para compartir: https://<origen>/?ref=CODIGO */
export const promoterLink = (code) => `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
