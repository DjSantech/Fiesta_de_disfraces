import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carga datos y expone { data, error, loading, reload, setData }.
 *
 *   const { data, loading, error, reload } = useFetch(
 *     (signal) => staffApi(`/api/admin/orders?status=${status}`, { signal }),
 *     [status],
 *     { interval: 30000 },   // opcional: refresco automático silencioso
 *   );
 *
 * - Ignora respuestas viejas si cambian las dependencias o se desmonta.
 * - reload({ silent: true }) recarga sin poner loading=true (para refrescos).
 * - Si `enabled` es false no carga.
 */
export function useFetch(fetcher, deps = [], { interval, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestRef = useRef(0);
  const controllerRef = useRef(null);

  const reload = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++requestRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current(controller.signal);
      if (requestId === requestRef.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') return undefined;
      if (requestId === requestRef.current) setState((s) => ({ ...s, error, loading: false }));
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!enabled) return undefined;
    reload();
    let timer;
    if (interval) timer = setInterval(() => reload({ silent: true }), interval);
    return () => {
      if (timer) clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [reload, interval, enabled]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload, setData };
}
