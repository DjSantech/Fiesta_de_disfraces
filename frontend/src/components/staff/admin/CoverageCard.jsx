import clsx from 'clsx';
import { PartyPopper, TrendingDown } from 'lucide-react';
import { formatCOP, formatPercent } from '../../../lib/format';
import { ProgressBar } from './Charts';

/**
 * "GASTOS LIBRADOS": cuánto de los gastos ya cubren los ingresos.
 * Rojo mientras falte; verde al llegar al 100 %.
 */
export default function CoverageCard({ income = 0, expenses = 0, coveredPercent, net, action, className }) {
  const percent = typeof coveredPercent === 'number' ? coveredPercent : expenses > 0 ? Math.min(100, (income / expenses) * 100) : 100;
  const balance = typeof net === 'number' ? net : income - expenses;
  const covered = percent >= 100 && balance >= 0;
  const missing = Math.max(0, -balance);

  return (
    <section
      className={clsx(
        'relative overflow-hidden rounded-2xl border p-5 sm:p-6',
        covered ? 'border-toxic/30 bg-crypt/90' : 'border-blood/25 bg-crypt/90',
        className,
      )}
      aria-label="Gastos librados"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: covered
            ? 'radial-gradient(70% 90% at 100% 0%, rgb(34 229 132 / 0.10), transparent 65%)'
            : 'radial-gradient(70% 90% at 100% 0%, rgb(225 29 46 / 0.12), transparent 65%)',
        }}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-fog">Gastos librados</p>
          {action}
        </div>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p
            className={clsx(
              'font-display text-6xl leading-none tabular-nums tracking-wide sm:text-7xl',
              covered ? 'text-toxic' : 'text-blood-light',
            )}
          >
            {formatPercent(percent)}
          </p>
          <p className="pb-1 text-sm text-fog">
            de {formatCOP(expenses)} en gastos
          </p>
        </div>

        <ProgressBar value={percent} max={100} tone={covered ? 'green' : 'red'} size="xl" markers glow className="mt-4" label="Porcentaje de gastos cubiertos" />

        <p className={clsx('mt-4 flex items-start gap-2 text-base font-semibold sm:text-lg', covered ? 'text-toxic' : 'text-bone')}>
          {covered ? (
            <>
              <PartyPopper className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
              <span>
                ¡Gastos librados! Ganancia: <span className="tabular-nums">{formatCOP(balance)}</span>
              </span>
            </>
          ) : (
            <>
              <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-blood-light" strokeWidth={1.75} />
              <span>
                Faltan <span className="tabular-nums text-blood-light">{formatCOP(missing)}</span> para librar los gastos
              </span>
            </>
          )}
        </p>
        {expenses === 0 && <p className="mt-1 text-sm text-fog">Aún no has registrado gastos.</p>}

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-4">
          <div className="min-w-0">
            <dt className="text-xs text-smoke">Ingresos</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-bone sm:text-base">{formatCOP(income)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-smoke">Gastos</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-bone sm:text-base">{formatCOP(expenses)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-smoke">Balance neto</dt>
            <dd
              className={clsx(
                'mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base',
                balance >= 0 ? 'text-toxic' : 'text-blood-light',
              )}
            >
              {balance > 0 ? '+' : ''}
              {formatCOP(balance)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
