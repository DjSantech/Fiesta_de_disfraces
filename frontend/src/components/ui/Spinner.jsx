import clsx from 'clsx';

export default function Spinner({ className, label = 'Cargando' }) {
  return (
    <svg className={clsx('h-5 w-5 animate-spin', className)} viewBox="0 0 24 24" fill="none" role="status" aria-label={label}>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Spinner centrado para pantallas o secciones que cargan. */
export function PageSpinner({ label = 'Cargando…', className }) {
  return (
    <div className={clsx('flex min-h-[40vh] flex-col items-center justify-center gap-3 text-fog', className)}>
      <Spinner className="h-7 w-7 text-pumpkin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
