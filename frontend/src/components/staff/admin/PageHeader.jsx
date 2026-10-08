import clsx from 'clsx';

/** Encabezado de cada sección del admin: overline + título grande + acciones. */
export default function PageHeader({ title, description, actions, overline = 'Panel del organizador', className }) {
  return (
    <header className={clsx('mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blood-light/80">{overline}</p>
        <h1 className="mt-1.5 font-display text-[2rem] uppercase leading-none tracking-wide text-bone sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fog">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}

/** Título de bloque dentro de una tarjeta. */
export function SectionTitle({ icon: Icon, children, action, className }) {
  return (
    <div className={clsx('flex items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-smoke">
        {Icon && <Icon className="h-4 w-4 text-fog" strokeWidth={1.75} />}
        {children}
      </h2>
      {action}
    </div>
  );
}
