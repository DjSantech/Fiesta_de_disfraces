import { useEffect, useSyncExternalStore } from 'react';
import { api } from '../../lib/api';
import { FALLBACK_CONFIG } from '../../config/event';
import { computePhase } from './utils/dates';
import { KEYS, session } from './utils/storage';

// Configuración pública compartida por todas las páginas públicas.
// - Arranca con FALLBACK_CONFIG (o la última respuesta guardada en la sesión) para pintar todo de una vez.
// - Pide GET /api/public/config con reintentos: el backend en Render puede tardar en despertar.
// - `source`: 'fallback' (valores oficiales por defecto) | 'cache' (respuesta anterior) | 'live' (recién llegada).

const CACHE_MAX_AGE = 30 * 60 * 1000;
const RETRY_DELAYS = [0, 2500, 5000, 9000, 15000, 25000];

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, extra) {
  if (!isObject(base) || !isObject(extra)) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    out[k] = isObject(v) && isObject(base[k]) ? deepMerge(base[k], v) : v === undefined ? base[k] : v;
  }
  return out;
}

function fallbackConfig() {
  const phase = computePhase(FALLBACK_CONFIG.event.presaleEndsAt);
  return {
    ...FALLBACK_CONFIG,
    event: { ...FALLBACK_CONFIG.event, phase },
    prices: {
      ...FALLBACK_CONFIG.prices,
      current: phase === 'preventa' ? { ...FALLBACK_CONFIG.prices.preventa } : { ...FALLBACK_CONFIG.prices.puerta },
    },
  };
}

function normalize(data) {
  const merged = deepMerge(fallbackConfig(), data || {});
  if (!Array.isArray(merged.rooms)) merged.rooms = FALLBACK_CONFIG.rooms;
  if (!Array.isArray(merged.paymentAccounts)) merged.paymentAccounts = FALLBACK_CONFIG.paymentAccounts;
  merged.rooms = [...merged.rooms].sort((a, b) => a.number - b.number);
  return merged;
}

function initialSnapshot() {
  const cached = session.getJSON(KEYS.configCache, null);
  if (cached && cached.savedAt && Date.now() - cached.savedAt < CACHE_MAX_AGE && cached.data) {
    return { config: normalize(cached.data), source: 'cache', loading: true, error: null, updatedAt: cached.savedAt };
  }
  return { config: fallbackConfig(), source: 'fallback', loading: true, error: null, updatedAt: null };
}

let snapshot = null;
const listeners = new Set();
let inflight = null;
let lastLive = 0;

function getSnapshot() {
  if (!snapshot) snapshot = initialSnapshot();
  return snapshot;
}

function setSnapshot(patch) {
  snapshot = { ...getSnapshot(), ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry() {
  let lastError;
  for (const delay of RETRY_DELAYS) {
    if (delay) await wait(delay);
    try {
      return await api('/api/public/config');
    } catch (err) {
      lastError = err;
      // Errores 4xx (salvo 429) no se arreglan reintentando.
      if (err?.status >= 400 && err.status < 500 && err.status !== 429) break;
    }
  }
  throw lastError;
}

/** Pide la configuración (deduplica llamadas simultáneas). */
export function loadPublicConfig({ force = false } = {}) {
  if (inflight) return inflight;
  if (!force && getSnapshot().source === 'live' && Date.now() - lastLive < 20000) return Promise.resolve(getSnapshot().config);
  setSnapshot({ loading: true });
  inflight = fetchWithRetry()
    .then((data) => {
      lastLive = Date.now();
      session.setJSON(KEYS.configCache, { savedAt: lastLive, data });
      setSnapshot({ config: normalize(data), source: 'live', loading: false, error: null, updatedAt: lastLive });
      return getSnapshot().config;
    })
    .catch((error) => {
      setSnapshot({ loading: false, error });
      return getSnapshot().config;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * const { config, source, loading, error, refresh } = usePublicConfig({ refreshInterval: 60000 })
 * `refreshInterval`: refresco silencioso mientras la pestaña está visible (disponibilidad en vivo).
 */
export function usePublicConfig({ refreshInterval } = {}) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    loadPublicConfig();
  }, []);

  useEffect(() => {
    if (!refreshInterval) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') loadPublicConfig({ force: true });
    };
    const id = setInterval(tick, refreshInterval);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLive > 15000) loadPublicConfig({ force: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshInterval]);

  return { ...snap, live: snap.source === 'live', refresh: () => loadPublicConfig({ force: true }) };
}

/** Estado comercial para CTAs: 'preventa' | 'general' | 'soldout' | 'closed' */
export function salesState(config) {
  const ev = config?.event || {};
  if (ev.salesOpen === false) return 'closed';
  if (ev.soldOut) return 'soldout';
  return ev.phase === 'general' ? 'general' : 'preventa';
}

export function roomsAvailable(config) {
  return (config?.rooms || []).some((r) => r.status === 'available');
}
