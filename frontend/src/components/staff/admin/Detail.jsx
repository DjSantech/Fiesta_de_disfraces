import clsx from 'clsx';

/** Bloque con título dentro de un detalle (modal). */
export function DetailSection({ title, icon: Icon, action, children, className }) {
  return (
    <section className={clsx('flex flex-col gap-3', className)}>
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-smoke">
          {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Lista de pares etiqueta → valor (2 columnas desde sm). */
export function DetailGrid({ children, className }) {
  return <dl className={clsx('grid grid-cols-2 gap-x-5 gap-y-3.5', className)}>{children}</dl>;
}

export function DetailItem({ label, children, full = false, mono = false, className }) {
  const empty = children === null || children === undefined || children === '' || children === false;
  return (
    <div className={clsx('min-w-0', full && 'col-span-2', className)}>
      <dt className="text-xs text-smoke">{label}</dt>
      <dd className={clsx('mt-0.5 break-words text-sm text-bone', mono && 'font-mono text-[13px] tracking-wide', empty && 'text-smoke')}>
        {empty ? '—' : children}
      </dd>
    </div>
  );
}
