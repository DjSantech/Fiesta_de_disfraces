// Hooks de Operaciones (Portería + Barra). Dueño: Agente Operaciones.
import { useCallback, useEffect, useRef, useState } from 'react';

/** Devuelve `value` con retardo: útil para buscar mientras se escribe. */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Estado de la red del navegador (eventos online/offline). */
export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/**
 * Mantiene la pantalla encendida mientras `enabled` (Screen Wake Lock API).
 * El navegador suelta el bloqueo al ocultar la pestaña: se vuelve a pedir al regresar.
 */
export function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;
    let sentinel = null;
    let pending = false;
    let cancelled = false;

    const request = async () => {
      if (cancelled || pending || sentinel || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) {
          s.release().catch(() => {});
        } else {
          sentinel = s;
          s.addEventListener?.('release', () => {
            if (sentinel === s) sentinel = null;
          });
        }
      } catch {
        /* sin permiso, batería baja o no soportado: se sigue sin bloqueo */
      } finally {
        pending = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) sentinel.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}

/**
 * Alto del encabezado fijo del staff (StaffLayout) para pegar sub-encabezados justo debajo.
 * Si el encabezado deja de ser sticky/fixed, devuelve 0.
 */
export function useStickyTop() {
  const [top, setTop] = useState(0);
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return undefined;
    const update = () => {
      const { position } = window.getComputedStyle(header);
      setTop(position === 'sticky' || position === 'fixed' ? Math.round(header.getBoundingClientRect().height) : 0);
    };
    update();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(header);
    }
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  return top;
}

/** Evita dobles envíos: `run(fn)` ignora llamadas mientras otra sigue en curso. */
export function useSingleFlight() {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn) => {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, run];
}

/**
 * Lista paginada con "cargar más" (respuestas { items, total, page, limit } del contrato).
 *   const list = usePagedList((page, limit, signal) => staffApi(`/api/...?page=${page}&limit=${limit}`, { signal }), [q]);
 * Se reinicia a la página 1 cuando cambian `deps`.
 */
export function usePagedList(fetchPage, deps = [], { limit = 30, enabled = true } = {}) {
  const [state, setState] = useState({ items: [], total: 0, page: 0, loading: enabled, loadingMore: false, error: null, loadedAt: null });
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const requestRef = useRef(0);
  const controllerRef = useRef(null);
  const pageRef = useRef(0);

  const load = useCallback(
    async (page, { append = false, silent = false } = {}) => {
      const requestId = ++requestRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState((s) => ({
        ...s,
        loading: append || silent ? s.loading : true,
        loadingMore: append,
        error: silent ? s.error : null,
      }));
      try {
        const data = await fetchRef.current(page, limit, controller.signal);
        if (requestId !== requestRef.current) return;
        pageRef.current = page;
        setState((s) => {
          const incoming = data?.items || [];
          let items = incoming;
          if (append) {
            const seen = new Set(s.items.map((i) => i.id));
            items = [...s.items, ...incoming.filter((i) => !seen.has(i.id))];
          }
          return { items, total: data?.total ?? items.length, page, loading: false, loadingMore: false, error: null, loadedAt: Date.now() };
        });
      } catch (error) {
        if (error?.name === 'AbortError' || requestId !== requestRef.current) return;
        setState((s) => ({ ...s, loading: false, loadingMore: false, error }));
      }
    },
    [limit],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    load(1);
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, load, ...deps]);

  const reload = useCallback((opts) => load(1, opts), [load]);
  const loadMore = useCallback(() => load(pageRef.current + 1, { append: true }), [load]);
  const updateItem = useCallback((item) => {
    if (!item?.id) return;
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === item.id ? item : i)) }));
  }, []);

  return { ...state, hasMore: state.items.length < state.total, reload, loadMore, updateItem };
}

/** Bloquea el scroll del body mientras el componente está montado (pantallas completas). */
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}
