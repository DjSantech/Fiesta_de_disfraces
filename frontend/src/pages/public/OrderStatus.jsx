import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CreditCard, Hourglass, RefreshCw, SearchX, Smartphone, XCircle } from 'lucide-react';
import { Button, PageSpinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatCOP, whatsappLink } from '../../lib/format';
import { ORDER_STATUS_LABEL } from '../../lib/labels';
import { CELEBRATION } from '../../config/event';
import { useFetch } from '../../lib/useFetch';
import PublicLayout, { PageAtmosphere, PageContainer } from '../../components/public/PublicLayout';
import Celebration from '../../components/public/Celebration';
import { TransferPanel } from '../../components/public/payment';
import { ShareTicketLink, TicketCard } from '../../components/public/tickets';
import { Notice, StateScreen } from '../../components/public/ui';
import { usePublicConfig } from '../../components/public/usePublicConfig';
import { describeError } from '../../components/public/utils/errors';
import { hasCelebrated, markCelebrated } from '../../components/public/utils/storage';
import { WhatsAppIcon } from '../../components/public/icons';

function ContactButton({ config, text }) {
  return (
    <a
      href={whatsappLink(config.contact.whatsapp, text)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] text-sm font-semibold text-bone hover:bg-white/[0.08]"
    >
      <WhatsAppIcon className="h-5 w-5 text-toxic" /> Escribirle a {config.contact.adminName || 'DJ Santech'}
    </a>
  );
}

export default function OrderStatus() {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const { config } = usePublicConfig();
  const { data, error, loading, reload, setData } = useFetch((signal) => api(`/api/public/orders/${token}`, { signal }), [token]);
  const order = data?.order;
  const [celebrate, setCelebrate] = useState(false);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    document.title = 'Tu compra · Fiesta de Disfraces';
  }, []);

  // Sondeo mientras se verifica
  const polling = order && (order.status === 'in_review' || (order.status === 'pending_payment' && ['pending', 'in_process'].includes(order.mpStatus)));
  useEffect(() => {
    if (!polling) return undefined;
    const id = setInterval(() => reload({ silent: true }), 20000);
    return () => clearInterval(id);
  }, [polling, reload]);

  useEffect(() => {
    if (order?.status !== 'paid') return;
    if (params.get('celebrar') === '1' || !hasCelebrated(order.token)) {
      setCelebrate(true);
      markCelebrated(order.token);
      if (params.get('celebrar')) setParams({}, { replace: true });
    }
  }, [order?.status, order?.token, params, setParams]);

  async function pay(method) {
    setBusy(method);
    setActionError(null);
    try {
      const d = await api(`/api/public/orders/${token}/pay`, { method: 'POST', body: { paymentMethod: method } });
      if (method === 'mercadopago' && d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
        return;
      }
      setData({ order: d.order });
    } catch (e) {
      setActionError(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  let content;
  if (loading && !order) content = <PageSpinner label="Buscando tu compra…" />;
  else if (error && !order) {
    const d = describeError(error);
    content = (
      <StateScreen icon={SearchX} title={d.title} actions={<><Button onClick={() => reload()} variant="secondary"><RefreshCw className="h-4 w-4" />Reintentar</Button><Button as={Link} to="/recuperar">Recuperar mi entrada</Button></>}>
        {d.message}
      </StateScreen>
    );
  } else if (order) {
    const err = actionError && <Notice title={actionError.title} className="mt-4">{actionError.message}</Notice>;
    switch (order.status) {
      case 'paid':
        content = (
          <div className="flex flex-col gap-6">
            <Celebration play={celebrate} />
            <p className="text-center text-[15px] leading-relaxed text-fog">{CELEBRATION.note}</p>
            {order.tickets.length > 1 && (
              <p className="text-center text-sm text-fog">
                {order.tickets.length} entradas de la {order.room?.name}. Comparte cada una con su dueño.
              </p>
            )}
            {order.tickets.map((t, i) => (
              <div key={t.token} className="animate-fade-up" style={{ animationDelay: `${celebrate ? 900 + i * 120 : 0}ms` }}>
                <TicketCard ticket={t} startsAt={config.event.startsAt} compact={order.tickets.length > 1}>
                  {order.tickets.length > 1 ? (
                    <ShareTicketLink ticket={t} />
                  ) : (
                    <Button as={Link} to={`/entrada/${t.token}`} variant="secondary" block>
                      Abrir mi entrada · descargar
                    </Button>
                  )}
                </TicketCard>
              </div>
            ))}
          </div>
        );
        break;
      case 'in_review':
        content = (
          <div className="flex flex-col gap-8">
            <StateScreen
              tone="ultra"
              iconSlot={
                <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-ultra/40 bg-ultra/10 text-violet-300" style={{ '--scan-distance': '60px' }}>
                  <Hourglass className="h-7 w-7" strokeWidth={1.6} />
                  <span className="fd-scanline absolute inset-x-0 top-0 h-0.5 bg-violet-300/80 shadow-[0_0_10px_rgb(139_92_246)]" />
                </span>
              }
              overline="En revisión"
              title="Estamos verificando tu pago"
            >
              Recibimos tu comprobante{order.transferReference ? ` (ref. ${order.transferReference})` : ''} por {formatCOP(order.amount)}. Lo confirmamos a mano en pocas horas; esta página se actualiza sola.
            </StateScreen>
            <details className="rounded-2xl border border-white/10 bg-crypt/60 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-bone">¿Subiste el pantallazo equivocado? Reemplázalo</summary>
              <div className="mt-4">
                <TransferPanel order={order} config={config} onUploaded={(o) => setData({ order: o })} />
              </div>
            </details>
          </div>
        );
        break;
      case 'pending_payment':
        content =
          order.paymentMethod === 'transferencia' ? (
            <div>
              <h1 className="font-display text-[length:clamp(2.4rem,11vw,3.6rem)] uppercase leading-[0.9] text-bone">Termina tu pago</h1>
              <p className="mb-6 mt-3 text-sm text-fog">Transfiere y sube el pantallazo para que confirmemos tu entrada.</p>
              <TransferPanel order={order} config={config} onUploaded={(o) => setData({ order: o })} />
            </div>
          ) : (
            <StateScreen
              icon={CreditCard}
              tone="gold"
              overline="Pendiente de pago"
              title={order.mpStatus === 'rejected' ? 'Tu pago fue rechazado' : 'Completa tu pago'}
              actions={
                <>
                  <Button size="lg" loading={busy === 'mercadopago'} onClick={() => pay('mercadopago')}>Completar pago · {formatCOP(order.amount)}</Button>
                  <Button variant="secondary" loading={busy === 'transferencia'} onClick={() => pay('transferencia')}><Smartphone className="h-4 w-4" />Cambiar a transferencia</Button>
                  {err}
                </>
              }
            >
              {['pending', 'in_process'].includes(order.mpStatus) ? 'Mercado Pago está procesando tu pago. Te avisamos aquí apenas se confirme.' : 'Tu compra está apartada pero aún no se ha pagado.'}
            </StateScreen>
          );
        break;
      case 'conflict':
        content = (
          <StateScreen icon={AlertTriangle} tone="ember" overline="Pago recibido" title="El admin te contactará" actions={<ContactButton config={config} text="Hola, mi compra de la Fiesta de Disfraces quedó en conflicto." />}>
            Tu pago llegó, pero la habitación quedó cruzada con otra compra. {config.contact.adminName || 'DJ Santech'} lo resuelve contigo directamente.
          </StateScreen>
        );
        break;
      default: {
        const canRetry = order.status === 'expired' && order.kind === 'ticket';
        content = (
          <StateScreen
            icon={XCircle}
            overline={ORDER_STATUS_LABEL[order.status]}
            title={order.status === 'rejected' ? 'No pudimos confirmar tu pago' : order.status === 'expired' ? 'Tu compra expiró' : 'Compra cancelada'}
            actions={
              <>
                {canRetry ? (
                  <Button size="lg" loading={!!busy} onClick={() => pay(config.mercadoPago?.enabled ? 'mercadopago' : 'transferencia')}>Retomar el pago</Button>
                ) : (
                  <Button as={Link} to="/comprar" size="lg">Comprar de nuevo</Button>
                )}
                <ContactButton config={config} text="Hola, tengo una pregunta sobre mi compra de la Fiesta de Disfraces." />
                {err}
              </>
            }
          >
            {order.rejectReason ? `Motivo: ${order.rejectReason}` : 'Si crees que es un error, escríbele al admin.'}
          </StateScreen>
        );
      }
    }
  }

  return (
    <PublicLayout>
      <PageAtmosphere />
      <PageContainer>{content}</PageContainer>
    </PublicLayout>
  );
}
