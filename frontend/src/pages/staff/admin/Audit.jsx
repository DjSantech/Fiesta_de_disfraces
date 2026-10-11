import clsx from 'clsx';
import { ScrollText, SearchX } from 'lucide-react';
import { Badge, Button, EmptyState, PageSpinner, Spinner, Tabs } from '../../../components/ui';
import { staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatCOP, formatDateTime, formatNumber } from '../../../lib/format';
import { AUDIT_ACTION_LABEL, AUDIT_ACTION_TONE, EXPENSE_CATEGORY_LABEL, GENDER_LABEL, ROLE_LABEL } from '../../../lib/labels';
import PageHeader from '../../../components/staff/admin/PageHeader';
import ErrorState from '../../../components/staff/admin/ErrorState';
import SearchInput from '../../../components/staff/admin/SearchInput';
import Pagination from '../../../components/staff/admin/Pagination';
import { useSearchBox, useUrlFilters } from '../../../components/staff/admin/hooks';
import { plural, toQuery } from '../../../components/staff/admin/utils';

const PAGE_SIZE = 30;
const ACTIONS = Object.keys(AUDIT_ACTION_LABEL);
const TABS = [
  { value: 'all', label: 'Todo' },
  { value: 'order.delete', label: 'Compras' },
  { value: 'ticket.void', label: 'Anuladas' },
  { value: 'ticket.restore', label: 'Restauradas' },
  { value: 'guest.delete', label: 'Invitados' },
  { value: 'expense.delete', label: 'Gastos' },
  { value: 'user.delete', label: 'Usuarios' },
];

/** Resumen legible del objeto afectado. */
export function targetText(a) {
  const s = a.target?.summary || {};
  const parts = [];
  switch (a.target?.type) {
    case 'order': {
      parts.push(s.buyerName);
      parts.push(s.kind === 'room' ? `Habitación${s.roomNumber ? ` ${s.roomNumber}` : ''}` : ['Entrada', GENDER_LABEL[s.gender]?.toLowerCase()].filter(Boolean).join(' '));
      if (s.amount != null) parts.push(formatCOP(s.amount));
      const codes = s.ticketCodes || [];
      const shown = codes.slice(0, 3).join(', ') + (codes.length > 3 ? '…' : '');
      parts.push(`${plural(s.ticketCount ?? codes.length, 'entrada')}${codes.length ? ` (${shown})` : ''}`);
      break;
    }
    case 'ticket':
      parts.push(s.holderName, s.code, s.buyerName && s.buyerName !== s.holderName ? `compra de ${s.buyerName}` : null);
      break;
    case 'guest':
      parts.push(s.name, s.instagram ? `@${s.instagram}` : null, s.cedulaLast4 ? `CC …${s.cedulaLast4}` : null);
      break;
    case 'expense':
      parts.push(s.concept, EXPENSE_CATEGORY_LABEL?.[s.category] || s.category, s.amount != null ? formatCOP(s.amount) : null);
      break;
    case 'user':
      parts.push(s.name, s.username ? `@${s.username}` : null, ROLE_LABEL[s.role] || s.role);
      break;
    default:
      break;
  }
  return parts.filter(Boolean).join(' · ');
}

function Actor({ actor }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-bone">{actor?.name}</p>
      <p className="truncate text-xs text-smoke">
        @{actor?.username} · {ROLE_LABEL[actor?.role] || actor?.role}
      </p>
    </div>
  );
}

function ActionBadge({ action }) {
  return <Badge tone={AUDIT_ACTION_TONE[action]}>{AUDIT_ACTION_LABEL[action] || action}</Badge>;
}

function AuditTable({ items }) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-white/[0.08] bg-crypt/60 lg:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] uppercase tracking-wider text-smoke">
          <tr>
            <th className="px-4 py-3 font-semibold">Fecha</th>
            <th className="px-3 py-3 font-semibold">Quién</th>
            <th className="px-3 py-3 font-semibold">Acción</th>
            <th className="px-3 py-3 font-semibold">Objeto</th>
            <th className="px-4 py-3 font-semibold">Motivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {items.map((a) => (
            <tr key={a.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 text-fog">{formatDateTime(a.at)}</td>
              <td className="max-w-[200px] px-3 py-3">
                <Actor actor={a.actor} />
              </td>
              <td className="px-3 py-3">
                <ActionBadge action={a.action} />
              </td>
              <td className="max-w-[360px] px-3 py-3 text-bone">{targetText(a)}</td>
              <td className="max-w-[260px] px-4 py-3 text-fog">{a.reason || <span className="text-smoke">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditCards({ items }) {
  return (
    <ul className="flex flex-col gap-2.5 lg:hidden">
      {items.map((a) => (
        <li key={a.id} className="rounded-2xl border border-white/[0.08] bg-crypt/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <ActionBadge action={a.action} />
            <p className="shrink-0 text-xs text-fog">{formatDateTime(a.at)}</p>
          </div>
          <p className="mt-2.5 text-sm font-medium leading-snug text-bone">{targetText(a)}</p>
          {a.reason && (
            <p className="mt-1.5 text-sm text-fog">
              <span className="text-smoke">Motivo: </span>
              {a.reason}
            </p>
          )}
          <div className="mt-3 border-t border-white/[0.06] pt-3 text-sm">
            <Actor actor={a.actor} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Audit() {
  const [params, updateParams] = useUrlFilters();
  const accion = ACTIONS.includes(params.get('accion')) ? params.get('accion') : 'all';
  const q = params.get('q') || '';
  const page = Math.max(1, Number.parseInt(params.get('pagina') || '1', 10) || 1);
  const [search, setSearch] = useSearchBox(q, (value) => updateParams({ q: value }));

  const query = toQuery({ action: accion === 'all' ? '' : accion, q, page, limit: PAGE_SIZE });
  const list = useFetch((signal) => staffApi(`/api/admin/audit?${query}`, { signal }), [query], { interval: 60000 });
  const items = list.data?.items || [];
  const total = list.data?.total ?? 0;
  const hasFilters = Boolean(q || accion !== 'all');
  const clear = () => {
    setSearch('');
    updateParams({ q: '', accion: '' });
  };

  return (
    <div>
      <PageHeader title="Auditoría" description="Registro de quién eliminó o anuló algo, cuándo y por qué. No se puede editar ni borrar." />
      <div className="flex flex-col gap-3">
        <Tabs tabs={TABS} value={accion} onChange={(v) => updateParams({ accion: v === 'all' ? '' : v })} ariaLabel="Tipo de acción" />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar comprador, quién lo hizo o motivo" />

        <div className="flex min-h-6 items-center justify-between gap-3 text-sm text-fog">
          <p>
            {list.data ? (
              <>
                <strong className="font-semibold tabular-nums text-bone">{formatNumber(total)}</strong> {total === 1 ? 'registro' : 'registros'}
                {hasFilters && ' con estos filtros'}
              </>
            ) : (
              ' '
            )}
          </p>
          {list.loading && list.data && <Spinner className="h-4 w-4 text-fog" label="Actualizando" />}
        </div>

        {!list.data ? (
          list.error ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : (
            <PageSpinner label="Cargando auditoría…" />
          )
        ) : items.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Sin resultados"
              description="Ningún registro coincide con la búsqueda o el filtro."
              action={
                <Button variant="secondary" onClick={clear}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState icon={ScrollText} title="Aún no hay registros" description="Cuando alguien elimine una compra o anule una entrada, queda anotado aquí." />
          )
        ) : (
          <div className={clsx('transition-opacity', list.loading && 'opacity-60')}>
            <AuditTable items={items} />
            <AuditCards items={items} />
            <Pagination page={page} limit={PAGE_SIZE} total={total} onChange={(p) => updateParams({ pagina: p })} />
          </div>
        )}
      </div>
    </div>
  );
}
