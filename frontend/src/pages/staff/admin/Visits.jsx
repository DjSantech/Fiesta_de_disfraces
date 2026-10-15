import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Eye, FileText, Filter, Lightbulb, MousePointerClick, Percent, RefreshCw, Repeat, Smartphone, Users } from 'lucide-react';
import { Button, Card, EmptyState, PageSpinner, Stat, Tabs } from '../../../components/ui';
import { staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatNumber, formatRelative } from '../../../lib/format';
import { VISIT_DEVICE_LABEL, VISIT_SOURCE_LABEL, visitPathLabel } from '../../../lib/labels';
import PageHeader, { SectionTitle } from '../../../components/staff/admin/PageHeader';
import ErrorState from '../../../components/staff/admin/ErrorState';
import { BarList } from '../../../components/staff/admin/Charts';
import { DayBars, LivePulse } from '../../../components/staff/admin/VisitWidgets';
import { useNow } from '../../../components/staff/admin/hooks';

const REFRESH_MS = 30000;
const RANGES = [
  { value: '7', label: '7 días' },
  { value: '14', label: '14 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
];
const SOURCE_COLOR = {
  instagram: 'bg-pumpkin',
  whatsapp: 'bg-toxic',
  facebook: 'bg-ultra',
  tiktok: 'bg-danger',
  google: 'bg-gold',
  directo: 'bg-bone/70',
  otro: 'bg-smoke',
};

const pct = (n, d) => (d > 0 ? `${String(Math.round((n / d) * 1000) / 10).replace('.', ',')}%` : '0%');

function PurchaseFunnel({ f }) {
  const steps = [
    { key: 'visitors', label: 'Visitantes', value: f.visitors, color: 'bg-bone/70' },
    { key: 'buy', label: 'Vieron Comprar', value: f.visitedBuy, color: 'bg-ultra' },
    { key: 'orders', label: 'Compras creadas', value: f.orders, color: 'bg-pumpkin' },
    { key: 'paid', label: 'Pagadas', value: f.paid, color: 'bg-toxic' },
  ];
  const top = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ul className="flex flex-col gap-3.5">
      {steps.map((s, i) => (
        <li key={s.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-fog">{s.label}</span>
            <span className="shrink-0 tabular-nums">
              <strong className="text-bone">{formatNumber(s.value)}</strong>
              <span className="ml-2 text-xs text-smoke">{i === 0 ? '100%' : `${pct(s.value, steps[0].value)} de visitantes`}</span>
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={clsx('h-full rounded-full transition-[width] duration-700', s.color)}
              style={{ width: `${(s.value / top) * 100}%`, minWidth: s.value > 0 ? '0.375rem' : 0 }}
            />
          </div>
          {i > 0 && steps[i - 1].value > 0 && <p className="mt-1 text-xs text-smoke">{pct(s.value, steps[i - 1].value)} del paso anterior</p>}
        </li>
      ))}
    </ul>
  );
}

export default function Visits() {
  const [days, setDays] = useState('14');
  const { data, error, loading, reload } = useFetch((signal) => staffApi(`/api/admin/visits?days=${days}`, { signal }), [days], {
    interval: REFRESH_MS,
  });
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  useNow(10000);

  useEffect(() => {
    if (data) setUpdatedAt(Date.now());
  }, [data]);

  const refresh = async () => {
    setRefreshing(true);
    await reload({ silent: true });
    setRefreshing(false);
  };

  const header = (
    <PageHeader
      title="Visitas"
      description="Cuánta gente entra a la web, de dónde viene y cuántos terminan comprando. Es anónimo: no guarda datos personales."
      actions={
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Tabs tabs={RANGES} value={days} onChange={setDays} ariaLabel="Rango de días" className="flex-1 sm:flex-none" />
          <Button variant="secondary" size="icon" className="h-11 w-11 shrink-0" onClick={refresh} disabled={refreshing} aria-label="Actualizar ahora">
            <RefreshCw className={clsx('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      }
    />
  );

  if (loading && !data) {
    return (
      <>
        {header}
        <PageSpinner label="Cargando visitas…" />
      </>
    );
  }
  if (!data) {
    return (
      <>
        {header}
        <ErrorState error={error} onRetry={reload} />
      </>
    );
  }

  const { now, today, range, byDay, byPage, bySource, byDevice, funnel } = data;
  const empty = range.pageviews === 0;
  const sourceTotal = bySource.reduce((s, x) => s + x.visitors, 0);
  const deviceTotal = byDevice.reduce((s, x) => s + x.visitors, 0);

  return (
    <div>
      {header}
      <div className="flex flex-col gap-4">
        <Card className={clsx('flex flex-wrap items-center gap-x-8 gap-y-3 sm:p-6', now.visitors5m > 0 && 'border-toxic/25')}>
          <div className="flex items-center gap-3">
            <LivePulse active={now.visitors5m > 0} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-smoke">Ahora mismo</p>
              <p className="mt-1 text-4xl font-bold tabular-nums leading-none text-bone">{formatNumber(now.visitors5m)}</p>
              <p className="mt-1 text-xs text-fog">visitantes en los últimos 5 min</p>
            </div>
          </div>
          <dl className="flex gap-8 text-sm">
            <div>
              <dt className="text-xs text-smoke">Últimos 30 min</dt>
              <dd className="mt-0.5 text-xl font-bold tabular-nums text-bone">{formatNumber(now.visitors30m)}</dd>
            </div>
            <div>
              <dt className="text-xs text-smoke">Hoy</dt>
              <dd className="mt-0.5 text-xl font-bold tabular-nums text-bone">{formatNumber(today.visitors)}</dd>
            </div>
          </dl>
          <span className={clsx('text-xs sm:ml-auto', error ? 'text-gold' : 'text-smoke')}>
            {error ? 'Sin conexión · reintentando' : `Actualizado ${formatRelative(updatedAt)}`}
          </span>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Visitantes únicos" value={formatNumber(range.visitors)} hint={`últimos ${range.days} días`} icon={Users} tone="orange" />
          <Stat
            label="Páginas vistas"
            value={formatNumber(range.pageviews)}
            hint={range.visitors ? `${(range.pageviews / range.visitors).toFixed(1).replace('.', ',')} por visitante` : undefined}
            icon={FileText}
          />
          <Stat label="Regresan" value={formatNumber(range.returning)} hint={`${pct(range.returning, range.visitors)} volvió otro día`} icon={Repeat} tone="violet" />
          <Stat
            label="Conversión"
            value={`${String(funnel.conversionPercent).replace('.', ',')}%`}
            hint={`${formatNumber(funnel.orders)} compras / ${formatNumber(funnel.visitors)} visitantes`}
            icon={Percent}
            tone="green"
          />
        </div>

        {empty ? (
          <EmptyState
            icon={Eye}
            title="Aún no hay visitas en este rango"
            description="Cuando alguien entre a la web, aparecerá aquí. Tus propias visitas como staff no se cuentan."
          />
        ) : (
          <>
            <Card className="flex flex-col gap-4 sm:p-6">
              <SectionTitle icon={Eye} action={<span className="text-xs text-fog">Visitantes únicos por día</span>}>
                Visitas por día
              </SectionTitle>
              <DayBars days={byDay} height="h-36" />
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="flex flex-col gap-4 sm:p-6">
                <SectionTitle icon={MousePointerClick}>De dónde vienen</SectionTitle>
                <BarList
                  scale="total"
                  items={bySource.map((s) => ({
                    key: s.source,
                    label: VISIT_SOURCE_LABEL[s.source] || s.source,
                    value: s.visitors,
                    color: SOURCE_COLOR[s.source],
                    hint: `${pct(s.visitors, sourceTotal)} de los visitantes`,
                  }))}
                  format={formatNumber}
                />
              </Card>
              <Card className="flex flex-col gap-4 sm:p-6">
                <SectionTitle icon={FileText}>Páginas más vistas</SectionTitle>
                <BarList
                  items={byPage.map((p) => ({
                    key: p.path,
                    label: visitPathLabel(p.path),
                    value: p.pageviews,
                    hint: `${formatNumber(p.visitors)} ${p.visitors === 1 ? 'visitante' : 'visitantes'}`,
                  }))}
                  format={formatNumber}
                />
              </Card>
              <Card className="flex flex-col gap-4 sm:p-6">
                <SectionTitle icon={Smartphone}>Dispositivos</SectionTitle>
                <BarList
                  scale="total"
                  items={byDevice.map((d) => ({
                    key: d.device,
                    label: VISIT_DEVICE_LABEL[d.device] || d.device,
                    value: d.visitors,
                    color: 'bg-ultra',
                    hint: `${pct(d.visitors, deviceTotal)} de los visitantes`,
                  }))}
                  format={formatNumber}
                />
              </Card>
              <Card className="flex flex-col gap-4 sm:p-6">
                <SectionTitle icon={Filter}>Del visitante a la compra</SectionTitle>
                <PurchaseFunnel f={funnel} />
              </Card>
            </div>
          </>
        )}

        <Card className="flex gap-3 border-ember/25 bg-ember/[0.05] sm:p-5">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-ember" strokeWidth={1.75} />
          <div className="min-w-0 text-sm leading-relaxed text-fog">
            <p>
              <strong className="text-bone">Tip:</strong> usa en tu bio de Instagram el enlace{' '}
              <code className="break-all rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-bone">https://fiestadedisfraces.pages.dev/?src=instagram</code>{' '}
              para medir cuánta gente viene de ahí.
            </p>
            <p className="mt-1.5">
              Para WhatsApp usa{' '}
              <code className="break-all rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-bone">https://fiestadedisfraces.pages.dev/?src=whatsapp</code>.
            </p>
            <p className="mt-1.5 text-xs text-smoke">
              Se cuentan navegadores (un navegador = un visitante), no personas. Quien bloquea el rastreo o entra con sesión de staff no aparece.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
