import { useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, SearchX, Ticket } from 'lucide-react';
import { Badge, Button, EmptyState, PageSpinner, Select, Spinner, Tabs } from '../../../components/ui';
import { staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatNumber, formatTime } from '../../../lib/format';
import { TICKET_STATUS_LABEL, TICKET_STATUS_TONE } from '../../../lib/labels';
import PageHeader from '../../../components/staff/admin/PageHeader';
import ErrorState from '../../../components/staff/admin/ErrorState';
import SearchInput from '../../../components/staff/admin/SearchInput';
import Pagination from '../../../components/staff/admin/Pagination';
import ExportMenu from '../../../components/staff/admin/ExportMenu';
import CopyButton from '../../../components/staff/admin/CopyButton';
import TicketModal, { ticketKindText } from '../../../components/staff/admin/TicketModal';
import OrderDetailModal from '../../../components/staff/admin/OrderDetailModal';
import { WhatsAppButton } from '../../../components/staff/admin/Contact';
import { useSearchBox, useUrlFilters } from '../../../components/staff/admin/hooks';
import { formatPhone, normalizeSearch, ticketUrl, ticketWhatsappText, toQuery } from '../../../components/staff/admin/utils';

const PAGE_SIZE = 30;
const STATUS_TABS = [
  { value: 'all', label: 'Todas' },
  { value: 'valid', label: 'Válidas' },
  { value: 'used', label: 'Ya ingresaron' },
  { value: 'void', label: 'Anuladas' },
];
const KIND_FILTER = [
  { value: '', label: 'Todo tipo' },
  { value: 'general', label: 'General' },
  { value: 'room', label: 'Habitación' },
  { value: 'cortesia', label: 'Cortesía' },
];

function isOtherBuyer(t) {
  const buyer = t.order?.buyer?.name;
  return buyer && normalizeSearch(buyer) !== normalizeSearch(t.holderName);
}

function StatusCell({ t }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={TICKET_STATUS_TONE[t.status]} dot>
        {TICKET_STATUS_LABEL[t.status] || t.status}
      </Badge>
      {t.status === 'used' && t.checkedInAt && (
        <span className="text-xs text-smoke">
          {formatTime(t.checkedInAt)}
          {t.checkedInBy?.name ? ` · ${t.checkedInBy.name}` : ''}
        </span>
      )}
      {t.status === 'void' && t.voidReason && <span className="max-w-[180px] truncate text-xs text-smoke">{t.voidReason}</span>}
    </div>
  );
}

function TicketsTable({ items, onOpen }) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-white/[0.08] bg-crypt/60 lg:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] uppercase tracking-wider text-smoke">
          <tr>
            <th className="px-4 py-3 font-semibold">Código</th>
            <th className="px-3 py-3 font-semibold">Titular</th>
            <th className="px-3 py-3 font-semibold">Tipo</th>
            <th className="px-3 py-3 font-semibold">Comprador</th>
            <th className="px-3 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 text-right font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {items.map((t) => (
            <tr
              key={t.id}
              tabIndex={0}
              onClick={() => onOpen(t)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(t);
                }
              }}
              className="cursor-pointer transition hover:bg-white/[0.035] focus-visible:bg-white/[0.05] focus-visible:outline-none"
            >
              <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] tracking-wide text-bone">{t.code}</td>
              <td className="max-w-[240px] px-3 py-3">
                <p className="truncate font-medium text-bone">{t.holderName}</p>
                <p className="font-mono text-xs text-fog">{t.holderCedula || <span className="font-sans text-smoke">Sin cédula</span>}</p>
              </td>
              <td className="px-3 py-3">
                <p className="whitespace-nowrap text-bone">{ticketKindText(t)}</p>
                {t.isGuest && <p className="text-xs text-ember">Invitado</p>}
              </td>
              <td className="max-w-[220px] px-3 py-3">
                <p className={clsx('truncate', isOtherBuyer(t) ? 'text-bone' : 'text-fog')}>{t.order?.buyer?.name}</p>
                <p className="text-xs tabular-nums text-fog">{formatPhone(t.order?.buyer?.phone)}</p>
              </td>
              <td className="px-3 py-3">
                <StatusCell t={t} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <CopyButton iconOnly variant="ghost" text={ticketUrl(t.token)} label="Copiar enlace de la entrada" />
                  <WhatsAppButton iconOnly variant="ghost" phone={t.order?.buyer?.phone} text={ticketWhatsappText(t)} label="Enviar por WhatsApp al comprador" />
                  <span className="flex h-11 w-8 items-center justify-center text-smoke" aria-hidden="true">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TicketCard({ t, onOpen }) {
  return (
    <li className="relative rounded-2xl border border-white/[0.08] bg-crypt/80 p-4 transition hover:border-white/15">
      <button
        type="button"
        onClick={() => onOpen(t)}
        className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={`Gestionar la entrada de ${t.holderName}`}
      />
      <div className="pointer-events-none relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wide text-fog">{t.code}</p>
          <p className="mt-0.5 truncate text-base font-semibold text-bone">{t.holderName}</p>
        </div>
        <Badge tone={TICKET_STATUS_TONE[t.status]} dot>
          {TICKET_STATUS_LABEL[t.status] || t.status}
        </Badge>
      </div>
      <p className="pointer-events-none relative mt-1 flex flex-wrap gap-x-2 text-sm text-fog">
        <span>{ticketKindText(t)}</span>
        {t.isGuest && <span className="text-ember">· Invitado</span>}
        {t.holderCedula && <span className="font-mono text-xs leading-5">· CC {t.holderCedula}</span>}
      </p>
      <div className="relative mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2.5">
        <p className="pointer-events-none min-w-0 truncate text-xs text-fog">
          {t.status === 'used' && t.checkedInAt
            ? `Ingresó ${formatTime(t.checkedInAt)}${t.checkedInBy?.name ? ` · ${t.checkedInBy.name}` : ''}`
            : isOtherBuyer(t)
              ? `Compró: ${t.order?.buyer?.name}`
              : formatPhone(t.order?.buyer?.phone)}
        </p>
        <div className="relative z-10 -my-1 -mr-2 flex shrink-0 items-center">
          <CopyButton iconOnly variant="ghost" text={ticketUrl(t.token)} label="Copiar enlace de la entrada" />
          <WhatsAppButton iconOnly variant="ghost" phone={t.order?.buyer?.phone} text={ticketWhatsappText(t)} label="Enviar por WhatsApp al comprador" />
        </div>
      </div>
    </li>
  );
}

export default function Tickets() {
  const [params, updateParams] = useUrlFilters();
  const status = ['valid', 'used', 'void'].includes(params.get('estado')) ? params.get('estado') : 'all';
  const kind = ['general', 'room', 'cortesia'].includes(params.get('tipo')) ? params.get('tipo') : '';
  const q = params.get('q') || '';
  const page = Math.max(1, Number.parseInt(params.get('pagina') || '1', 10) || 1);

  const [search, setSearch] = useSearchBox(q, (value) => updateParams({ q: value }));
  const [selected, setSelected] = useState(null);
  const [orderId, setOrderId] = useState(null);

  const query = toQuery({ status: status === 'all' ? '' : status, kind, q, page, limit: PAGE_SIZE });
  const list = useFetch((signal) => staffApi(`/api/admin/tickets?${query}`, { signal }), [query], { interval: 60000 });

  const items = list.data?.items || [];
  const total = list.data?.total ?? 0;
  const hasFilters = Boolean(q || kind);

  const clearFilters = () => {
    setSearch('');
    updateParams({ q: '', tipo: '' });
  };

  const handleChanged = (updated) => {
    // Refleja el cambio al instante y luego sincroniza con el servidor.
    list.setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)) } : d));
    list.reload({ silent: true });
  };

  return (
    <div>
      <PageHeader
        title="Entradas"
        description="Cada QR emitido. Renombra acompañantes de habitación, anula o restaura entradas y reenvía los enlaces."
        actions={<ExportMenu options={[{ dataset: 'tickets', slug: 'entradas', label: 'Entradas' }]} label="Exportar CSV" />}
      />

      <div className="flex flex-col gap-3">
        <Tabs tabs={STATUS_TABS} value={status} onChange={(v) => updateParams({ estado: v === 'all' ? '' : v })} ariaLabel="Estado de la entrada" />

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar nombre, cédula o código FD-…" />
          <Select aria-label="Tipo de entrada" value={kind} onChange={(e) => updateParams({ tipo: e.target.value })} options={KIND_FILTER} />
        </div>

        <div className="flex min-h-6 items-center justify-between gap-3 text-sm text-fog">
          <p>
            {list.data ? (
              <>
                <strong className="font-semibold tabular-nums text-bone">{formatNumber(total)}</strong> {total === 1 ? 'entrada' : 'entradas'}
                {hasFilters && ' con estos filtros'}
              </>
            ) : (
              ' '
            )}
          </p>
          <div className="flex items-center gap-3">
            {list.loading && list.data && <Spinner className="h-4 w-4 text-fog" label="Actualizando" />}
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="h-9 rounded-lg px-2 text-sm font-medium text-blood-light hover:bg-white/5">
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {!list.data ? (
          list.error ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : (
            <PageSpinner label="Cargando entradas…" />
          )
        ) : items.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Sin resultados"
              description="Ninguna entrada coincide con la búsqueda."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Ticket}
              title={status === 'all' ? 'Aún no hay entradas' : `No hay entradas ${STATUS_TABS.find((s) => s.value === status)?.label.toLowerCase()}`}
              description={status === 'all' ? 'Las entradas se generan cuando una compra queda pagada.' : null}
            />
          )
        ) : (
          <div className={clsx('transition-opacity', list.loading && 'opacity-60')}>
            <TicketsTable items={items} onOpen={setSelected} />
            <ul className="flex flex-col gap-2.5 lg:hidden">
              {items.map((t) => (
                <TicketCard key={t.id} t={t} onOpen={setSelected} />
              ))}
            </ul>
            <Pagination page={page} limit={PAGE_SIZE} total={total} onChange={(p) => updateParams({ pagina: p })} />
          </div>
        )}
      </div>

      {selected && (
        <TicketModal
          key={selected.id}
          ticket={selected}
          onClose={() => setSelected(null)}
          onChanged={handleChanged}
          onOpenOrder={(id) => {
            setSelected(null);
            setOrderId(id);
          }}
        />
      )}
      {orderId && <OrderDetailModal orderId={orderId} onClose={() => setOrderId(null)} onChanged={() => list.reload({ silent: true })} />}
    </div>
  );
}
