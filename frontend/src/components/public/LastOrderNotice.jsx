import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { api } from '../../lib/api';
import { KEYS, local, session } from './utils/storage';

const TEXT = {
  pending_payment: 'Tienes una compra pendiente de pago',
  in_review: 'Tu pago está en revisión',
  paid: 'Tu entrada está lista',
  conflict: 'Tu compra necesita revisión del admin',
  rejected: 'Tu última compra no se pudo confirmar',
};

/** Aviso discreto si hay una compra guardada en este celular (localStorage fd_last_order). */
export default function LastOrderNotice() {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    const token = local.get(KEYS.lastOrder);
    if (!token || session.get(KEYS.noticeDismissed) === token) return undefined;
    let alive = true;
    api(`/api/public/orders/${encodeURIComponent(token)}`)
      .then((d) => alive && TEXT[d.order.status] && setOrder(d.order))
      .catch((e) => e?.status === 404 && local.remove(KEYS.lastOrder));
    return () => {
      alive = false;
    };
  }, []);
  if (!order) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="glass flex w-full max-w-md animate-fade-up items-center gap-3 rounded-2xl p-2 pl-4 shadow-2xl shadow-black/60">
        <span className="h-2 w-2 shrink-0 rounded-full bg-pumpkin shadow-[0_0_10px_rgb(255_106_0)]" aria-hidden="true" />
        <Link to={`/orden/${order.token}`} className="flex flex-1 items-center justify-between gap-2 py-2 text-sm font-semibold text-bone">
          {TEXT[order.status]}
          <span className="flex items-center gap-1 text-pumpkin-light">
            Ver <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
        <button
          type="button"
          onClick={() => {
            session.set(KEYS.noticeDismissed, order.token);
            setOrder(null);
          }}
          className="rounded-lg p-2 text-fog hover:text-bone"
          aria-label="Cerrar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
