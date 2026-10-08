import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/** Devuelve `value` cuando deja de cambiar por `delay` ms (para búsquedas). */
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Filtros guardados en la URL (?estado=…&q=…&pagina=2), así se pueden compartir y sobreviven a recargar.
 * update({ estado: 'paid' }) — vacío/null borra el parámetro; cambiar cualquier filtro vuelve a la página 1.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams();
  const update = useCallback(
    (changes) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === '' || value === null || value === undefined) next.delete(key);
            else next.set(key, String(value));
          }
          if (!('pagina' in changes)) next.delete('pagina');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [params, update];
}

/** Caja de búsqueda que escribe en la URL cuando dejas de teclear. Devuelve [texto, setTexto]. */
export function useSearchBox(committed, onCommit, delay = 350) {
  const [value, setValue] = useState(committed);
  const debounced = useDebouncedValue(value, delay);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  useEffect(() => {
    const v = debounced.trim();
    if (v !== committed) commitRef.current(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return [value, setValue];
}

/** Re-renderiza cada `ms` y devuelve la hora actual (tiempos relativos, cuentas regresivas). */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * Escape lo atiende solo el diálogo de encima: lo intercepta en fase de captura para que
 * no cierre también el Modal que está debajo (el Modal compartido escucha en document).
 */
export function useEscapeCapture(active, onEscape) {
  const ref = useRef(onEscape);
  ref.current = onEscape;
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      ref.current?.();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [active]);
}

/**
 * Aviso de cambios sin guardar: al cerrar/recargar la pestaña (nativo) y al tocar un enlace
 * interno (devuelve `pendingPath` para mostrar una confirmación propia).
 */
export function useUnsavedChangesGuard(dirty) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingPath, setPendingPath] = useState(null);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    // Captura en document: corre antes que el onClick de los <Link> de React Router.
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const path = url.pathname + url.search + url.hash;
      if (url.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingPath(path);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, location.pathname]);

  const confirmLeave = useCallback(() => {
    const path = pendingPath;
    setPendingPath(null);
    if (path) navigate(path);
  }, [navigate, pendingPath]);

  const cancelLeave = useCallback(() => setPendingPath(null), []);

  return { pendingPath, confirmLeave, cancelLeave };
}
