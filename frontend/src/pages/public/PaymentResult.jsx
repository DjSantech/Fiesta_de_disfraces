import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock3, CreditCard, RefreshCw, Smartphone, XCircle } from 'lucide-react';
import { Button, PageSpinner } from '../../components/ui';
import { api } from '../../lib/api';
import PublicLayout, { PageAtmosphere, PageContainer } from '../../components/public/PublicLayout';
import { Notice, StateScreen } from '../../components/public/ui';
import { describeError } from '../../components/public/utils/errors';
import { KEYS, local } from '../../components/public/utils/storage';

const MAX_TRIES = 12; // ~1 min cada 5 s

export default function PaymentResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('orden') || local.get(KEYS.lastOrder);
  const paymentId = params.get('payment_id') || params.get('collection_id');
  const urlStatus = params.get('status') || params.get('collection_status');
  const [view, setView] = useState('verifying');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const tries = useRef(0);

  useEffect(() => {
    if (!token) {
      setView('missing');
      return undefined;
    }
    let alive = true;
    let timer;
    const verify = async () => {
      try {
        const body = paymentId && paymentId !== 'null' ? { paymentId } : {};
        const { order: o } = await api(`/api/public/orders/${token}/verify-mp`, { method: 'POST', body });
        if (!alive) return;
        setOrder(o);
        if (o.status === 'paid') return navigate(`/orden/${token}?celebrar=1`, { replace: true });
        if (o.status !== 'pending_payment') return navigate(`/orden/${token}`, { replace: true });
        const pending = ['pending', 'in_process'].includes(o.mpStatus) || ['pending', 'in_process'].includes(urlStatus);
        if (pending && tries.current < MAX_TRIES) {
          tries.current += 1;
          setView('pending');
          timer = setTimeout(verify, 5000);
        } else setView(pending ? 'later' : 'rejected');
      } catch (e) {
        if (alive) {
          setError(describeError(e));
          setView('error');
        }
      }
    };
    verify();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [token, paymentId, urlStatus, navigate]);

  async function pay(method) {
    setBusy(method);
    try {
      const d = await api(`/api/public/orders/${token}/pay`, { method: 'POST', body: { paymentMethod: method } });
      if (method === 'mercadopago' && d.checkoutUrl) window.location.href = d.checkoutUrl;
      else navigate(`/orden/${token}`);
    } catch (e) {
      setError(describeError(e));
      setBusy(null);
    }
  }

  let content;
  if (view === 'verifying') content = <PageSpinner label="Confirmando tu pago…" />;
  else if (view === 'pending')
    content = (
      <StateScreen icon={Clock3} tone="gold" overline="En proceso" title="Tu pago se está procesando">
        Con PSE o efectivo puede tardar un poco. Lo seguimos verificando cada pocos segundos; no cierres esta página.
      </StateScreen>
    );
  else if (view === 'later')
    content = (
      <StateScreen icon={Clock3} tone="gold" overline="En proceso" title="Te avisaremos" actions={<Button as={Link} to={`/orden/${token}`} size="lg">Ver mi compra</Button>}>
        Mercado Pago aún no confirma tu pago. Revisa el estado en el enlace de tu compra en unos minutos.
      </StateScreen>
    );
  else if (view === 'rejected')
    content = (
      <StateScreen
        icon={XCircle}
        overline="Pago no completado"
        title="Tu pago no se aprobó"
        actions={
          <>
            <Button size="lg" loading={busy === 'mercadopago'} onClick={() => pay('mercadopago')}><CreditCard className="h-4 w-4" />Reintentar con Mercado Pago</Button>
            <Button variant="secondary" loading={busy === 'transferencia'} onClick={() => pay('transferencia')}><Smartphone className="h-4 w-4" />Pagar por transferencia</Button>
            {error && <Notice title={error.title}>{error.message}</Notice>}
          </>
        }
      >
        No se te cobró nada. Puedes intentarlo otra vez o pagar por Bre-B / Nequi.
      </StateScreen>
    );
  else if (view === 'missing')
    content = (
      <StateScreen icon={XCircle} title="No encontramos tu compra" actions={<Button as={Link} to="/recuperar">Recuperar mi entrada</Button>}>
        Este enlace no trae la información de la compra.
      </StateScreen>
    );
  else
    content = (
      <StateScreen icon={XCircle} title={error?.title} actions={<><Button onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" />Reintentar</Button>{token && <Button as={Link} to={`/orden/${token}`} variant="secondary">Ver mi compra</Button>}</>}>
        {error?.message}
      </StateScreen>
    );

  return (
    <PublicLayout hideHeaderCta>
      <PageAtmosphere />
      <PageContainer>{content}{order && view === 'pending' && null}</PageContainer>
    </PublicLayout>
  );
}
