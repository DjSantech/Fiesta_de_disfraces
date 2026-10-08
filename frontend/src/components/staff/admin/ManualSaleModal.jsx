import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { BedDouble, CircleCheck, Plus, ShowerHead, Ticket, Trash2, UserRoundPlus } from 'lucide-react';
import { Badge, Button, Input, Modal, PageSpinner, Segmented, Textarea, useToast } from '../../ui';
import { staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatCOP } from '../../../lib/format';
import { GENDER_LABEL, MANUAL_METHOD_LABEL, PHASE_LABEL, ROOM_STATUS_LABEL, TICKET_STATUS_LABEL, toOptions } from '../../../lib/labels';
import CopyButton from './CopyButton';
import ErrorState from './ErrorState';
import { MoneyInput } from './NumberInput';
import { WhatsAppButton } from './Contact';
import { currentTicketPrice, orderUrl, orderWhatsappText, plural } from './utils';

const KIND_OPTIONS = [
  { value: 'ticket', label: 'Entrada', icon: Ticket },
  { value: 'room', label: 'Habitación', icon: BedDouble },
];
const GENDER_OPTIONS = toOptions(GENDER_LABEL);
const METHOD_OPTIONS = toOptions(MANUAL_METHOD_LABEL);

const EMPTY_BUYER = { name: '', cedula: '', phone: '', instagram: '', email: '' };

function normalizePhone(value) {
  let d = String(value || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return d;
}

/** Validación rápida en el navegador (el backend valida igual). Claves = rutas del contrato. */
function validate(form, amount) {
  const e = {};
  const b = form.buyer;
  if (b.name.trim().length < 3) e['buyer.name'] = 'Escribe el nombre completo.';
  if (!/^[A-Z0-9]{5,15}$/.test(b.cedula.replace(/[\s.-]/g, '').toUpperCase())) e['buyer.cedula'] = 'Cédula inválida (5 a 15 letras o números).';
  if (!/^3\d{9}$/.test(normalizePhone(b.phone))) e['buyer.phone'] = 'Celular de 10 dígitos que empiece por 3.';
  if (b.instagram.trim() && !/^[a-z0-9._]{1,30}$/.test(b.instagram.trim().replace(/^@/, '').toLowerCase())) {
    e['buyer.instagram'] = 'Usuario inválido (letras, números, punto y guion bajo).';
  }
  if (b.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) e['buyer.email'] = 'Correo inválido.';
  if (form.kind === 'room' && !form.roomNumber) e.roomNumber = 'Elige la habitación.';
  if (amount === null || amount === undefined) e.amount = 'Escribe el valor que pagó.';
  form.companions.forEach((c, i) => {
    if (c.name.trim() && c.name.trim().length < 2) e[`companions.${i}.name`] = 'Nombre muy corto.';
  });
  return e;
}

function RoomChoice({ rooms, value, onChange, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-bone/90">Habitación</p>
      <div role="radiogroup" aria-label="Habitación" className="grid gap-2 sm:grid-cols-3">
        {rooms.map((r) => {
          const available = r.status === 'available';
          const active = value === r.number;
          return (
            <button
              key={r.number}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!available}
              onClick={() => onChange(r.number)}
              className={clsx(
                'flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition sm:flex-col sm:items-start sm:justify-center sm:gap-1',
                active
                  ? 'border-blood bg-blood/15 shadow-[inset_0_0_0_1px_rgb(225_29_46/0.6)]'
                  : 'border-white/10 bg-tomb/60 hover:border-white/25',
                'disabled:cursor-not-allowed disabled:opacity-45',
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-bone">
                {r.name}
                {r.privateBathroom && <ShowerHead className="h-3.5 w-3.5 text-fog" aria-label="Baño privado" />}
              </span>
              <span className="text-xs text-fog">
                {available ? `${r.capacity} personas · ${formatCOP(r.price)}` : ROOM_STATUS_LABEL[r.status] || r.status}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-xs font-medium text-blood-light" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SuccessView({ order }) {
  const n = order.tickets?.length || 0;
  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-toxic/10 text-toxic ring-1 ring-toxic/30">
        <CircleCheck className="h-7 w-7" strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-lg font-semibold text-bone">Venta registrada</p>
        <p className="mt-1 text-sm text-fog">
          {order.buyer?.name} · {order.kind === 'room' ? order.room?.name : `Entrada ${GENDER_LABEL[order.gender]?.toLowerCase() || ''}`} ·{' '}
          {formatCOP(order.amount)}
        </p>
      </div>
      <p className="max-w-sm text-sm text-fog">
        {n ? `Se ${n === 1 ? 'generó' : 'generaron'} ${plural(n, 'entrada')} con QR.` : 'La compra quedó pagada.'} Envíale el enlace para que tenga sus QR a la mano.
      </p>
      {n > 0 && (
        <ul className="w-full max-w-sm divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] text-left">
          {order.tickets.slice(0, 8).map((t) => (
            <li key={t.token || t.code} className="flex items-center justify-between gap-3 px-3.5 py-2">
              <span className="min-w-0 truncate text-sm text-bone">{t.holderName}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-fog">{t.code}</span>
                <Badge tone="green">{TICKET_STATUS_LABEL[t.status] || t.status}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Registrar venta manual": efectivo, DM, cortesía… Crea la orden ya pagada con sus tickets. */
export default function ManualSaleModal({ onClose, onCreated }) {
  const toast = useToast();
  const config = useFetch(async (signal) => {
    const [s, r] = await Promise.all([staffApi('/api/admin/settings', { signal }), staffApi('/api/admin/rooms', { signal })]);
    return { settings: s.settings, rooms: r.items || [] };
  }, []);

  const [form, setForm] = useState({
    kind: 'ticket',
    gender: 'mujer',
    roomNumber: null,
    manualMethod: 'efectivo',
    amount: null,
    amountEdited: false,
    buyer: EMPTY_BUYER,
    companions: [],
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const settings = config.data?.settings;
  const rooms = useMemo(() => config.data?.rooms || [], [config.data]);
  const roomNumber = form.roomNumber ?? rooms.find((r) => r.status === 'available')?.number ?? null;
  const room = rooms.find((r) => r.number === roomNumber) || null;
  const courtesy = form.manualMethod === 'cortesia';

  const suggestion = useMemo(() => {
    if (form.kind === 'room') {
      return room ? { amount: room.price, text: `Precio de la ${room.name}: ${formatCOP(room.price)}` } : null;
    }
    if (!settings) return null;
    const { phase, price } = currentTicketPrice(settings, form.gender);
    return {
      amount: price,
      text: `Precio actual (${PHASE_LABEL[phase]?.toLowerCase()} · ${GENDER_LABEL[form.gender]?.toLowerCase()}): ${formatCOP(price)}`,
    };
  }, [form.kind, form.gender, room, settings]);

  const amount = courtesy ? 0 : form.amountEdited ? form.amount : (suggestion?.amount ?? null);
  const maxCompanions = form.kind === 'room' && room ? Math.max(0, room.capacity - 1) : 0;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setBuyer = (key, value) => setForm((f) => ({ ...f, buyer: { ...f.buyer, [key]: value } }));
  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const setCompanion = (i, key, value) =>
    setForm((f) => ({ ...f, companions: f.companions.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)) }));

  const reset = () => {
    setForm((f) => ({ ...f, buyer: EMPTY_BUYER, companions: [], notes: '', amountEdited: false, amount: null, roomNumber: null }));
    setErrors({});
    setCreated(null);
    config.reload({ silent: true });
  };

  const submit = async (e) => {
    e?.preventDefault();
    const clientErrors = validate({ ...form, roomNumber }, amount);
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      toast.error('Revisa los datos marcados.');
      return;
    }
    const b = form.buyer;
    const body = {
      kind: form.kind,
      ...(form.kind === 'ticket' ? { gender: form.gender, roomNumber: null } : { roomNumber }),
      buyer: {
        name: b.name.trim(),
        cedula: b.cedula.trim(),
        phone: b.phone.trim(),
        instagram: b.instagram.trim(),
        email: b.email.trim(),
      },
      companions:
        form.kind === 'room'
          ? form.companions
              .filter((c) => c.name.trim())
              .slice(0, maxCompanions)
              .map((c) => ({ name: c.name.trim(), cedula: c.cedula.trim() || null }))
          : [],
      amount,
      manualMethod: form.manualMethod,
      notes: form.notes.trim(),
    };
    setSaving(true);
    setErrors({});
    try {
      const res = await staffApi('/api/admin/orders/manual', { method: 'POST', body });
      setCreated(res.order);
      toast.success('Venta registrada.');
      onCreated?.(res.order);
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR') setErrors(err.details?.fields || {});
      else if (err.code === 'ALREADY_HAS_TICKET') setErrors({ 'buyer.cedula': err.message });
      else if (err.code === 'ROOM_UNAVAILABLE') {
        setErrors({ roomNumber: err.message });
        config.reload({ silent: true });
      }
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const footer = created ? (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
      <WhatsAppButton phone={created.buyer?.phone} text={orderWhatsappText(created)} className="col-span-2 sm:order-3" />
      <CopyButton text={orderUrl(created.token)} label="Copiar enlace" copiedLabel="Copiado" className="sm:order-2" />
      <Button variant="secondary" onClick={reset} className="sm:order-1">
        <Plus className="h-4 w-4" />
        Registrar otra
      </Button>
    </div>
  ) : config.data ? (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
      <Button variant="secondary" onClick={onClose} disabled={saving}>
        Cancelar
      </Button>
      <Button type="submit" form="manual-sale-form" loading={saving}>
        Registrar venta
      </Button>
    </div>
  ) : null;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={created ? 'Listo' : 'Registrar venta manual'}
      description={created ? undefined : 'Para quien pagó en efectivo, por DM o como cortesía. La compra queda pagada con sus QR.'}
      footer={footer}
    >
      {created ? (
        <SuccessView order={created} />
      ) : config.loading && !config.data ? (
        <PageSpinner className="min-h-[30vh]" label="Cargando precios…" />
      ) : config.error && !config.data ? (
        <ErrorState error={config.error} onRetry={config.reload} />
      ) : (
        <form id="manual-sale-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-bone/90">¿Qué vendiste?</p>
            <Segmented
              ariaLabel="Tipo de venta"
              options={KIND_OPTIONS}
              value={form.kind}
              onChange={(kind) => set({ kind, amountEdited: false, companions: [] })}
              columns={2}
            />
          </div>

          {form.kind === 'ticket' ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-bone/90">Género</p>
              <Segmented
                ariaLabel="Género"
                options={GENDER_OPTIONS}
                value={form.gender}
                onChange={(gender) => set({ gender, amountEdited: false })}
                columns={2}
              />
            </div>
          ) : rooms.some((r) => r.status === 'available') ? (
            <RoomChoice
              rooms={rooms}
              value={roomNumber}
              onChange={(n) => {
                set({ roomNumber: n, amountEdited: false });
                clearError('roomNumber');
              }}
              error={errors.roomNumber}
            />
          ) : (
            <p className="rounded-xl border border-gold/25 bg-gold/[0.07] px-3.5 py-3 text-sm text-gold">
              No hay habitaciones disponibles. Libera o desbloquea una en Habitaciones.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-bone/90">¿Cómo pagó?</p>
            <Segmented ariaLabel="Método de pago" options={METHOD_OPTIONS} value={form.manualMethod} onChange={(m) => set({ manualMethod: m })} minWidth={120} />
          </div>

          <MoneyInput
            label="Valor que pagó"
            value={amount}
            disabled={courtesy}
            onChange={(n) => {
              set({ amount: n, amountEdited: true });
              clearError('amount');
            }}
            error={errors.amount}
            hint={
              courtesy
                ? form.kind === 'ticket'
                  ? 'Cortesía: $0 y la entrada queda como cortesía (cuenta en el aforo).'
                  : 'Cortesía: $0.'
                : suggestion?.text
            }
          />
          {!courtesy && form.amountEdited && suggestion && form.amount !== suggestion.amount && (
            <button
              type="button"
              onClick={() => set({ amountEdited: false })}
              className="-mt-3 self-start text-xs font-medium text-blood-light underline-offset-2 hover:underline"
            >
              Usar el precio sugerido ({formatCOP(suggestion.amount)})
            </button>
          )}

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-smoke">Comprador</legend>
            <Input
              label="Nombre completo"
              required
              autoComplete="off"
              value={form.buyer.name}
              onChange={(e) => {
                setBuyer('name', e.target.value);
                clearError('buyer.name');
              }}
              error={errors['buyer.name']}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Cédula"
                required
                inputMode="text"
                autoComplete="off"
                value={form.buyer.cedula}
                onChange={(e) => {
                  setBuyer('cedula', e.target.value);
                  clearError('buyer.cedula');
                }}
                error={errors['buyer.cedula']}
              />
              <Input
                label="Celular"
                required
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="300 123 4567"
                value={form.buyer.phone}
                onChange={(e) => {
                  setBuyer('phone', e.target.value);
                  clearError('buyer.phone');
                }}
                error={errors['buyer.phone']}
              />
              <Input
                label="Instagram"
                hint="Opcional"
                leading="@"
                autoCapitalize="none"
                autoComplete="off"
                value={form.buyer.instagram}
                onChange={(e) => {
                  setBuyer('instagram', e.target.value.replace(/^@/, ''));
                  clearError('buyer.instagram');
                }}
                error={errors['buyer.instagram']}
              />
              <Input
                label="Correo"
                hint="Opcional"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={form.buyer.email}
                onChange={(e) => {
                  setBuyer('email', e.target.value);
                  clearError('buyer.email');
                }}
                error={errors['buyer.email']}
              />
            </div>
          </fieldset>

          {form.kind === 'room' && room && maxCompanions > 0 && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-smoke">
                Acompañantes ({form.companions.length}/{maxCompanions})
              </legend>
              <p className="text-xs text-fog">
                Opcional. Los que no agregues quedan como “Acompañante N · Hab. {room.number}” y puedes renombrarlos luego en Entradas.
              </p>
              {form.companions.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
                  <Input
                    aria-label={`Nombre del acompañante ${i + 1}`}
                    placeholder={`Acompañante ${i + 1}`}
                    value={c.name}
                    onChange={(e) => {
                      setCompanion(i, 'name', e.target.value);
                      clearError(`companions.${i}.name`);
                    }}
                    error={errors[`companions.${i}.name`]}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="row-span-2 h-12 w-12 sm:order-3 sm:row-span-1"
                    onClick={() => setForm((f) => ({ ...f, companions: f.companions.filter((_, idx) => idx !== i) }))}
                    aria-label={`Quitar acompañante ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Input
                    aria-label={`Cédula del acompañante ${i + 1}`}
                    placeholder="Cédula (opcional)"
                    value={c.cedula}
                    onChange={(e) => setCompanion(i, 'cedula', e.target.value)}
                  />
                </div>
              ))}
              {form.companions.length < maxCompanions && (
                <Button
                  variant="secondary"
                  className="self-start"
                  onClick={() => setForm((f) => ({ ...f, companions: [...f.companions, { name: '', cedula: '' }] }))}
                >
                  <UserRoundPlus className="h-4 w-4" />
                  Agregar acompañante
                </Button>
              )}
            </fieldset>
          )}

          <Textarea
            label="Notas"
            hint="Opcional. Solo las ves tú."
            rows={2}
            placeholder="Ej.: Pagó en la U"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value.slice(0, 500) })}
          />
        </form>
      )}
    </Modal>
  );
}
