import clsx from 'clsx';
import { formatNumber } from '../../../lib/format';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-10-14' → '14 oct' */
export function shortDay(day) {
  const [, m, d] = String(day).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] || ''}`.trim();
}

/** Punto con pulso: verde y latiendo si hay gente conectada, gris si no. */
export function LivePulse({ active = false, className }) {
  return (
    <span className={clsx('relative inline-flex h-3 w-3 shrink-0', className)} aria-hidden="true">
      {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-toxic opacity-60" />}
      <span className={clsx('relative inline-flex h-3 w-3 rounded-full', active ? 'bg-toxic shadow-[0_0_12px_rgb(34_229_132/0.8)]' : 'bg-smoke/60')} />
    </span>
  );
}

/**
 * Barras por día (CSS puro). days: [{ day, visitors, pageviews }]. Altura relativa al máximo de visitantes.
 * Etiquetas de fecha cada cierto número de barras, siempre en la última.
 */
export function DayBars({ days, height = 'h-28', showLabels = true, className }) {
  const max = Math.max(1, ...days.map((d) => d.visitors));
  const total = days.length;
  const labelEvery = total <= 8 ? 1 : total <= 16 ? 3 : total <= 35 ? 7 : 15;
  return (
    <div className={className}>
      <div className={clsx('flex items-end gap-[3px]', height)} role="img" aria-label={`Visitantes por día, últimos ${total} días`}>
        {days.map((d, i) => {
          const pct = (d.visitors / max) * 100;
          const last = i === total - 1;
          return (
            <div
              key={d.day}
              className="group relative flex h-full min-w-0 flex-1 items-end"
              title={`${shortDay(d.day)}: ${formatNumber(d.visitors)} visitantes · ${formatNumber(d.pageviews)} páginas vistas`}
            >
              <div
                className={clsx(
                  'w-full rounded-t-[3px] transition-[height] duration-500',
                  d.visitors === 0 ? 'bg-white/10' : last ? 'bg-pumpkin' : 'bg-pumpkin/45 group-hover:bg-pumpkin/80',
                )}
                style={{ height: d.visitors === 0 ? '3px' : `${Math.max(pct, 4)}%` }}
              />
            </div>
          );
        })}
      </div>
      {showLabels && total > 1 && (
        <div className="mt-1.5 flex gap-[3px] text-[10px] text-smoke">
          {days.map((d, i) => {
            const show = i === total - 1 || (i % labelEvery === 0 && total - 1 - i >= labelEvery);
            return (
              <span key={d.day} className="relative min-w-0 flex-1">
                {show && <span className={clsx('absolute top-0 whitespace-nowrap', i === total - 1 ? 'right-0' : 'left-0')}>{shortDay(d.day)}</span>}
                <span className="invisible">.</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
