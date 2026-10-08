import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Ban, Car, CircleCheckBig, Clock, HardHat, IdCard, RefreshCw, ShieldX, TriangleAlert, UserRound, WifiOff } from 'lucide-react';
import { Button, useToast } from '../../ui';
import { formatCOP, formatRelative, formatTime } from '../../../lib/format';
import { POS_METHOD_LABEL, VEHICLE_LABEL } from '../../../lib/labels';
import ExtrasFields from './ExtrasFields';
import {
  EMPTY_EXTRAS,
  categoryLabel,
  doorApi,
  extrasBody,
  extrasTotal,
  genderLabel,
  mapFieldErrors,
  ticketTypeLabel,
  validateExtras,
} from './doorUtils';
import { signal as feedback } from './feedback';
import { PayMethodPicker } from './shared/OpsUi';
import { useBodyScrollLock, useSingleFlight } from './shared/hooks';
import { errorMessage, isConnectionError } from './shared/errors';

const TONES = {
  green: 'bg-toxic text-ink',
  red: 'bg-blood text-white',
  amber: 'bg-gold text-ink',
};

/** Contenedor a pantalla completa, por encima del encabezado del staff. */
function Screen({ tone, labelledBy, onEscape, children }) {
  const ref = useRef(null);
  useBodyScrollLock(true);
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') escapeRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <div
      ref={ref}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={clsx(
        'fixed inset-0 z-[60] overflow-y-auto overscroll-contain outline-none transition-[opacity,transform] duration-150 ease-out starting:scale-[0.97] starting:opacity-0',
        TONES[tone],
      )}
    >
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Chip({ children, className }) {
  return (
    <span className={clsx('inline-flex min-h-8 items-center rounded-full bg-black/15 px-3 text-sm font-bold uppercase tracking-wide', className)}>
      {children}
    </span>
  );
}

function StatusTitle({ id, icon: Icon, children, sub }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Icon className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" strokeWidth={2.4} aria-hidden="true" />
        <h2 id={id} className="font-display text-[3.4rem] uppercase leading-[0.95] tracking-wide sm:text-7xl">
          {children}
        </h2>
      </div>
      {sub && <p className="mt-1 font-display text-2xl uppercase tracking-wide opacity-90">{sub}</p>}
    </div>
  );
}

function HolderName({ children }) {
  return <p className="mt-4 break-words text-[2.1rem] font-extrabold leading-[1.08] sm:text-5xl">{children}</p>;
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-80" strokeWidth={2} aria-hidden="true" />
      <p className="min-w-0 text-lg leading-snug">
        <span className="font-medium opacity-80">{label}: </span>
        <span className="font-bold">{children}</span>
      </p>
    </div>
  );
}

function cedulaText(ticket) {
  return ticket?.cedulaLast4 ? `CC ••••${ticket.cedulaLast4}` : 'Sin cédula registrada';
}

/**
 * Resultado de un escaneo / check-in a pantalla completa (legible a 2 metros).
 * result: { status: 'valid'|'used'|'void'|'not_found'|'error', ticket, entry, value, error }
 * - valid: formulario de vehículo/casco/pago + CONFIRMAR INGRESO → POST /api/door/checkin.
 * - Tras el check-in muestra "INGRESO REGISTRADO" y se cierra solo.
 * onClose({ checkedIn, entry })
 */
export default function ResultScreen({ result, config, initialExtras, initialMethod = 'efectivo', onClose, onChanged, onRetry }) {
  const toast = useToast();
  const titleId = useId();
  const [view, setView] = useState(result.status);
  const [usedInfo, setUsedInfo] = useState(null);
  const [extras, setExtras] = useState(() => ({ ...EMPTY_EXTRAS, ...initialExtras }));
  const [method, setMethod] = useState(initialMethod);
  const [errors, setErrors] = useState({});
  const [busy, run] = useSingleFlight();
  const [entry, setEntry] = useState(null);
  const ticket = result.ticket;

  const charges = extrasTotal(config, extras);
  const total = method === 'cortesia' ? 0 : charges;

  const close = useCallback(
    (payload) => {
      if (busy) return;
      onClose?.(payload || { checkedIn: false });
    },
    [busy, onClose],
  );

  const confirm = () =>
    run(async () => {
      const errs = validateExtras(extras);
      if (Object.keys(errs).length) {
        setErrors(errs);
        feedback('bad');
        return;
      }
      setErrors({});
      const { vehicle, helmet } = extrasBody(extras);
      const body = { ticketId: ticket.id };
      if (vehicle) body.vehicle = vehicle;
      if (helmet) body.helmet = helmet;
      if (charges > 0) body.paymentMethod = method;
      try {
        const data = await doorApi.checkin(body);
        feedback('ok');
        setEntry(data.entry);
        setView('done');
        onChanged?.();
      } catch (err) {
        if (err.code === 'TICKET_ALREADY_USED') {
          feedback('bad');
          setUsedInfo(err.details || {});
          setView('used');
          onChanged?.();
        } else if (err.code === 'TICKET_VOID') {
          feedback('bad');
          setView('void');
        } else if (err.code === 'VALIDATION_ERROR') {
          setErrors(mapFieldErrors(err));
          toast.error(err.message);
        } else {
          toast.error(errorMessage(err));
        }
      }
    });

  // ─────────── Ingreso registrado ───────────
  if (view === 'done') {
    return <EntryDoneScreen entry={entry} fallbackName={ticket?.holderName} onClose={() => onClose?.({ checkedIn: true, entry })} />;
  }

  // ─────────── Válida ───────────
  if (view === 'valid') {
    return (
      <Screen tone="green" labelledBy={titleId} onEscape={() => close()}>
        <header className="px-1">
          <StatusTitle id={titleId} icon={CircleCheckBig}>
            Válida
          </StatusTitle>
          <HolderName>{ticket.holderName}</HolderName>
          <p className="mt-2 flex items-center gap-2 text-lg font-bold">
            <IdCard className="h-6 w-6 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            <span>
              {cedulaText(ticket)} <span className="font-semibold opacity-80">· verifica el documento</span>
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip className="bg-ink text-toxic">{ticketTypeLabel(ticket)}</Chip>
            {ticket.gender && <Chip>{genderLabel(ticket.gender)}</Chip>}
            <Chip className="font-mono normal-case tracking-normal">{ticket.code}</Chip>
          </div>
          {ticket.buyerName && ticket.buyerName !== ticket.holderName && (
            <p className="mt-2 text-base font-semibold opacity-80">Compra de {ticket.buyerName}</p>
          )}
        </header>

        <div className="mt-4 flex flex-1 flex-col gap-4 rounded-3xl bg-ink p-4 text-bone shadow-2xl shadow-black/30 sm:p-5">
          <ExtrasFields value={extras} onChange={setExtras} config={config} errors={errors} />

          {charges > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-bone/90">Pago de parqueadero / casco</p>
              <PayMethodPicker value={method} onChange={setMethod} />
            </div>
          )}

          <div className="mt-auto flex flex-col gap-3 pt-1">
            <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-3">
              <span className="text-sm text-fog">{charges > 0 ? 'A cobrar ahora' : 'Entrada ya pagada'}</span>
              <span className="text-2xl font-extrabold tabular-nums">
                {charges > 0 ? formatCOP(total) : 'Sin cobro'}
                {charges > 0 && method === 'cortesia' && <span className="ml-2 text-sm font-semibold text-fog">cortesía</span>}
              </span>
            </div>
            <Button variant="success" size="xl" block loading={busy} onClick={confirm} className="h-[4.5rem] text-xl font-extrabold tracking-wide">
              CONFIRMAR INGRESO
            </Button>
            <Button variant="ghost" size="lg" block onClick={() => close()} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  // ─────────── Sin conexión al verificar ───────────
  if (view === 'error') {
    const offline = isConnectionError(result.error);
    return (
      <Screen tone="amber" labelledBy={titleId} onEscape={() => close()}>
        <StatusTitle id={titleId} icon={offline ? WifiOff : TriangleAlert} sub="No se pudo verificar">
          {offline ? 'Sin conexión' : 'Error'}
        </StatusTitle>
        <p className="mt-5 text-xl font-semibold leading-snug">{errorMessage(result.error)}</p>
        <p className="mt-3 text-lg leading-snug opacity-80">No dejes pasar sin verificar. Reintenta en unos segundos.</p>
        <div className="mt-auto flex flex-col gap-3 pt-8">
          {onRetry && (
            <Button size="xl" block onClick={onRetry} className="h-[4.5rem] bg-ink text-xl text-bone hover:bg-ink/90">
              <RefreshCw className="h-6 w-6" />
              Reintentar
            </Button>
          )}
          <Button size="lg" block onClick={() => close()} className="bg-black/15 text-ink hover:bg-black/25">
            Volver
          </Button>
        </div>
      </Screen>
    );
  }

  // ─────────── Inválidas (rojo) ───────────
  const usedAt = usedInfo?.checkedInAt || ticket?.checkedInAt || result.entry?.createdAt;
  const usedBy = usedInfo?.checkedInByName || ticket?.checkedInByName || result.entry?.createdBy?.name;
  const usedEntry = result.entry;

  return (
    <Screen tone="red" labelledBy={titleId} onEscape={() => close()}>
      {view === 'used' && (
        <>
          <StatusTitle id={titleId} icon={ShieldX}>
            Ya ingresó
          </StatusTitle>
          {ticket?.holderName && <HolderName>{ticket.holderName}</HolderName>}
          <div className="mt-5 rounded-3xl bg-black/25 px-4 py-2">
            <InfoRow icon={Clock} label="Entró">
              {usedAt ? `${formatTime(usedAt)} · ${formatRelative(usedAt)}` : 'Hora no disponible'}
            </InfoRow>
            <InfoRow icon={UserRound} label="Registró">
              {usedBy || '—'}
            </InfoRow>
            {ticket && (
              <InfoRow icon={IdCard} label="Entrada">
                {ticketTypeLabel(ticket)} · {cedulaText(ticket)} · <span className="font-mono">{ticket.code}</span>
              </InfoRow>
            )}
            {usedEntry?.vehicle?.type && (
              <InfoRow icon={Car} label="Vehículo">
                {VEHICLE_LABEL[usedEntry.vehicle.type]} {usedEntry.vehicle.plate}
              </InfoRow>
            )}
          </div>
          <p className="mt-4 text-lg font-semibold leading-snug">No permitas un segundo ingreso con esta entrada.</p>
        </>
      )}

      {view === 'void' && (
        <>
          <StatusTitle id={titleId} icon={Ban}>
            Entrada anulada
          </StatusTitle>
          {ticket?.holderName && <HolderName>{ticket.holderName}</HolderName>}
          {ticket?.code && <p className="mt-3 font-mono text-xl font-bold">{ticket.code}</p>}
          <p className="mt-5 text-xl font-semibold leading-snug">Esta entrada fue anulada y no permite el ingreso.</p>
        </>
      )}

      {view === 'not_found' && (
        <>
          <StatusTitle id={titleId} icon={ShieldX} sub="QR inválido">
            No existe
          </StatusTitle>
          <p className="mt-5 text-xl font-semibold leading-snug">Este código no corresponde a ninguna entrada.</p>
          {result.value && (
            <p className="mt-4 break-all rounded-2xl bg-black/25 px-4 py-3 font-mono text-base">
              {result.value.length > 90 ? `${result.value.slice(0, 90)}…` : result.value}
            </p>
          )}
          <p className="mt-4 text-lg leading-snug opacity-90">Pide la entrada original o busca a la persona por cédula.</p>
        </>
      )}

      <div className="mt-auto pt-8">
        <Button size="xl" block onClick={() => close()} className="h-[4.5rem] bg-white text-xl font-extrabold text-blood-dark hover:bg-white/90">
          VOLVER A ESCANEAR
        </Button>
      </div>
    </Screen>
  );
}

/**
 * Confirmación "ADELANTE · Ingreso registrado" con los montos que devolvió el backend.
 * Se cierra sola (o al tocar en cualquier parte).
 */
export function EntryDoneScreen({ entry, fallbackName, onClose, autoCloseMs }) {
  const titleId = useId();
  const totalAmount = entry?.totalAmount ?? 0;
  const delay = autoCloseMs ?? (totalAmount > 0 || entry?.helmet?.stored ? 4200 : 2200);
  const [armed, setArmed] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const closedRef = useRef(false);
  const finish = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    closeRef.current?.();
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setArmed(true));
    const timer = setTimeout(finish, delay);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [delay, finish]);

  const lines = [
    entry?.source === 'door_sale' && {
      label: `Entrada ${categoryLabel(entry.category).toLowerCase()}${entry.category === 'invitado' && entry.gender ? ` (${genderLabel(entry.gender).toLowerCase()})` : ''}`,
      amount: entry.entryAmount,
    },
    entry?.vehicle?.type && {
      label: `Parqueadero ${(VEHICLE_LABEL[entry.vehicle.type] || '').toLowerCase()} · ${entry.vehicle.plate || ''}`,
      amount: entry.parkingAmount,
    },
    entry?.helmet?.stored && { label: `Casco${entry.helmet.tag ? ` · ficha ${entry.helmet.tag}` : ''}`, amount: entry.helmetAmount },
  ].filter(Boolean);

  return (
    <Screen tone="green" labelledBy={titleId} onEscape={finish}>
      {/* Tocar en cualquier parte cierra la confirmación. */}
      <div onClick={finish} className="flex flex-1 cursor-pointer flex-col">
        <StatusTitle id={titleId} icon={CircleCheckBig} sub="Ingreso registrado">
          Adelante
        </StatusTitle>
        <HolderName>{entry?.name || fallbackName}</HolderName>
        {lines.length > 0 && (
          <div className="mt-5 rounded-3xl bg-ink px-5 py-4 text-bone">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fog">{totalAmount > 0 ? 'Cobra' : 'Total'}</p>
            <p className="text-5xl font-extrabold tabular-nums text-toxic">{formatCOP(totalAmount)}</p>
            <p className="mt-1 text-lg font-semibold">{POS_METHOD_LABEL[entry.paymentMethod] || entry.paymentMethod}</p>
            <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-base text-fog">
              {lines.map((l) => (
                <p key={l.label} className="flex justify-between gap-3">
                  <span className="min-w-0">{l.label}</span>
                  <span className="shrink-0 tabular-nums text-bone">{formatCOP(l.amount)}</span>
                </p>
              ))}
            </div>
          </div>
        )}
        {entry?.helmet?.stored && (
          <p className="mt-4 flex items-center gap-2 text-2xl font-extrabold">
            <HardHat className="h-7 w-7 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            {entry.helmet.tag ? `Entrega la ficha ${entry.helmet.tag}` : 'Casco guardado (sin ficha)'}
          </p>
        )}
        <div className="mt-auto pt-8">
          <div className="h-1.5 overflow-hidden rounded-full bg-black/15">
            <div className="h-full rounded-full bg-ink/70" style={{ width: armed ? '0%' : '100%', transition: `width ${delay}ms linear` }} />
          </div>
          <Button
            size="lg"
            block
            onClick={(e) => {
              e.stopPropagation();
              finish();
            }}
            className="mt-4 bg-ink text-bone hover:bg-ink/90"
          >
            Seguir
          </Button>
        </div>
      </div>
    </Screen>
  );
}
