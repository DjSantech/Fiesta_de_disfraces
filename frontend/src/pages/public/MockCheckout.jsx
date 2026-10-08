import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, FlaskConical, Lock } from 'lucide-react';
import { api } from '../../lib/api';
import { formatCOP } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import { PageSpinner } from '../../components/ui';

/** Pasarela simulada (solo modo de prueba del backend). */
export default function MockCheckout() {
  const [params] = useSearchParams();
  const token = params.get('orden');
  const navigate = useNavigate();
  const { data, error, loading } = useFetch((signal) => api(`/api/public/orders/${token}`, { signal }), [token], { enabled: !!token });
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const order = data?.order;

  async function pay(outcome) {
    setBusy(outcome);
    try {
      await api(`/api/public/orders/${token}/mock-pay`, { method: 'POST', body: { outcome } });
      navigate(`/pago/resultado?orden=${token}&status=${outcome}`, { replace: true });
    } catch (e) {
      setErr(e.message);
      setBusy(null);
    }
  }

  return (
    <div className="min-h-dvh bg-[#eef0f4] px-4 py-8 text-[#1d2330]">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-2 rounded-xl bg-[repeating-linear-gradient(45deg,#f5c04a_0_12px,#1d2330_12px_24px)] p-1">
          <p className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#f5c04a] py-2 text-xs font-bold uppercase tracking-[0.16em]">
            <FlaskConical className="h-4 w-4" /> Modo de prueba · no se cobra nada
          </p>
        </div>
        <div className="mt-5 rounded-2xl bg-white p-6 shadow-xl shadow-black/10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b7280]">Pasarela de pago simulada</p>
          {!token || error ? (
            <p className="mt-4 text-sm">No encontramos la orden a pagar.</p>
          ) : loading || !order ? (
            <PageSpinner className="min-h-40 text-[#6b7280]" />
          ) : (
            <>
              <p className="mt-3 text-sm text-[#6b7280]">Fiesta de Disfraces · DJ Santech</p>
              <p className="mt-1 font-semibold">{order.kind === 'room' ? order.room?.name : 'Entrada'} · {order.buyer.name}</p>
              <p className="mt-4 text-4xl font-bold tabular-nums">{formatCOP(order.amount)}</p>
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#e5e7eb] p-3 text-sm text-[#6b7280]">
                <CreditCard className="h-5 w-5" /> Tarjeta de prueba •••• 4242
              </div>
              <div className="mt-6 grid gap-2">
                <button type="button" disabled={!!busy} onClick={() => pay('approved')} className="h-12 rounded-xl bg-[#0f9f5a] font-semibold text-white disabled:opacity-60">
                  {busy === 'approved' ? 'Procesando…' : 'Aprobar pago'}
                </button>
                <button type="button" disabled={!!busy} onClick={() => pay('rejected')} className="h-12 rounded-xl border border-[#d1293d] font-semibold text-[#d1293d] disabled:opacity-60">
                  {busy === 'rejected' ? 'Procesando…' : 'Rechazar pago'}
                </button>
              </div>
              {err && <p className="mt-3 text-sm text-[#d1293d]">{err}</p>}
            </>
          )}
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#9ca3af]">
            <Lock className="h-3.5 w-3.5" /> Simulación local: nada sale de tu equipo
          </p>
        </div>
      </div>
    </div>
  );
}
