import clsx from 'clsx';
import { BedDouble, Download, Users } from 'lucide-react';
import { Button, Card, PageSpinner, Stat, useToast } from '../../ui';
import { downloadFile } from '../../../lib/api';
import { formatCOP, formatNumber } from '../../../lib/format';
import { DOOR_CATEGORY_LABEL, POS_METHOD_LABEL } from '../../../lib/labels';
import { LoadError, Overline, RefreshLine } from './shared/OpsUi';
import { errorMessage } from './shared/errors';

/** Aforo compacto: "Adentro 47/100" (ámbar ≥ 90 %, rojo al 100 %) + "Habitaciones 9/15". */
export function DoorStatsBar({ stats, config }) {
  const inside = stats?.inside ?? 0;
  const capacity = stats?.capacity ?? config?.capacity ?? 100;
  const pct = capacity ? (inside / capacity) * 100 : 0;
  const tone = pct >= 100 ? 'bg-danger' : pct >= 90 ? 'bg-gold' : 'bg-toxic';
  const text = pct >= 100 ? 'text-danger-light' : pct >= 90 ? 'text-gold' : 'text-bone';
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-crypt px-4 py-2.5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <Users className="h-4 w-4 self-center text-fog" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-smoke">Adentro</span>
          <span className={clsx('text-2xl font-extrabold tabular-nums leading-none', text)}>{stats ? inside : '—'}</span>
          <span className="text-sm font-semibold text-fog">/{capacity}</span>
          {pct >= 100 && <span className="text-xs font-bold uppercase text-danger-light">Lleno</span>}
        </p>
        <p className="flex items-baseline gap-1.5">
          <BedDouble className="h-4 w-4 self-center text-fog" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-smoke">Hab.</span>
          <span className="text-lg font-bold tabular-nums text-bone">{stats ? stats.roomsInside : '—'}</span>
          <span className="text-sm text-fog">/{stats?.roomsCapacity ?? config?.roomsCapacity ?? 15}</span>
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={inside}>
        <div className={clsx('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function Row({ label, value, strong, share }) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className={strong ? 'font-semibold text-bone' : 'text-fog'}>{label}</span>
        <span className={clsx('tabular-nums', strong ? 'text-xl font-extrabold text-bone' : 'font-semibold text-bone')}>{value}</span>
      </div>
      {share !== undefined && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-danger/80" style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

/** Caja de puerta para cuadrar al final de la noche (GET /api/door/stats). */
export default function CashTab({ stats, isAdmin }) {
  const toast = useToast();
  const s = stats.data;
  if (stats.loading && !s) return <PageSpinner label="Cargando caja…" />;
  if (!s) return <LoadError error={stats.error} onRetry={stats.reload} />;
  const m = s.money || {};
  const total = m.total || 0;
  const helmetsKept = Math.max(0, (s.helmets?.stored ?? 0) - (s.helmets?.returned ?? 0));

  const exportCsv = async () => {
    try {
      await downloadFile('/api/admin/export/door.csv', 'puerta.csv');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <RefreshLine loadedAt={Date.now()} onRefresh={() => stats.reload({ silent: true })} />
      <Card className="bg-gradient-to-br from-crypt to-tomb">
        <Overline>Total recaudado en puerta</Overline>
        <p className="mt-2 text-5xl font-extrabold tabular-nums text-bone">{formatCOP(total)}</p>
        <p className="mt-2 text-sm text-fog">
          Efectivo que debe haber en caja: <b className="text-toxic">{formatCOP(m.byMethod?.efectivo)}</b>
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="sm">
          <Overline className="mb-1">Por método</Overline>
          <div className="divide-y divide-white/[0.06]">
            {Object.keys(POS_METHOD_LABEL).map((k) => (
              <Row
                key={k}
                label={k === 'cortesia' ? 'Cortesías (no suman)' : POS_METHOD_LABEL[k]}
                value={formatCOP(m.byMethod?.[k])}
                strong={k === 'efectivo'}
                share={k === 'cortesia' || !total ? undefined : (m.byMethod?.[k] || 0) / total}
              />
            ))}
          </div>
        </Card>
        <Card padding="sm">
          <Overline className="mb-1">Por concepto</Overline>
          <div className="divide-y divide-white/[0.06]">
            <Row label="Entradas" value={formatCOP(m.entries)} />
            <Row label="Parqueadero" value={formatCOP(m.parking)} />
            <Row label="Cascos" value={formatCOP(m.helmets)} />
            <Row label="Total" value={formatCOP(total)} strong />
          </div>
        </Card>
      </div>

      <Overline>Personas</Overline>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Object.keys(DOOR_CATEGORY_LABEL).map((k) => (
          <Stat key={k} label={DOOR_CATEGORY_LABEL[k]} value={formatNumber(s.byCategory?.[k])} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entradas QR vendidas" value={formatNumber(s.tickets?.sold)} hint={`${formatNumber(s.tickets?.checkedIn)} ingresaron · ${formatNumber(s.tickets?.pending)} faltan`} />
        <Stat label="Vehículos" value={formatNumber((s.vehicles?.carro || 0) + (s.vehicles?.moto || 0))} hint={`${s.vehicles?.carro || 0} carros · ${s.vehicles?.moto || 0} motos`} />
        <Stat label="Cascos en custodia" value={formatNumber(helmetsKept)} tone={helmetsKept ? 'amber' : 'neutral'} hint={`${s.helmets?.stored || 0} guardados · ${s.helmets?.returned || 0} devueltos`} />
        <Stat label="Adentro" value={`${s.inside}/${s.capacity}`} hint={`Habitaciones ${s.roomsInside}/${s.roomsCapacity}`} />
      </div>
      {isAdmin && (
        <Button variant="secondary" size="lg" onClick={exportCsv} className="self-start">
          <Download className="h-4 w-4" /> Descargar CSV de puerta
        </Button>
      )}
    </div>
  );
}
