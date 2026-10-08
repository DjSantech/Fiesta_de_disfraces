import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Download, FileSpreadsheet } from 'lucide-react';
import { Button, Spinner, useToast } from '../../ui';
import { downloadFile } from '../../../lib/api';
import { exportFilename } from './utils';

/**
 * Exportar CSV (abre en Excel con tildes). options: [{ dataset: 'orders', slug: 'compras', label: 'Compras' }]
 * Con una sola opción es un botón directo; con varias, un menú.
 */
export default function ExportMenu({ options, label = 'Exportar', className }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = async (opt) => {
    setBusy(opt.dataset);
    try {
      await downloadFile(`/api/admin/export/${opt.dataset}.csv`, exportFilename(opt.slug));
      toast.success(`Descargando ${opt.label.toLowerCase()} (CSV)`);
      setOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (options.length === 1) {
    const opt = options[0];
    return (
      <Button variant="secondary" className={className} loading={busy === opt.dataset} onClick={() => run(opt)}>
        {busy !== opt.dataset && <Download className="h-4 w-4" />}
        {label}
      </Button>
    );
  }

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <Button variant="secondary" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <Download className="h-4 w-4" />
        {label}
        <ChevronDown className={clsx('h-4 w-4 transition', open && 'rotate-180')} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-white/10 bg-tomb p-1.5 shadow-2xl shadow-black/60"
        >
          {options.map((opt) => (
            <button
              key={opt.dataset}
              type="button"
              role="menuitem"
              disabled={Boolean(busy)}
              onClick={() => run(opt)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-bone transition hover:bg-white/[0.06] disabled:opacity-60"
            >
              {busy === opt.dataset ? <Spinner className="h-4 w-4 text-fog" /> : <FileSpreadsheet className="h-4 w-4 text-fog" />}
              <span className="flex-1">{opt.label}</span>
              <span className="text-xs text-smoke">CSV</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
