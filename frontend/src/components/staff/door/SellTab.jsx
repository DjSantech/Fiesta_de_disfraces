import { useEffect, useMemo, useRef, useState } from 'react';
import { ListChecks, ShieldX, Ticket } from 'lucide-react';
import { Button, Card, Input, Segmented, useToast } from '../../ui';
import { formatCOP, formatTime } from '../../../lib/format';
import { VEHICLE_LABEL } from '../../../lib/labels';
import ExtrasFields from './ExtrasFields';
import ResultScreen, { EntryDoneScreen } from './ResultScreen';
import {
  EMPTY_EXTRAS,
  doorApi,
  doorEntryPrice,
  extrasBody,
  guestPercent,
  helmetPrice,
  isValidCedula,
  isValidPhone,
  mapFieldErrors,
  normalizeCedula,
  normalizePhone,
  parkingPrice,
  ticketTypeLabel,
  validateExtras,
} from './doorUtils';
import { PayMethodPicker } from './shared/OpsUi';
import { useDebounced, useSingleFlight } from './shared/hooks';
import { errorMessage } from './shared/errors';

const EMPTY = { name: '', cedula: '', phone: '', category: '', gender: '', ...EMPTY_EXTRAS, method: 'efectivo', notes: '' };

/** Consulta /api/door/lookup con debounce (≥ 5 caracteres). */
function useLookup(value) {
  const q = useDebounced(value, 450);
  const [state, setState] = useState({ q: '', data: null });
  useEffect(() => {
    if (!q || q.length < 5) {
      setState({ q: '', data: null });
      return undefined;
    }
    const ctrl = new AbortController();
    doorApi
      .lookup(q, ctrl.signal)
      .then((data) => setState({ q, data }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [q]);
  return state.q === value ? state.data : null;
}

export default function SellTab({ config, prefill, onPrefillUsed, onChanged }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, run] = useSingleFlight();
  const [checkin, setCheckin] = useState(null); // ticket para hacer check-in en vez de cobrar
  const [done, setDone] = useState(null);
  const autoGuestRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!prefill) return;
    setForm({ ...EMPTY, ...prefill });
    setErrors({});
    onPrefillUsed?.();
  }, [prefill, onPrefillUsed]);

  const cedula = normalizeCedula(form.cedula);
  const phone = normalizePhone(form.phone);
  const byCedula = useLookup(cedula);
  const byPhone = useLookup(isValidPhone(phone) ? phone : '');

  // La búsqueda es parcial: con cédula se confirma por los últimos 4 dígitos.
  const match = useMemo(() => {
    const last4 = cedula.slice(-4);
    const tickets = [
      ...(byCedula?.tickets || []).filter((t) => t.cedulaLast4 === last4),
      ...(byPhone?.tickets || []),
    ];
    const guests = [...(byCedula?.guests || []).filter((g) => g.cedulaLast4 === last4), ...(byPhone?.guests || [])];
    const entries = [
      ...(byCedula?.entries || []).filter((e) => e.cedula === cedula),
      ...(byPhone?.entries || []).filter((e) => e.phone === phone),
    ].filter((e) => !e.voided);
    return {
      valid: tickets.find((t) => t.status === 'valid'),
      used: tickets.find((t) => t.status === 'used'),
      guest: guests[0] || null,
      entry: entries[0] || null,
    };
  }, [byCedula, byPhone, cedula, phone]);

  // En la lista de invitados → seleccionar Invitado (una vez por persona).
  useEffect(() => {
    const g = match.guest;
    if (!g || autoGuestRef.current === g.id) return;
    autoGuestRef.current = g.id;
    setForm((f) =>
      f.category === 'invitado' ? f : { ...f, category: 'invitado', gender: f.category === 'mujer' || f.category === 'hombre' ? f.category : f.gender },
    );
  }, [match.guest]);

  const pct = guestPercent(config, match.guest);
  const entryAmount = form.category && (form.category !== 'invitado' || form.gender) ? doorEntryPrice(config, form.category, form.gender, match.guest) : 0;
  const parking = parkingPrice(config, form.vehicleType);
  const helmet = helmetPrice(config, form.helmet);
  const courtesy = form.method === 'cortesia';
  const total = courtesy ? 0 : entryAmount + parking + helmet;
  const priceKnown = Boolean(form.category) && (form.category !== 'invitado' || form.gender);

  const validate = () => {
    const e = { ...validateExtras(form) };
    if (form.name.trim().length < 2) e.name = 'Escribe el nombre';
    if (!cedula && !phone) e.cedula = 'Escribe la cédula o el celular';
    if (cedula && !isValidCedula(cedula)) e.cedula = 'Cédula inválida';
    if (phone && !isValidPhone(phone)) e.phone = 'Celular de 10 dígitos que empiece por 3';
    if (!form.category) e.category = 'Elige la categoría';
    if (form.category === 'invitado' && !form.gender) e.gender = 'Elige el género';
    return e;
  };

  const reset = () => {
    setForm(EMPTY);
    setErrors({});
    autoGuestRef.current = null;
  };

  const submit = (ev) => {
    ev?.preventDefault();
    run(async () => {
      const e = validate();
      setErrors(e);
      if (Object.keys(e).length) {
        toast.error('Revisa los datos marcados.');
        return;
      }
      const body = {
        name: form.name.trim(),
        cedula,
        phone,
        category: form.category,
        ...(form.category === 'invitado' ? { gender: form.gender } : {}),
        paymentMethod: form.method,
        ...extrasBody(form),
        notes: form.notes.trim(),
      };
      try {
        const data = await doorApi.sale(body);
        setDone(data.entry);
        reset();
        onChanged?.();
      } catch (err) {
        if (err.code === 'ALREADY_HAS_TICKET') {
          toast.info('Esta persona ya tiene entrada: haz el check-in sin cobrar la entrada.');
          const ticketId = err.details?.ticketId;
          try {
            const found = await doorApi.lookup(cedula || phone);
            const t = found.tickets.find((x) => x.id === ticketId) || found.tickets.find((x) => x.status === 'valid');
            if (t) setCheckin(t);
          } catch {
            /* sin ticket: queda el aviso */
          }
        } else if (err.code === 'VALIDATION_ERROR') {
          setErrors(mapFieldErrors(err));
          toast.error(err.message);
        } else toast.error(errorMessage(err));
      }
    });
  };

  const priceHint = (cat, g) => formatCOP(doorEntryPrice(config, cat, g, match.guest));

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <Card padding="sm" className="flex flex-col gap-3">
            <Input label="Nombre" required value={form.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} autoComplete="off" enterKeyHint="next" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cédula" value={form.cedula} onChange={(e) => set({ cedula: e.target.value })} error={errors.cedula} inputMode="numeric" autoComplete="off" />
              <Input label="Celular" value={form.phone} onChange={(e) => set({ phone: e.target.value })} error={errors.phone} inputMode="tel" autoComplete="off" />
            </div>
            <p className="text-xs text-smoke">Al menos uno de los dos.</p>
          </Card>

          {match.valid && (
            <div className="flex flex-col gap-3 rounded-2xl border-2 border-toxic bg-toxic/10 p-4">
              <p className="flex items-center gap-2 font-display text-2xl uppercase tracking-wide text-toxic">
                <Ticket className="h-6 w-6" /> Ya tiene entrada
              </p>
              <p className="text-bone">
                <b>{match.valid.holderName}</b> · {ticketTypeLabel(match.valid)} · <span className="font-mono">{match.valid.code}</span>
              </p>
              <Button type="button" variant="success" size="xl" block onClick={() => setCheckin(match.valid)}>
                Hacer check-in (no cobrar entrada)
              </Button>
            </div>
          )}
          {!match.valid && match.used && (
            <div className="rounded-2xl border-2 border-danger bg-danger/10 p-4 text-bone">
              <p className="flex items-center gap-2 font-display text-2xl uppercase text-danger-light">
                <ShieldX className="h-6 w-6" /> Ya ingresó con QR
              </p>
              <p>
                {match.used.holderName} · {formatTime(match.used.checkedInAt)} {match.used.checkedInByName ? `· ${match.used.checkedInByName}` : ''}
              </p>
            </div>
          )}
          {match.entry && (
            <p className="rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm text-gold">
              Ya registró ingreso hoy a las {formatTime(match.entry.createdAt)} ({match.entry.source === 'ticket' ? 'con QR' : 'venta en puerta'}).
            </p>
          )}
          {match.guest && (
            <p className="flex items-center gap-2 rounded-2xl border border-toxic/40 bg-toxic/10 p-3 text-sm font-semibold text-toxic">
              <ListChecks className="h-5 w-5 shrink-0" /> En lista de invitados: {match.guest.name} · {pct}% de descuento
            </p>
          )}

          <Card padding="sm" className="flex flex-col gap-3">
            <p className="text-sm font-medium text-bone/90">Categoría</p>
            <Segmented
              size="lg"
              columns={3}
              value={form.category}
              onChange={(v) => set({ category: v })}
              ariaLabel="Categoría"
              options={[
                { value: 'mujer', label: 'Mujer', hint: priceHint('mujer') },
                { value: 'hombre', label: 'Hombre', hint: priceHint('hombre') },
                { value: 'invitado', label: 'Invitado', hint: `−${pct}%` },
              ]}
            />
            {errors.category && <p className="text-xs font-medium text-danger-light">{errors.category}</p>}
            {form.category === 'invitado' && (
              <>
                <p className="text-sm font-medium text-bone/90">Género del invitado</p>
                <Segmented
                  size="lg"
                  columns={2}
                  value={form.gender}
                  onChange={(v) => set({ gender: v })}
                  ariaLabel="Género"
                  options={[
                    { value: 'mujer', label: 'Mujer', hint: priceHint('invitado', 'mujer') },
                    { value: 'hombre', label: 'Hombre', hint: priceHint('invitado', 'hombre') },
                  ]}
                />
                {errors.gender && <p className="text-xs font-medium text-danger-light">{errors.gender}</p>}
                <p className="text-xs text-fog">
                  Descuento {pct}% {match.guest ? `(lista: ${match.guest.name})` : '(descuento general de invitado)'}
                </p>
              </>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card padding="sm">
            <ExtrasFields value={form} onChange={(v) => setForm(v)} config={config} errors={errors} />
          </Card>
          <Card padding="sm" className="flex flex-col gap-3">
            <p className="text-sm font-medium text-bone/90">Método de pago</p>
            <PayMethodPicker value={form.method} onChange={(v) => set({ method: v })} />
            <Input label="Nota (opcional)" value={form.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={200} />
          </Card>
          <Card padding="sm" className="flex flex-col gap-1.5 text-sm">
            <Line label={priceKnown ? `Entrada ${form.category === 'invitado' ? `invitado (−${pct}%)` : form.category}` : 'Entrada · elige categoría'} amount={entryAmount} muted={courtesy} />
            {form.vehicleType && <Line label={`Parqueadero ${VEHICLE_LABEL[form.vehicleType].toLowerCase()}`} amount={parking} muted={courtesy} />}
            {form.helmet && <Line label="Casco" amount={helmet} muted={courtesy} />}
            <div className="mt-1 flex items-baseline justify-between border-t border-white/10 pt-2">
              <span className="font-semibold text-bone">Total{courtesy ? ' · cortesía' : ''}</span>
              <span className="text-3xl font-extrabold tabular-nums text-bone">{formatCOP(total)}</span>
            </div>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 bg-gradient-to-t from-ink via-ink/95 to-transparent px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4">
        <Button type="submit" variant="success" size="xl" block loading={busy} className="mx-auto h-[4.25rem] max-w-5xl text-lg font-extrabold">
          REGISTRAR INGRESO · {formatCOP(total)}
        </Button>
      </div>

      {checkin && (
        <ResultScreen
          result={{ status: checkin.status === 'valid' ? 'valid' : checkin.status, ticket: checkin, value: checkin.code }}
          config={config}
          initialExtras={{ vehicleType: form.vehicleType, plate: form.plate, helmet: form.helmet, tag: form.tag }}
          initialMethod={form.method}
          onChanged={onChanged}
          onClose={({ checkedIn } = {}) => {
            setCheckin(null);
            if (checkedIn) reset();
          }}
        />
      )}
      {done && <EntryDoneScreen entry={done} autoCloseMs={6000} onClose={() => setDone(null)} />}
    </form>
  );
}

function Line({ label, amount, muted }) {
  return (
    <div className="flex justify-between gap-3 text-fog">
      <span className="first-letter:uppercase">{label}</span>
      <span className={muted ? 'tabular-nums line-through' : 'tabular-nums text-bone'}>{formatCOP(amount)}</span>
    </div>
  );
}
