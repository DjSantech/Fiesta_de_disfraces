import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  BadgePercent,
  BedDouble,
  ChevronRight,
  CircleCheck,
  DoorOpen,
  Gift,
  Hourglass,
  Receipt,
  RefreshCw,
  Ticket,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { Badge, Button, Card, PageSpinner } from '../../../components/ui';
import { staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatCOP, formatNumber, formatRelative } from '../../../lib/format';
import PageHeader, { SectionTitle } from '../../../components/staff/admin/PageHeader';
import ErrorState from '../../../components/staff/admin/ErrorState';
import CoverageCard from '../../../components/staff/admin/CoverageCard';
import { BarList, ProgressBar, StackedBar } from '../../../components/staff/admin/Charts';
import { useNow } from '../../../components/staff/admin/hooks';
import { plural } from '../../../components/staff/admin/utils';

const REFRESH_MS = 30000;

function CardLink({ to, children }) {
  return (
    <Link
      to={to}
      className="-my-2 -mr-2 inline-flex h-10 items-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-fog transition hover:bg-white/5 hover:text-bone"
    >
      {children}
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

function MiniStat({ label, value, icon: Icon, tone }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
      <p className="flex items-center gap-1.5 truncate text-xs text-smoke">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />}
        {label}
      </p>
      <p className={clsx('mt-1 text-xl font-bold tabular-nums leading-none', tone || 'text-bone')}>{value}</p>
    </div>
  );
}

const ALERT_TONE = {
  violet: { box: 'border-ultra/35 bg-ultra/[0.08] hover:bg-ultra/[0.13]', icon: 'bg-ultra/15 text-violet-300' },
  orange: { box: 'border-ember/35 bg-ember/[0.08] hover:bg-ember/[0.13]', icon: 'bg-ember/15 text-ember' },
};

function Alerts({ alerts, tickets }) {
  const items = [];
  if (alerts.pendingReview > 0) {
    items.push({
      key: 'review',
      to: '/staff/admin/compras?estado=in_review',
      tone: 'violet',
      icon: Receipt,
      title: plural(alerts.pendingReview, 'transferencia por revisar', 'transferencias por revisar'),
      text: 'Mira los comprobantes y aprueba o rechaza.',
    });
  }
  if (alerts.conflicts > 0) {
    items.push({
      key: 'conflict',
      to: '/staff/admin/compras?estado=conflict',
      tone: 'orange',
      icon: TriangleAlert,
      title: plural(alerts.conflicts, 'conflicto', 'conflictos'),
      text: 'Pagos que llegaron cuando la habitación ya no estaba libre.',
    });
  }

  if (!items.length) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-toxic/20 bg-toxic/[0.05] px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-toxic">
          <CircleCheck className="h-4 w-4" />
          Nada por revisar
        </span>
        {tickets.pendingPayment > 0 && (
          <Link to="/staff/admin/compras?estado=pending_payment" className="text-fog underline-offset-2 hover:text-bone hover:underline">
            {plural(tickets.pendingPayment, 'compra esperando pago', 'compras esperando pago')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={clsx('grid gap-3', items.length > 1 && 'sm:grid-cols-2')}>
      {items.map((a) => {
        const Icon = a.icon;
        return (
          <Link key={a.key} to={a.to} className={clsx('group flex min-h-18 items-center gap-4 rounded-2xl border px-4 py-3 transition', ALERT_TONE[a.tone].box)}>
            <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', ALERT_TONE[a.tone].icon)}>
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-bone">{a.title}</span>
              <span className="block text-sm text-fog">{a.text}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-fog transition group-hover:translate-x-0.5 group-hover:text-bone" />
          </Link>
        );
      })}
    </div>
  );
}

function CapacityCard({ t }) {
  const left = Math.max(0, t.capacity - t.sold);
  const full = t.capacity > 0 && t.sold >= t.capacity;
  return (
    <Card className="flex flex-col gap-5 sm:p-6">
      <SectionTitle icon={Ticket} action={<span className="text-xs text-fog">Meta: <strong className="text-bone">{formatNumber(t.capacity)}</strong></span>}>
        Entradas vendidas
      </SectionTitle>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <p className="font-display text-6xl leading-none tracking-wide tabular-nums text-bone sm:text-7xl">
          {formatNumber(t.sold)}
          <span className="text-3xl text-smoke sm:text-4xl"> / {formatNumber(t.capacity)}</span>
        </p>
        <div className="pb-1 text-right text-sm text-fog">
          {full ? (
            <Badge tone="amber">Aforo completo</Badge>
          ) : (
            <>
              <strong className="text-lg text-bone tabular-nums">{formatNumber(left)}</strong> {left === 1 ? 'cupo libre' : 'cupos libres'}
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <ProgressBar value={t.sold} max={t.capacity} size="lg" tone="red" markers glow label="Entradas vendidas sobre el aforo" />
        <p className="text-xs text-smoke">
          Generales y cortesías (válidas o ya usadas).
          {t.pendingReview > 0 && ` Las ${t.pendingReview} en revisión también apartan cupo.`} Las habitaciones van aparte.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-fog">Mujeres vs. hombres</p>
          <StackedBar
            segments={[
              { key: 'mujer', label: 'Mujeres', value: t.byGender?.mujer || 0, color: 'bg-blood-light' },
              { key: 'hombre', label: 'Hombres', value: t.byGender?.hombre || 0, color: 'bg-ultra' },
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-fog">Preventa vs. venta general</p>
          <StackedBar
            segments={[
              { key: 'preventa', label: 'Preventa', value: t.byPhase?.preventa || 0, color: 'bg-ember' },
              { key: 'general', label: 'General', value: t.byPhase?.general || 0, color: 'bg-gold' },
            ]}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <MiniStat label="Invitados" value={t.guests} icon={BadgePercent} />
        <MiniStat label="Cortesías" value={t.courtesy} icon={Gift} />
        <MiniStat label="En revisión" value={t.pendingReview} icon={Receipt} tone={t.pendingReview ? 'text-violet-300' : undefined} />
        <MiniStat label="Esperando pago" value={t.pendingPayment} icon={Hourglass} />
      </div>
    </Card>
  );
}

function RoomsCard({ r }) {
  const total = Math.max(0, r.total || 0);
  const squares = Array.from({ length: total }, (_, i) => (i < r.booked ? 'booked' : i < r.booked + r.held ? 'held' : 'free'));
  return (
    <Card className="flex flex-col gap-4 sm:p-6">
      <SectionTitle icon={BedDouble} action={<CardLink to="/staff/admin/habitaciones">Ver</CardLink>}>
        Habitaciones
      </SectionTitle>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <p className="font-display text-5xl leading-none tracking-wide tabular-nums text-bone">
          {r.booked}
          <span className="text-2xl text-smoke"> / {total}</span>
        </p>
        <p className="pb-1 text-sm text-fog">
          reservadas{r.held > 0 && <span className="text-gold"> · {plural(r.held, 'apartada', 'apartadas')}</span>}
        </p>
      </div>
      <div className="flex gap-2" aria-hidden="true">
        {squares.map((s, i) => (
          <span
            key={i}
            className={clsx(
              'h-9 flex-1 rounded-lg border',
              s === 'booked' && 'border-ultra/60 bg-ultra/70',
              s === 'held' && 'border-gold/60 bg-gold/15',
              s === 'free' && 'border-white/10 bg-white/[0.03]',
            )}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-fog">Personas en habitaciones</span>
          <span className="font-semibold tabular-nums text-bone">
            {r.people} / {r.peopleCapacity}
          </span>
        </div>
        <ProgressBar value={r.people} max={r.peopleCapacity} tone="violet" size="md" label="Personas en habitaciones" />
      </div>
    </Card>
  );
}

function DoorCard({ door, income }) {
  const live = door.entries > 0;
  return (
    <Card className={clsx('flex flex-col gap-4 sm:p-6', live && 'border-toxic/25')}>
      <SectionTitle
        icon={DoorOpen}
        action={
          live ? (
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-toxic">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-toxic opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-toxic" />
              </span>
              En vivo
            </span>
          ) : (
            <span className="text-xs text-smoke">Sin ingresos aún</span>
          )
        }
      >
        Puerta en vivo
      </SectionTitle>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className={clsx('font-display text-6xl leading-none tracking-wide tabular-nums', live ? 'text-toxic' : 'text-bone')}>
          {formatNumber(door.inside)}
        </p>
        <p className="pb-1.5 text-sm text-fog">
          adentro ahora
          {door.roomsInside > 0 && <span className="text-bone"> + {door.roomsInside} de habitaciones</span>}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <MiniStat label="Hab. adentro" value={door.roomsInside} />
        <MiniStat label="Ingresos" value={door.entries} />
        <MiniStat label="Ventas puerta" value={door.doorSales} />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-white/[0.06] pt-3 text-sm">
        <span className="text-fog">Recaudo en puerta</span>
        <span className="font-semibold tabular-nums text-bone">{formatCOP(income.door?.total)}</span>
      </div>
      {!live && <p className="-mt-2 text-xs text-smoke">El 31 verás aquí cuánta gente va entrando. Se actualiza cada 30 segundos.</p>}
    </Card>
  );
}

function IncomeCard({ income }) {
  const door = income.door || {};
  const sources = [
    { key: 'tickets', label: 'Entradas (web y manuales)', value: income.tickets, color: 'bg-blood' },
    { key: 'rooms', label: 'Habitaciones', value: income.rooms, color: 'bg-ultra' },
    {
      key: 'door',
      label: 'Puerta',
      value: door.total,
      color: 'bg-ember',
      hint: `Entradas ${formatCOP(door.entries)} · Parqueadero ${formatCOP(door.parking)} · Cascos ${formatCOP(door.helmets)}`,
    },
    { key: 'bar', label: 'Barra', value: income.bar, color: 'bg-gold' },
  ];
  const methods = [
    { key: 'mercadopago', label: 'Mercado Pago', value: income.byMethod?.mercadopago || 0, color: 'bg-ultra' },
    { key: 'transferencia', label: 'Transferencia', value: income.byMethod?.transferencia || 0, color: 'bg-ember' },
    { key: 'manual', label: 'Venta manual', value: income.byMethod?.manual || 0, color: 'bg-bone/70' },
  ];
  return (
    <Card className="flex flex-col gap-5 sm:p-6">
      <SectionTitle icon={Wallet}>Ingresos</SectionTitle>
      <p className="-mt-1 font-display text-5xl leading-none tracking-wide tabular-nums text-bone">{formatCOP(income.total)}</p>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-medium text-fog">Por fuente</p>
          <BarList items={sources} scale="total" />
        </div>
        <div>
          <p className="mb-3 text-xs font-medium text-fog">Compras pagadas, por método</p>
          <StackedBar segments={methods} format={formatCOP} size="lg" legendClassName="flex-col gap-y-2" />
        </div>
      </div>
    </Card>
  );
}

function ExpensesCard({ expenses }) {
  return (
    <Card className="flex flex-col gap-4 sm:p-6">
      <SectionTitle icon={Receipt} action={<CardLink to="/staff/admin/gastos">Ver gastos</CardLink>}>
        Gastos
      </SectionTitle>
      <p className="-mt-1 font-display text-5xl leading-none tracking-wide tabular-nums text-bone">{formatCOP(expenses.total)}</p>
      <StackedBar
        segments={[
          { key: 'paid', label: 'Pagados', value: expenses.paid, color: 'bg-toxic/80' },
          { key: 'pending', label: 'Pendientes', value: expenses.pending, color: 'bg-gold' },
        ]}
        format={formatCOP}
        size="lg"
      />
    </Card>
  );
}

export default function Dashboard() {
  const { data, error, loading, reload } = useFetch((signal) => staffApi('/api/admin/dashboard', { signal }), [], {
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
      title="Resumen"
      description="Ventas, dinero y puerta en tiempo real. Se actualiza solo cada 30 segundos."
      actions={
        data && (
          <div className="flex items-center gap-2">
            <span className={clsx('text-xs', error ? 'text-gold' : 'text-smoke')}>
              {error ? 'Sin conexión · reintentando' : `Actualizado ${formatRelative(updatedAt)}`}
            </span>
            <Button variant="secondary" size="icon" className="h-11 w-11" onClick={refresh} disabled={refreshing} aria-label="Actualizar ahora">
              <RefreshCw className={clsx('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          </div>
        )
      }
    />
  );

  if (loading && !data) return <PageSpinner label="Cargando resumen…" />;
  if (!data) {
    return (
      <>
        {header}
        <ErrorState error={error} onRetry={reload} />
      </>
    );
  }

  const live = data.door?.entries > 0;
  const door = <DoorCard door={data.door} income={data.income} />;

  return (
    <div>
      {header}
      <div className="flex flex-col gap-4">
        <Alerts alerts={data.alerts} tickets={data.tickets} />
        {live && door}
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <CapacityCard t={data.tickets} />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-5">
            <CoverageCard
              income={data.income.total}
              expenses={data.expenses.total}
              coveredPercent={data.balance.coveredPercent}
              net={data.balance.net}
              action={<CardLink to="/staff/admin/gastos">Gastos</CardLink>}
            />
            <RoomsCard r={data.rooms} />
          </div>
          <div className="lg:col-span-7">
            <IncomeCard income={data.income} />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-5">
            <ExpensesCard expenses={data.expenses} />
            {!live && door}
          </div>
        </div>
      </div>
    </div>
  );
}
