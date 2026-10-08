import clsx from 'clsx';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { Button } from '../../ui';

/** Error de carga con botón para reintentar. */
export default function ErrorState({ error, onRetry, title = 'No pudimos cargar esta información', className }) {
  return (
    <div
      role="alert"
      className={clsx(
        'flex flex-col items-center gap-3 rounded-2xl border border-blood/25 bg-blood/[0.06] px-6 py-10 text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blood/10 text-blood-light">
        <CircleAlert className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <p className="font-semibold text-bone">{title}</p>
      <p className="max-w-sm text-sm text-fog">{error?.message || 'Intenta de nuevo en un momento.'}</p>
      {onRetry && (
        <Button variant="secondary" onClick={() => onRetry()} className="mt-1">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
