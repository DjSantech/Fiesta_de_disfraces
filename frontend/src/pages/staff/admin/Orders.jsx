import { useState } from 'react';
import clsx from 'clsx';
import { BedDouble, Paperclip, Plus, Receipt, SearchX, Ticket } from 'lucide-react';
import { Badge, Button, EmptyState, PageSpinner, Select, Spinner, Tabs } from '../../../components/ui';
import { staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatCOP, formatDateTime, formatNumber, formatRelative } from '../../../lib/format';
import {
  GENDER_LABEL,
  MANUAL_METHOD_LABEL,
  ORDER_PAYMENT_METHOD_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PHASE_LABEL,
} from '../../../lib/labels';
import PageHeader from '../../../components/staff/admin/PageHeader';
import ErrorState from '../../../components/staff/admin/ErrorState';
import SearchInput from '../../../components/staff/admin/SearchInput';
import Pagination from '../../../components/staff/admin/Pagination';
import ExportMenu from '../../../components/staff/admin/ExportMenu';
import OrderDetailModal from '../../../components/staff/admin/OrderDetailModal';
import ManualSaleModal from '../../../components/staff/admin/ManualSaleModal';
import { InstagramLink } from '../../../components/staff/admin/Contact';
import { useSearchBox, useUrlFilters } from '../../../components/staff/admin/hooks';
import { formatPhone, toQuery } from '../../../components/staff/admin/utils';

const PAGE_SIZE = 30;
const CLOSED = ['rejected', 'expired', 'cancelled'];
const ESTADOS = ['in_review', 'paid', 'pending_payment', 'conflict', 'all', ...CLOSED];
const CLOSED_LABEL = { rejected: 'Rechazadas', expired: 'Expiradas', cancelled: 'Canceladas' };

const KIND_FILTER = [
  { value: '', label: 'Todo tipo' },
  { value: 'ticket', label: 'Entradas' },
  { value: 'room', label: 'Habitaciones' },
];
const METHOD_FILTER = [
  { value: '', label: 'Todo método' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'manual', label: 'Venta manual' },
];

const EMPTY_COPY = {
  in_review: { title: 'Nada por revisar', description: 'Cuando alguien suba el comprobante de una transferencia, aparece aquí para que lo apruebes.' },
  paid: { title: 'Aún no hay compras pagadas', description: 'Las compras aprobadas, pagadas por Mercado Pago y las ventas manuales salen aquí.' },
  pending_payment: { title: 'Nadie está pendiente de pago', description: 'Aquí salen quienes empezaron una compra y aún no pagan.' },
  rejected: { title: 'No hay compras rechazadas', description: null },
  expired: { title: 'No hay compras expiradas', description: null },
  cancelled: { title: 'No hay compras canceladas', description: null },
  conflict: { title: 'Sin conflictos', description: 'Todo en orden con las habitaciones.' },
  all: { title: 'Aún no hay compras', description: 'Cuando alguien compre en la web o registres una venta manual, aparece aquí.' },
};

function kindText(o) {
  if (o.kind === 'room') return o.room?.name || 'Habitación';
  return ['Entrada', GENDER_LABEL[o.gender]].filter(Boolean).join(' · ');
}

function methodText(o) {
  const base = ORDER_PAYMENT_METHOD_LABEL[o.paymentMethod] || o.paymentMethod;
  return o.manualMethod ? `${base} · ${MANUAL_METHOD_LABEL[o.manualMethod] || o.manualMethod}` : base;
}

function ReceiptMark({ o }) {
  if (!o.transfer?.hasReceipt) return null;
  return <Paperclip className="inline h-3.5 w-3.5 text-violet-300" aria-label="Con comprobante" />;
}

function StatusBadge({ status }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]} dot>
      {ORDER_STATUS_LABEL[status] || status}
    </Badge>
  );
}

function OrdersTable({ items, onOpen }) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-white/[0.08] bg-crypt/60 lg:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] uppercase tracking-wider text-smoke">
          <tr>
            <th className="px-4 py-3 font-semibold">Persona</th>
            <th className="px-3 py-3 font-semibold">Celular</th>
            <th className="px-3 py-3 font-semibold">Cédula</th>
            <th className="px-3 py-3 font-semibold">Tipo</th>
            <th className="px-3 py-3 text-right font-semibold">Monto</th>
            <th className="px-3 py-3 font-semibold">Método</th>
            <th className="px-3 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 text-right font-semibold">Fecha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {items.map((o) => (
            <tr
              key={o.id}
              tabIndex={0}
              onClick={() => onOpen(o)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(o);
                }
              }}
              className="cursor-pointer transition hover:bg-white/[0.035] focus-visible:bg-white/[0.05] focus-visible:outline-none"
            >
              <td className="max-w-[240px] px-4 py-3">
                <p className="truncate font-medium text-bone">{o.buyer?.name}</p>
                <InstagramLink user={o.buyer?.instagram} className="max-w-full text-xs" />
              </td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums text-fog">{formatPhone(o.buyer?.phone)}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px] text-fog">{o.buyer?.cedula}</td>
              <td className="px-3 py-3">
                <p className="whitespace-nowrap text-bone">{kindText(o)}</p>
                {o.kind === 'ticket' && o.breakdown?.phase && <p className="text-xs text-smoke">{PHASE_LABEL[o.breakdown.phase]}</p>}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right">
                <p className="font-semibold tabular-nums text-bone">{formatCOP(o.amount)}</p>
                {o.breakdown?.isGuest && <p className="text-xs text-ember">Invitado −{o.breakdown.discountPercent}%</p>}
              </td>
              <td className="px-3 py-3 text-fog">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  {methodText(o)}
                  <ReceiptMark o={o} />
                </span>
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={o.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-fog" title={formatDateTime(o.createdAt)}>
                {formatRelative(o.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderCard({ o, onOpen }) {
  return (
    <li className="relative rounded-2xl border border-white/[0.08] bg-crypt/80 p-4 transition hover:border-white/15 has-[button:active]:scale-[0.99]">
      <button
        type="button"
        onClick={() => onOpen(o)}
        className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={`Ver compra de ${o.buyer?.name}`}
      />
      <div className="pointer-events-none relative flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-base font-semibold text-bone">{o.buyer?.name}</p>
        <StatusBadge status={o.status} />
      </div>
      <div className="pointer-events-none relative mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fog">
        {o.buyer?.instagram && (
          <span className="pointer-events-auto">
            <InstagramLink user={o.buyer.instagram} className="relative z-10 py-1" />
          </span>
        )}
        <span className="tabular-nums">{formatPhone(o.buyer?.phone)}</span>
        <span className="font-mono">CC {o.buyer?.cedula}</span>
      </div>
      <div className="pointer-events-none relative mt-3 flex items-end justify-between gap-3 border-t border-white/[0.06] pt-3">
        <div className="min-w-0 text-sm">
          <p className="flex items-center gap-1.5 text-bone">
            {o.kind === 'room' ? <BedDouble className="h-4 w-4 text-fog" /> : <Ticket className="h-4 w-4 text-fog" />}
            <span className="truncate">
              {kindText(o)}
              {o.kind === 'ticket' && o.breakdown?.phase && <span className="text-fog"> · {PHASE_LABEL[o.breakdown.phase]}</span>}
            </span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fog">
            <span className="truncate">{methodText(o)}</span>
            <ReceiptMark o={o} />
            <span className="text-smoke">· {formatRelative(o.createdAt)}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tabular-nums leading-none text-bone">{formatCOP(o.amount)}</p>
          {o.breakdown?.isGuest && <p className="mt-1 text-xs text-ember">Invitado −{o.breakdown.discountPercent}%</p>}
        </div>
      </div>
    </li>
  );
}

export default function Orders() {
  const [params, updateParams] = useUrlFilters();
  const estadoParam = ESTADOS.includes(params.get('estado')) ? params.get('estado') : null;
  const kind = ['ticket', 'room'].includes(params.get('tipo')) ? params.get('tipo') : '';
  const method = ['mercadopago', 'transferencia', 'manual'].includes(params.get('metodo')) ? params.get('metodo') : '';
  const q = params.get('q') || '';
  const page = Math.max(1, Number.parseInt(params.get('pagina') || '1', 10) || 1);

  const [search, setSearch] = useSearchBox(q, (value) => updateParams({ q: value }));
  const [selected, setSelected] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);

  // Cantidades para las pestañas (solo el total: limit=1).
  const counts = useFetch(
    async (signal) => {
      const [review, conflict] = await Promise.all([
        staffApi('/api/admin/orders?status=in_review&limit=1', { signal }),
        staffApi('/api/admin/orders?status=conflict&limit=1', { signal }),
      ]);
      return { in_review: review.total || 0, conflict: conflict.total || 0 };
    },
    [],
    { interval: 45000 },
  );

  // Sin ?estado: si hay transferencias por revisar empieza ahí; si no, muestra todas.
  const estado = estadoParam ?? (counts.data ? (counts.data.in_review > 0 ? 'in_review' : 'all') : counts.error ? 'all' : null);

  const query = toQuery({ status: estado === 'all' ? '' : estado, kind, method, q, page, limit: PAGE_SIZE });
  const list = useFetch((signal) => staffApi(`/api/admin/orders?${query}`, { signal }), [query], {
    enabled: estado !== null,
    interval: 45000,
  });

  const refreshAll = () => {
    list.reload({ silent: true });
    counts.reload({ silent: true });
  };

  const tabValue = CLOSED.includes(estado) ? 'closed' : estado;
  const tabs = [
    { value: 'in_review', label: 'En revisión', badge: counts.data?.in_review || undefined },
    { value: 'paid', label: 'Pagadas' },
    { value: 'pending_payment', label: 'Pendientes de pago' },
    { value: 'closed', label: 'Rechazadas / Expiradas' },
    ...(counts.data?.conflict > 0 || estado === 'conflict'
      ? [{ value: 'conflict', label: 'Conflictos', badge: counts.data?.conflict || undefined }]
      : []),
    { value: 'all', label: 'Todas' },
  ];

  const hasFilters = Boolean(q || kind || method);
  const items = list.data?.items || [];
  const total = list.data?.total ?? 0;
  const empty = EMPTY_COPY[estado] || EMPTY_COPY.all;

  return (
    <div>
      <PageHeader
        title="Compras"
        description="Todas las personas registradas. Aprueba transferencias, revisa pagos y registra ventas manuales."
        actions={
          <>
            <Button onClick={() => setManualOpen(true)}>
              <Plus className="h-4 w-4" />
              Registrar venta manual
            </Button>
            <ExportMenu
              options={[
                { dataset: 'orders', slug: 'compras', label: 'Compras' },
                { dataset: 'tickets', slug: 'entradas', label: 'Entradas' },
              ]}
            />
          </>
        }
      />

      <div className="flex flex-col gap-3">
        {tabValue ? (
          <Tabs tabs={tabs} value={tabValue} onChange={(v) => updateParams({ estado: v === 'closed' ? 'rejected' : v })} ariaLabel="Estado de la compra" />
        ) : (
          <div className="h-12 rounded-2xl border border-white/[0.08] bg-crypt/80" />
        )}

        {tabValue === 'closed' && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Tipo de cierre">
            {CLOSED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateParams({ estado: s })}
                aria-pressed={estado === s}
                className={clsx(
                  'h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition',
                  estado === s ? 'border-bone/40 bg-white/10 text-bone' : 'border-white/10 text-fog hover:border-white/25 hover:text-bone',
                )}
              >
                {CLOSED_LABEL[s]}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar nombre, cédula, celular o @instagram" />
          <div className="grid grid-cols-2 gap-3 sm:contents">
            <Select aria-label="Tipo de compra" value={kind} onChange={(e) => updateParams({ tipo: e.target.value })} options={KIND_FILTER} />
            <Select aria-label="Método de pago" value={method} onChange={(e) => updateParams({ metodo: e.target.value })} options={METHOD_FILTER} />
          </div>
        </div>

        <div className="flex min-h-6 items-center justify-between gap-3 text-sm text-fog">
          <p>
            {list.data ? (
              <>
                <strong className="font-semibold text-bone tabular-nums">{formatNumber(total)}</strong> {total === 1 ? 'compra' : 'compras'}
                {hasFilters && ' con estos filtros'}
              </>
            ) : (
              ' '
            )}
          </p>
          <div className="flex items-center gap-3">
            {list.loading && list.data && <Spinner className="h-4 w-4 text-fog" label="Actualizando" />}
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  updateParams({ q: '', tipo: '', metodo: '' });
                }}
                className="h-9 rounded-lg px-2 text-sm font-medium text-pumpkin-light hover:bg-white/5"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {!list.data ? (
          list.error ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : (
            <PageSpinner label="Cargando compras…" />
          )
        ) : items.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Sin resultados"
              description="Ninguna compra coincide con la búsqueda o los filtros."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    updateParams({ q: '', tipo: '', metodo: '' });
                  }}
                >
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Receipt}
              title={empty.title}
              description={empty.description}
              action={
                estado === 'in_review' ? (
                  <Button variant="secondary" onClick={() => updateParams({ estado: 'all' })}>
                    Ver todas las compras
                  </Button>
                ) : estado === 'all' ? (
                  <Button onClick={() => setManualOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Registrar venta manual
                  </Button>
                ) : null
              }
            />
          )
        ) : (
          <div className={clsx('transition-opacity', list.loading && 'opacity-60')}>
            <OrdersTable items={items} onOpen={setSelected} />
            <ul className="flex flex-col gap-2.5 lg:hidden">
              {items.map((o) => (
                <OrderCard key={o.id} o={o} onOpen={setSelected} />
              ))}
            </ul>
            <Pagination page={page} limit={PAGE_SIZE} total={total} onChange={(p) => updateParams({ pagina: p })} />
          </div>
        )}
      </div>

      {selected && (
        <OrderDetailModal orderId={selected.id} initialOrder={selected} onClose={() => setSelected(null)} onChanged={refreshAll} />
      )}
      {manualOpen && <ManualSaleModal onClose={() => setManualOpen(false)} onCreated={refreshAll} />}
    </div>
  );
}
