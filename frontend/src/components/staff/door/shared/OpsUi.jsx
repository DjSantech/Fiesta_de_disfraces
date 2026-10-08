// Piezas de interfaz compartidas por Portería y Barra (dueño: Agente Operaciones).
import { useState } from 'react';
import clsx from 'clsx';
import { Banknote, CreditCard, Gift, RefreshCw, Smartphone, Wallet, WifiOff } from 'lucide-react';
import { Button, EmptyState, Modal, Segmented, Spinner, Textarea } from '../../../ui';
import { POS_METHOD_LABEL } from '../../../../lib/labels';
import { formatRelative } from '../../../../lib/format';
import { useOnline } from './hooks';
import { errorMessage, isConnectionError } from './errors';

const METHOD_ICONS = { efectivo: Banknote, nequi: Smartphone, daviplata: Wallet, tarjeta: CreditCard, cortesia: Gift };

export const PAY_METHOD_OPTIONS = Object.keys(POS_METHOD_LABEL).map((value) => ({
  value,
  label: POS_METHOD_LABEL[value],
  icon: METHOD_ICONS[value],
}));

/** Botones grandes de método de pago (posMethod). */
export function PayMethodPicker({ value, onChange, className, size = 'md' }) {
  return (
    <Segmented
      options={PAY_METHOD_OPTIONS}
      value={value}
      onChange={onChange}
      size={size}
      minWidth={96}
      ariaLabel="Método de pago"
      className={clsx('[&>button]:min-h-14', className)}
    />
  );
}

/** Aviso visible cuando no hay red o el servidor no responde: "Sin conexión · Reintentar". */
export function ConnectionBanner({ error, onRetry, className }) {
  const online = useOnline();
  const [retrying, setRetrying] = useState(false);
  if (online && !error) return null;
  const offline = !online || isConnectionError(error);

  const retry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className={clsx(
        'flex items-center gap-3 rounded-2xl border px-4 py-2',
        offline ? 'border-gold/50 bg-gold/15 text-gold' : 'border-blood/40 bg-blood/15 text-blood-light',
        className,
      )}
    >
      <WifiOff className="h-5 w-5 shrink-0" strokeWidth={2} />
      <p className="min-w-0 flex-1 text-sm font-semibold leading-tight">
        {offline ? (
          <>
            Sin conexión
            <span className="font-normal text-bone/80"> · {online ? 'el servidor no responde' : 'revisa el internet'}</span>
          </>
        ) : (
          error.message
        )}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="-my-1 flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-bone transition hover:bg-white/10 disabled:opacity-60"
        >
          {retrying ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Error de carga inicial (sin datos que mostrar) con botón de reintento. */
export function LoadError({ error, onRetry, title = 'No pudimos cargar', className }) {
  return (
    <EmptyState
      icon={WifiOff}
      title={isConnectionError(error) ? 'Sin conexión' : title}
      description={errorMessage(error)}
      className={className}
      action={
        onRetry && (
          <Button size="lg" variant="secondary" onClick={() => onRetry()}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        )
      }
    />
  );
}

/** Título de sección pequeño (overline). */
export function Overline({ children, className }) {
  return <p className={clsx('text-xs font-semibold uppercase tracking-[0.3em] text-smoke', className)}>{children}</p>;
}

/** "Actualizado hace un momento" + botón de refresco. */
export function RefreshLine({ loadedAt, onRefresh, refreshing, className }) {
  return (
    <div className={clsx('flex items-center justify-between gap-3 text-xs text-smoke', className)}>
      <span>{loadedAt ? `Actualizado ${formatRelative(loadedAt)}` : 'Cargando…'}</span>
      {onRefresh && (
        <button
          type="button"
          onClick={() => onRefresh()}
          className="-my-2 flex h-11 items-center gap-1.5 rounded-xl px-3 font-semibold text-fog transition hover:bg-white/5 hover:text-bone"
        >
          <RefreshCw className={clsx('h-4 w-4', refreshing && 'animate-spin')} />
          Actualizar
        </button>
      )}
    </div>
  );
}

/** Botón "Cargar más" de listas paginadas. */
export function LoadMore({ list, label = 'Cargar más' }) {
  if (!list.hasMore) return null;
  return (
    <div className="flex justify-center pt-2">
      <Button variant="secondary" size="lg" loading={list.loadingMore} onClick={list.loadMore} className="min-w-48">
        {label}
        <span className="font-normal text-smoke">
          ({list.items.length} de {list.total})
        </span>
      </Button>
    </div>
  );
}

/**
 * Confirmación con motivo obligatorio (anular entrada / venta).
 * onConfirm(reason) debe devolver una promesa; si falla, el modal sigue abierto.
 */
export function ReasonModal({ open, onClose, title, description, confirmLabel = 'Anular', quickReasons = [], onConfirm, children }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = reason.trim().length >= 3;

  const close = () => {
    if (busy) return;
    setReason('');
    onClose?.();
  };

  const confirm = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
    } catch {
      /* el llamador ya mostró el error */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={close} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" size="lg" onClick={confirm} loading={busy} disabled={!valid}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {children}
        <Textarea
          label="Motivo"
          required
          rows={2}
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Escribe el motivo"
          hint="Mínimo 3 caracteres. Queda en el registro."
        />
        {quickReasons.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quickReasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={clsx(
                  'min-h-11 rounded-xl border px-3 text-sm font-medium transition',
                  reason === r ? 'border-blood bg-blood/15 text-bone' : 'border-white/10 bg-tomb/60 text-fog hover:text-bone',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Clases para que las pestañas compartidas (Tabs) tengan objetivos de 48 px y quepan a 360 px. */
export const OPS_TABS_CLASS =
  '[&>button]:h-auto [&>button]:min-h-12 [&>button]:flex-col [&>button]:gap-1 [&>button]:px-1 [&>button]:py-1.5 ' +
  '[&>button]:text-[11px] min-[400px]:[&>button]:text-xs [&>button>svg]:h-5 [&>button>svg]:w-5 ' +
  'sm:[&>button]:flex-row sm:[&>button]:gap-2 sm:[&>button]:px-3 sm:[&>button]:text-sm';
