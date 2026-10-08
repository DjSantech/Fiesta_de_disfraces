import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, ImageOff, Maximize2, X } from 'lucide-react';
import { Button, Spinner } from '../../ui';
import { fetchBlobUrl } from '../../../lib/api';
import { useEscapeCapture } from './hooks';

/**
 * Comprobante de transferencia protegido: lo pide con el token, lo muestra como blob URL
 * (ampliable a pantalla completa) y revoca el blob URL al desmontarse.
 */
export default function ReceiptImage({ orderId, version }) {
  const [state, setState] = useState({ url: null, error: null, loading: true });
  const [zoom, setZoom] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    let url = null;
    setState({ url: null, error: null, loading: true });
    fetchBlobUrl(`/api/admin/orders/${orderId}/receipt`)
      .then((u) => {
        url = u;
        if (alive) setState({ url: u, error: null, loading: false });
        else URL.revokeObjectURL(u);
      })
      .catch((error) => {
        if (alive) setState({ url: null, error, loading: false });
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [orderId, version, attempt]);

  useEscapeCapture(zoom, () => setZoom(false));

  if (state.loading) {
    return (
      <div className="flex aspect-[3/4] max-h-[420px] w-full items-center justify-center rounded-2xl border border-white/[0.08] bg-tomb/60">
        <Spinner className="h-6 w-6 text-fog" label="Cargando comprobante" />
      </div>
    );
  }

  if (state.error || !state.url) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center">
        <ImageOff className="h-6 w-6 text-smoke" strokeWidth={1.5} />
        <p className="text-sm text-fog">{state.error?.message || 'No se pudo cargar el comprobante.'}</p>
        <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40"
        aria-label="Ampliar comprobante"
      >
        <img src={state.url} alt="Comprobante de transferencia" className="mx-auto max-h-[460px] w-full object-contain" />
        <span className="absolute bottom-3 right-3 flex h-10 items-center gap-1.5 rounded-xl bg-ink/85 px-3 text-xs font-semibold text-bone ring-1 ring-white/15 backdrop-blur transition group-hover:bg-ink">
          <Maximize2 className="h-3.5 w-3.5" />
          Ampliar
        </span>
      </button>

      {zoom &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Comprobante ampliado">
            <div className="flex items-center justify-end gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <Button as="a" href={state.url} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" className="h-11">
                <ExternalLink className="h-4 w-4" />
                Abrir aparte
              </Button>
              <Button variant="secondary" size="icon" className="h-11 w-11" onClick={() => setZoom(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <button type="button" className="flex min-h-0 flex-1 items-center justify-center p-3 pt-0" onClick={() => setZoom(false)} aria-label="Cerrar">
              <img src={state.url} alt="Comprobante de transferencia ampliado" className="max-h-full max-w-full object-contain" />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
