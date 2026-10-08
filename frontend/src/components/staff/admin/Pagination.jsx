import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../ui';
import { formatNumber } from '../../../lib/format';

/** "1–30 de 87" + anterior/siguiente. No se muestra si todo cabe en una página. */
export default function Pagination({ page, limit, total, onChange, className }) {
  if (!total || total <= limit) return null;
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  const go = (p) => {
    onChange(Math.min(pages, Math.max(1, p)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav aria-label="Paginación" className={clsx('flex items-center justify-between gap-3 pt-4', className)}>
      <p className="text-sm tabular-nums text-fog">
        {formatNumber(from)}–{formatNumber(to)} <span className="text-smoke">de {formatNumber(total)}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="icon" className="h-11 w-11" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="min-w-14 text-center text-sm tabular-nums text-fog">
          {page} / {pages}
        </span>
        <Button variant="secondary" size="icon" className="h-11 w-11" disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Página siguiente">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </nav>
  );
}
