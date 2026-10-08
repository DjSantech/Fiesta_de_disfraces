import clsx from 'clsx';
import { formatCOP } from '../../../lib/format';

const FILL = {
  red: 'bg-linear-to-r from-danger-dark via-danger to-danger-light',
  green: 'bg-linear-to-r from-toxic/80 to-toxic',
  amber: 'bg-gold',
  violet: 'bg-ultra',
  ember: 'bg-ember',
  bone: 'bg-bone/80',
};

const TRACK_GLOW = {
  red: 'shadow-[0_0_26px_-8px_rgb(229_72_77/0.85)]',
  green: 'shadow-[0_0_30px_-6px_rgb(34_229_132/0.75)]',
};

const HEIGHT = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5', lg: 'h-4', xl: 'h-6' };

/** Barra de progreso. <ProgressBar value={37} max={100} tone="red|green|amber|violet|ember" size="xs…xl" markers glow /> */
export function ProgressBar({ value = 0, max = 100, tone = 'red', size = 'md', markers = false, glow = false, label, className }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(Number(value) || 0)}
      className={clsx(
        'relative w-full overflow-hidden rounded-full bg-white/[0.07] ring-1 ring-inset ring-white/[0.05]',
        HEIGHT[size],
        glow && pct > 0 && TRACK_GLOW[tone],
        className,
      )}
    >
      <div
        className={clsx('h-full rounded-full transition-[width] duration-700 ease-out', FILL[tone] || FILL.red)}
        style={{ width: `${pct}%`, minWidth: pct > 0 ? '0.375rem' : 0 }}
      />
      {markers &&
        [25, 50, 75].map((m) => (
          <span key={m} className="absolute inset-y-0 w-px bg-ink/70" style={{ left: `${m}%` }} aria-hidden="true" />
        ))}
    </div>
  );
}

/**
 * Lista de barras horizontales.
 * items: [{ key, label, value, color?: 'bg-…', hint? }]
 * scale: 'max' (relativo al mayor) | 'total' (participación sobre la suma)
 */
export function BarList({ items, format = formatCOP, scale = 'max', className, emptyText = 'Sin datos todavía' }) {
  const total = items.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const ref = scale === 'total' ? total : Math.max(0, ...items.map((i) => Number(i.value) || 0));
  if (!items.length) return <p className="text-sm text-smoke">{emptyText}</p>;
  return (
    <ul className={clsx('flex flex-col gap-3.5', className)}>
      {items.map((item) => {
        const value = Number(item.value) || 0;
        const pct = ref > 0 ? (value / ref) * 100 : 0;
        return (
          <li key={item.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-fog">{item.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-bone">{format(value)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={clsx('h-full rounded-full transition-[width] duration-700', item.color || 'bg-pumpkin')}
                style={{ width: `${pct}%`, minWidth: value > 0 ? '0.375rem' : 0 }}
              />
            </div>
            {item.hint && <p className="mt-1 text-xs text-smoke">{item.hint}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Una sola barra dividida en segmentos + leyenda.
 * segments: [{ key, label, value, color: 'bg-…', dot?: 'bg-…' }]
 */
export function StackedBar({ segments, format = (v) => v, size = 'md', showPercent = true, className, legendClassName }) {
  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  return (
    <div className={clsx('flex flex-col gap-2.5', className)}>
      <div className={clsx('flex w-full gap-0.5 overflow-hidden rounded-full bg-white/[0.07]', HEIGHT[size])}>
        {total > 0 &&
          segments.map((s) =>
            Number(s.value) > 0 ? (
              <div
                key={s.key}
                className={clsx('h-full first:rounded-l-full last:rounded-r-full', s.color)}
                style={{ width: `${(Number(s.value) / total) * 100}%`, minWidth: '0.375rem' }}
                title={`${s.label}: ${format(s.value)}`}
              />
            ) : null,
          )}
      </div>
      <ul className={clsx('flex flex-wrap gap-x-4 gap-y-1.5 text-xs', legendClassName)}>
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-fog">
            <span className={clsx('h-2 w-2 shrink-0 rounded-full', s.dot || s.color)} aria-hidden="true" />
            <span>{s.label}</span>
            <span className="font-semibold tabular-nums text-bone">{format(s.value)}</span>
            {showPercent && total > 0 && (
              <span className="tabular-nums text-smoke">· {Math.round((Number(s.value) / total) * 100)}%</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
