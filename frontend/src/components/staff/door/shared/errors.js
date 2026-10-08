// Clasificación de errores de la API para Operaciones.

/** Falla de red / servidor caído (no un error de negocio del backend). */
export function isConnectionError(err) {
  if (!err) return false;
  if (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT' || err.status === 0) return true;
  if ([502, 503, 504].includes(err.status)) return true;
  // 5xx sin cuerpo JSON (proxy o gateway): el backend real siempre responde { error: { code } }.
  return /^HTTP_5\d\d$/.test(err.code || '');
}

export const CONNECTION_MESSAGE = 'Sin conexión con el servidor. Revisa el internet e intenta de nuevo.';

/** Mensaje listo para un toast. */
export function errorMessage(err) {
  if (isConnectionError(err)) return CONNECTION_MESSAGE;
  return err?.message || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

/** Error de tiempo agotado con la misma forma que ApiError. */
export function timeoutError() {
  const e = new Error('El servidor tardó demasiado en responder.');
  e.code = 'TIMEOUT';
  e.status = 0;
  return e;
}

/**
 * Ejecuta `fn(signal)` con límite de tiempo. Si se agota lanza timeoutError().
 * `outerSignal` (opcional) permite cancelar desde afuera.
 */
export async function withTimeout(fn, ms = 9000, outerSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  const onOuterAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', onOuterAbort);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (timedOut && err?.name === 'AbortError') throw timeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', onOuterAbort);
  }
}
