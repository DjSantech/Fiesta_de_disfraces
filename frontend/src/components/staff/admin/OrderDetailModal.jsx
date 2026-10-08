import { useState } from 'react';
import clsx from 'clsx';
import {
  Ban,
  Check,
  CircleCheck,
  CircleX,
  Clock,
  CreditCard,
  History,
  Hourglass,
  Image as ImageIcon,
  Receipt,
  Ticket,
  TriangleAlert,
  User,
  Users,
  X,
} from 'lucide-react';
import { Badge, Button, Modal, PageSpinner, useToast } from '../../ui';
import { staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatCOP, formatDateTime, formatTime } from '../../../lib/format';
import {
  GENDER_LABEL,
  MANUAL_METHOD_LABEL,
  ORDER_PAYMENT_METHOD_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PHASE_LABEL,
  TICKET_KIND_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
} from '../../../lib/labels';
import ConfirmDialog from './ConfirmDialog';
import CopyButton from './CopyButton';
import ErrorState from './ErrorState';
import ReceiptImage from './ReceiptImage';
import { DetailGrid, DetailItem, DetailSection } from './Detail';
import { InstagramLink, PhoneLink, WhatsAppButton } from './Contact';
import { orderUrl, orderWhatsappText, plural, ticketUrl } from './utils';

const MP_STATUS_LABEL = {
  approved: 'Aprobado',
  rejected: 'Rechazado',
  in_process: 'En proceso',
  pending: 'Pendiente',
  cancelled: 'Cancelado',
};

const REJECT_SUGGESTIONS = [
  'El comprobante no es válido',
  'El valor no coincide',
  'No nos llegó la transferencia',
  'Comprobante repetido',
];

const BANNER_TONE = {
  violet: 'border-ultra/30 bg-ultra/10 [&_svg]:text-violet-300',
  amber: 'border-gold/25 bg-gold/[0.07] [&_svg]:text-gold',
  green: 'border-toxic/25 bg-toxic/[0.07] [&_svg]:text-toxic',
  red: 'border-danger/30 bg-danger/10 [&_svg]:text-danger-light',
  orange: 'border-ember/30 bg-ember/10 [&_svg]:text-ember',
  neutral: 'border-white/10 bg-white/[0.04] [&_svg]:text-fog',
};

/** "Entrada · Mujer" / "Habitación 3" */
export function orderKindText(order) {
  if (!order) return '';
  if (order.kind === 'room') return order.room?.name || 'Habitación';
  return ['Entrada', GENDER_LABEL[order.gender]].filter(Boolean).join(' · ');
}

function banner(order) {
  switch (order.status) {
    case 'in_review':
      return {
        tone: 'violet',
        icon: Receipt,
        title: 'Transferencia por revisar',
        text: `Verifica que el comprobante sea por ${formatCOP(order.amount)} y que el dinero sí llegó a tu cuenta. Si todo cuadra, aprueba el pago.`,
      };
    case 'pending_payment': {
      const base =
        order.paymentMethod === 'mercadopago'
          ? 'Esperando el pago en Mercado Pago.'
          : order.paymentMethod === 'transferencia'
            ? 'Aún no ha subido el comprobante de la transferencia.'
            : 'Esperando el pago.';
      const hold = order.holdExpiresAt ? ` La habitación está apartada hasta las ${formatTime(order.holdExpiresAt)}.` : '';
      return { tone: 'amber', icon: Hourglass, title: 'Pendiente de pago', text: base + hold };
    }
    case 'paid':
      return {
        tone: 'green',
        icon: CircleCheck,
        title: order.paidAt ? `Pagada · ${formatDateTime(order.paidAt)}` : 'Pagada',
        text: order.reviewedBy
          ? `Aprobada por ${order.reviewedBy.name}.`
          : order.paymentMethod === 'mercadopago'
            ? 'Confirmada automáticamente por Mercado Pago.'
            : null,
      };
    case 'rejected':
      return { tone: 'red', icon: CircleX, title: 'Rechazada', text: order.rejectReason ? `Motivo: ${order.rejectReason}` : null };
    case 'expired':
      return {
        tone: 'neutral',
        icon: Clock,
        title: 'Expirada',
        text: 'Se venció el tiempo para pagar. Si el pago de Mercado Pago llega después, igual se honra.',
      };
    case 'cancelled':
      return {
        tone: 'neutral',
        icon: Ban,
        title: 'Cancelada',
        text: 'Normalmente porque la persona hizo una compra nueva con la misma cédula.',
      };
    case 'conflict':
      return {
        tone: 'orange',
        icon: TriangleAlert,
        title: 'Conflicto',
        text: 'El pago llegó cuando la habitación ya era de otra persona. Coordina con el comprador: apruébala solo si le consigues cupo; si no, devuélvele el dinero por fuera.',
      };
    default:
      return null;
  }
}

function StatusBanner({ order }) {
  const b = banner(order);
  if (!b) return null;
  const Icon = b.icon;
  return (
    <div className={clsx('flex items-start gap-3 rounded-2xl border p-3.5', BANNER_TONE[b.tone])}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-bone">{b.title}</p>
        {b.text && <p className="mt-0.5 text-sm leading-relaxed text-fog">{b.text}</p>}
      </div>
    </div>
  );
}

function Line({ label, value, className }) {
  return (
    <div className={clsx('flex items-baseline justify-between gap-4', className)}>
      <dt className="min-w-0 text-fog">{label}</dt>
      <dd className="shrink-0 font-medium tabular-nums text-bone">{value}</dd>
    </div>
  );
}

function AmountSummary({ order }) {
  const b = order.breakdown || {};
  const isRoom = order.kind === 'room';
  const baseLabel = isRoom
    ? `${order.room?.name || 'Habitación'}${order.room?.capacity ? ` · ${order.room.capacity} personas` : ''}`
    : ['Entrada', b.phase && PHASE_LABEL[b.phase]?.toLowerCase(), GENDER_LABEL[order.gender]].filter(Boolean).join(' · ');
  const courtesy = order.manualMethod === 'cortesia';
  const differs = typeof b.total === 'number' && b.total !== order.amount;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-tomb/50 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-smoke">{order.status === 'paid' ? 'Pagó' : 'Valor a pagar'}</p>
          <p className="mt-0.5 text-3xl font-bold leading-none tabular-nums text-bone">{formatCOP(order.amount)}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {b.phase && !isRoom && <Badge>{PHASE_LABEL[b.phase]}</Badge>}
          {b.isGuest && <Badge tone="orange">Invitado −{b.discountPercent}%</Badge>}
          {courtesy && <Badge tone="violet">Cortesía</Badge>}
        </div>
      </div>
      {(b.base !== undefined || differs) && (
        <dl className="mt-3 flex flex-col gap-1.5 border-t border-white/[0.06] pt-3 text-sm">
          {b.base !== undefined && <Line label={baseLabel} value={formatCOP(b.base)} />}
          {b.discount > 0 && (
            <Line
              label={`Descuento lista de invitados (${b.discountPercent}%)${order.guest?.name ? ` · ${order.guest.name}` : ''}`}
              value={`−${formatCOP(b.discount)}`}
            />
          )}
          {differs && <Line label={courtesy ? 'Cortesía (sin cobro)' : 'Valor registrado a mano'} value={formatCOP(order.amount)} />}
        </dl>
      )}
    </div>
  );
}

/**
 * Detalle completo de una compra con aprobar / rechazar / enviar por WhatsApp.
 * Móntalo solo cuando esté abierto: {id && <OrderDetailModal orderId={id} … />}
 */
export default function OrderDetailModal({ orderId, initialOrder = null, onClose, onChanged }) {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useFetch(
    (signal) => staffApi(`/api/admin/orders/${orderId}`, { signal }),
    [orderId],
  );
  const [confirm, setConfirm] = useState(null); // 'approve' | 'reject' | null
  const order = data?.order || (initialOrder?.id === orderId ? initialOrder : null);

  const handleActionError = (err) => {
    toast.error(err.message);
    if (err.code === 'INVALID_STATE' || err.code === 'NOT_FOUND') {
      setConfirm(null);
      reload({ silent: true });
      onChanged?.(null);
    }
    throw err;
  };

  const approve = async (notes) => {
    try {
      const res = await staffApi(`/api/admin/orders/${order.id}/approve`, { method: 'POST', body: notes ? { notes } : {} });
      setData({ order: res.order });
      setConfirm(null);
      const n = res.order.tickets?.length || 0;
      toast.success(n ? `Pago aprobado: ${plural(n, 'entrada generada', 'entradas generadas')}.` : 'Pago aprobado.');
      onChanged?.(res.order);
    } catch (err) {
      handleActionError(err);
    }
  };

  const reject = async (reason) => {
    try {
      const res = await staffApi(`/api/admin/orders/${order.id}/reject`, { method: 'POST', body: { reason } });
      setData({ order: res.order });
      setConfirm(null);
      toast.success('Compra rechazada.');
      onChanged?.(res.order);
    } catch (err) {
      handleActionError(err);
    }
  };

  const status = order?.status;
  const hasReceipt = Boolean(order?.transfer?.hasReceipt);
  const canApprove = ['pending_payment', 'in_review', 'conflict'].includes(status);
  const canReject = ['pending_payment', 'in_review', 'conflict'].includes(status);
  const isPaid = status === 'paid';
  const ticketsToCreate = order?.kind === 'room' ? order?.room?.capacity || 1 : 1;

  const footer = order ? (
    isPaid ? (
      <div className="grid grid-cols-[auto_1fr] gap-2 sm:flex sm:justify-end">
        <CopyButton text={orderUrl(order.token)} label="Copiar enlace" copiedLabel="Copiado" />
        <WhatsAppButton phone={order.buyer?.phone} text={orderWhatsappText(order)} />
      </div>
    ) : canApprove ? (
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        {canReject && (
          <Button variant="danger" onClick={() => setConfirm('reject')}>
            <X className="h-4 w-4" />
            Rechazar
          </Button>
        )}
        <Button variant="success" onClick={() => setConfirm('approve')} className={clsx(!canReject && 'col-span-2')}>
          <Check className="h-4 w-4" />
          Aprobar pago
        </Button>
      </div>
    ) : null
  ) : null;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size={hasReceipt ? 'xl' : 'lg'}
        title={order ? order.buyer?.name : 'Compra'}
        description={order ? `${orderKindText(order)} · ${formatDateTime(order.createdAt)}` : undefined}
        footer={footer}
      >
        {!order && loading && <PageSpinner className="min-h-[30vh]" label="Cargando compra…" />}
        {!order && !loading && error && <ErrorState error={error} onRetry={reload} />}
        {order && (
          <div
            className={clsx(
              'grid gap-6',
              hasReceipt && 'md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:grid-rows-[auto_1fr] md:gap-x-7',
            )}
          >
            <div className="flex min-w-0 flex-col gap-4 md:col-start-1 md:row-start-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ORDER_STATUS_TONE[status]} dot>
                  {ORDER_STATUS_LABEL[status] || status}
                </Badge>
                <Badge>{orderKindText(order)}</Badge>
                {loading && <span className="text-xs text-smoke">Actualizando…</span>}
              </div>
              <StatusBanner order={order} />
              <AmountSummary order={order} />
            </div>

            {hasReceipt && (
              <div className="min-w-0 md:col-start-2 md:row-span-2 md:row-start-1">
                <div className="md:sticky md:top-0">
                  <DetailSection title="Comprobante" icon={ImageIcon}>
                    <ReceiptImage orderId={order.id} version={order.transfer.uploadedAt} />
                    <DetailGrid>
                      <DetailItem label="Referencia" mono>
                        {order.transfer.reference}
                      </DetailItem>
                      <DetailItem label="Subido">{order.transfer.uploadedAt && formatDateTime(order.transfer.uploadedAt)}</DetailItem>
                    </DetailGrid>
                  </DetailSection>
                </div>
              </div>
            )}

            <div className="flex min-w-0 flex-col gap-6 md:col-start-1 md:row-start-2">
              <DetailSection
                title="Comprador"
                icon={User}
                action={
                  order.buyer?.phone && !isPaid ? (
                    <WhatsAppButton phone={order.buyer.phone} label="Escribirle" variant="secondary" size="sm" className="h-10" />
                  ) : null
                }
              >
                <DetailGrid>
                  <DetailItem label="Cédula" mono>
                    {order.buyer?.cedula}
                  </DetailItem>
                  <DetailItem label="Celular">
                    <PhoneLink phone={order.buyer?.phone} className="text-bone" />
                  </DetailItem>
                  <DetailItem label="Instagram">
                    <InstagramLink user={order.buyer?.instagram} className="text-bone" />
                  </DetailItem>
                  <DetailItem label="Correo">{order.buyer?.email}</DetailItem>
                </DetailGrid>
              </DetailSection>

              {order.kind === 'room' && (
                <DetailSection title={`Acompañantes (${order.companions?.length || 0})`} icon={Users}>
                  {order.companions?.length ? (
                    <ul className="flex flex-col gap-1.5">
                      {order.companions.map((c, i) => (
                        <li key={`${c.name}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-bone">{c.name}</span>
                          <span className="font-mono text-xs text-fog">{c.cedula || 'Sin cédula'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-fog">No dio nombres. Al pagar se crean entradas “Acompañante N” que puedes renombrar en Entradas.</p>
                  )}
                </DetailSection>
              )}

              <DetailSection title="Pago" icon={CreditCard}>
                <DetailGrid>
                  <DetailItem label="Método">
                    {ORDER_PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod}
                    {order.manualMethod ? ` · ${MANUAL_METHOD_LABEL[order.manualMethod] || order.manualMethod}` : ''}
                  </DetailItem>
                  {order.paymentMethod === 'transferencia' && !hasReceipt && <DetailItem label="Comprobante">Aún no lo sube</DetailItem>}
                  {order.mp && (
                    <>
                      <DetailItem label="Estado en Mercado Pago">{MP_STATUS_LABEL[order.mp.status] || order.mp.status}</DetailItem>
                      <DetailItem label="ID del pago" mono>
                        {order.mp.paymentId}
                      </DetailItem>
                      <DetailItem label="Detalle" mono>
                        {order.mp.statusDetail}
                      </DetailItem>
                      <DetailItem label="Preferencia" mono>
                        {order.mp.preferenceId}
                      </DetailItem>
                    </>
                  )}
                </DetailGrid>
              </DetailSection>

              {order.tickets?.length > 0 && (
                <DetailSection title={`Entradas (${order.tickets.length})`} icon={Ticket}>
                  <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08]">
                    {order.tickets.map((t) => (
                      <li key={t.token || t.code} className="flex items-center gap-3 py-1.5 pl-3.5 pr-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-bone">{t.holderName}</p>
                          <p className="font-mono text-xs tracking-wide text-fog">
                            {t.code}
                            {t.kind !== 'general' && <span className="font-sans tracking-normal text-smoke"> · {TICKET_KIND_LABEL[t.kind]}</span>}
                          </p>
                        </div>
                        <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status] || t.status}</Badge>
                        <CopyButton iconOnly variant="ghost" text={ticketUrl(t.token)} label="Copiar enlace de esta entrada" />
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              )}

              <DetailSection title="Historial" icon={History}>
                <DetailGrid>
                  <DetailItem label="Creada">{formatDateTime(order.createdAt)}</DetailItem>
                  <DetailItem label="Pagada">{order.paidAt && formatDateTime(order.paidAt)}</DetailItem>
                  {order.reviewedBy && (
                    <DetailItem label="Revisada por">
                      {order.reviewedBy.name}
                      {order.reviewedAt ? ` · ${formatDateTime(order.reviewedAt)}` : ''}
                    </DetailItem>
                  )}
                  {order.holdExpiresAt && status === 'pending_payment' && (
                    <DetailItem label="Apartada hasta">{formatDateTime(order.holdExpiresAt)}</DetailItem>
                  )}
                  {order.notes && (
                    <DetailItem label="Notas" full>
                      {order.notes}
                    </DetailItem>
                  )}
                </DetailGrid>
                {!isPaid && (
                  <div>
                    <CopyButton text={orderUrl(order.token)} label="Copiar enlace de la orden" size="sm" className="h-10" />
                  </div>
                )}
              </DetailSection>
            </div>
          </div>
        )}
      </Modal>

      {order && (
        <>
          <ConfirmDialog
            open={confirm === 'approve'}
            onClose={() => setConfirm(null)}
            onConfirm={approve}
            tone="success"
            icon={Check}
            title="¿Aprobar el pago?"
            confirmLabel="Sí, aprobar"
            description={
              <>
                {status === 'conflict' && (
                  <span className="mb-2 block font-medium text-ember">
                    Esta compra está en conflicto: apruébala solo si ya resolviste el cupo de la habitación.
                  </span>
                )}
                Confirmas que recibiste <strong className="text-bone">{formatCOP(order.amount)}</strong> de{' '}
                <strong className="text-bone">{order.buyer?.name}</strong>.{' '}
                {order.kind === 'room'
                  ? `La ${order.room?.name || 'habitación'} queda reservada y se generan ${plural(ticketsToCreate, 'entrada')} (una por persona).`
                  : 'Se genera su entrada con QR.'}
              </>
            }
            reason={{ label: 'Nota interna (opcional)', placeholder: 'Ej.: Llegó a Nequi a las 3:10 p. m.', required: false, maxLength: 500 }}
          />
          <ConfirmDialog
            open={confirm === 'reject'}
            onClose={() => setConfirm(null)}
            onConfirm={reject}
            tone="danger"
            icon={X}
            title="¿Rechazar esta compra?"
            confirmLabel="Rechazar compra"
            description={
              <>
                La compra de <strong className="text-bone">{order.buyer?.name}</strong> queda rechazada
                {order.kind === 'room' ? ' y la habitación vuelve a quedar libre' : ''}. El comprador verá el motivo en su orden.
              </>
            }
            reason={{
              label: 'Motivo del rechazo',
              placeholder: 'Ej.: El valor del comprobante no coincide',
              minLength: 3,
              maxLength: 200,
              suggestions: REJECT_SUGGESTIONS,
            }}
          />
        </>
      )}
    </>
  );
}
