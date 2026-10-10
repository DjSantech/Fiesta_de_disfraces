import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CircleAlert, Contact, CreditCard, MapPin, Plus, Save, Tags, Ticket, Trash2 } from 'lucide-react';
import { Button, Card, Input, PageSpinner, Switch, Textarea, useToast } from '../../../components/ui';
import { staffApi } from '../../../lib/api';
import { useFetch } from '../../../lib/useFetch';
import { formatDateTime, formatRelative } from '../../../lib/format';
import { PHASE_LABEL } from '../../../lib/labels';
import PageHeader from '../../../components/staff/admin/PageHeader';
import ErrorState from '../../../components/staff/admin/ErrorState';
import ConfirmDialog from '../../../components/staff/admin/ConfirmDialog';
import { IntegerInput, MoneyInput } from '../../../components/staff/admin/NumberInput';
import { useUnsavedChangesGuard } from '../../../components/staff/admin/hooks';
import { bogotaInputToIso, formatDuration, isoToBogotaInput, phaseAt } from '../../../components/staff/admin/utils';

function toForm(s) {
  return {
    eventStartsAt: isoToBogotaInput(s.eventStartsAt),
    presaleEndsAt: isoToBogotaInput(s.presaleEndsAt),
    salesOpen: Boolean(s.salesOpen),
    capacity: s.capacity ?? null,
    publicCounter: Boolean(s.publicCounter),
    prices: {
      preventa: { mujer: s.prices?.preventa?.mujer ?? null, hombre: s.prices?.preventa?.hombre ?? null },
      puerta: { mujer: s.prices?.puerta?.mujer ?? null, hombre: s.prices?.puerta?.hombre ?? null },
    },
    guestPresaleDiscount: s.guestPresaleDiscount ?? null,
    guestGeneralDiscount: s.guestGeneralDiscount ?? null,
    parking: { carro: s.parking?.carro ?? null, moto: s.parking?.moto ?? null, casco: s.parking?.casco ?? null },
    paymentAccounts: (s.paymentAccounts || []).map((a) => ({ label: a.label || '', number: a.number || '', holder: a.holder || '' })),
    transferInstructions: s.transferInstructions || '',
    contact: { whatsapp: s.contact?.whatsapp || '', instagram: s.contact?.instagram || '', adminName: s.contact?.adminName || '' },
    location: { revealed: Boolean(s.location?.revealed), name: s.location?.name || '', mapsUrl: s.location?.mapsUrl || '', notes: s.location?.notes || '' },
  };
}

function buildPatch(form, base) {
  const patch = {};
  for (const key of Object.keys(form)) {
    if (JSON.stringify(form[key]) === JSON.stringify(base[key])) continue;
    patch[key] = key === 'eventStartsAt' || key === 'presaleEndsAt' ? bogotaInputToIso(form[key]) : form[key];
  }
  return patch;
}

function validate(f) {
  const e = {};
  if (!bogotaInputToIso(f.eventStartsAt)) e.eventStartsAt = 'Fecha inválida.';
  if (!bogotaInputToIso(f.presaleEndsAt)) e.presaleEndsAt = 'Fecha inválida.';
  if (!f.capacity) e.capacity = 'Mínimo 1.';
  for (const p of ['preventa', 'puerta']) for (const g of ['mujer', 'hombre']) if (f.prices[p][g] === null) e[`prices.${p}.${g}`] = 'Obligatorio.';
  for (const k of ['carro', 'moto', 'casco']) if (f.parking[k] === null) e[`parking.${k}`] = 'Obligatorio.';
  if (f.guestPresaleDiscount === null) e.guestPresaleDiscount = 'Obligatorio.';
  if (f.guestGeneralDiscount === null) e.guestGeneralDiscount = 'Obligatorio.';
  f.paymentAccounts.forEach((a, i) => {
    if (!a.label.trim()) e[`paymentAccounts.${i}.label`] = 'Obligatorio.';
    if (!a.number.trim()) e[`paymentAccounts.${i}.number`] = 'Obligatorio.';
  });
  if (f.contact.whatsapp && !/^\d{10,13}$/.test(f.contact.whatsapp)) e['contact.whatsapp'] = 'Solo números, con 57.';
  if (f.location.mapsUrl && !/^https:\/\//.test(f.location.mapsUrl)) e['location.mapsUrl'] = 'Debe empezar por https://';
  return e;
}

function Section({ id, icon: Icon, title, description, children }) {
  return (
    <Card id={id} className="scroll-mt-32 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-fog"><Icon className="h-5 w-5" strokeWidth={1.75} /></span>
        <div>
          <h2 className="text-base font-semibold text-bone">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-fog">{description}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

const SECTIONS = [
  ['evento', 'Evento'], ['ventas', 'Ventas'], ['precios', 'Precios'], ['pagos', 'Pagos'], ['contacto', 'Contacto'], ['ubicacion', 'Ubicación'],
];

export default function Settings() {
  const toast = useToast();
  const { data, error, reload } = useFetch((signal) => staffApi('/api/admin/settings', { signal }), []);
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState(null); // true | false (acción pendiente de confirmar)

  useEffect(() => {
    if (data?.settings && !saved) {
      setSaved(data.settings);
      setForm(toForm(data.settings));
    }
  }, [data, saved]);

  const base = useMemo(() => (saved ? toForm(saved) : null), [saved]);
  const patch = form && base ? buildPatch(form, base) : {};
  const dirty = Object.keys(patch).length > 0;
  const guard = useUnsavedChangesGuard(dirty);

  if (!form) return error ? <ErrorState error={error} onRetry={reload} /> : <PageSpinner label="Cargando ajustes…" />;

  const set = (path, value) => {
    setForm((f) => {
      const next = structuredClone(f);
      const keys = path.split('.');
      let o = next;
      keys.slice(0, -1).forEach((k) => (o = o[k]));
      o[keys.at(-1)] = value;
      return next;
    });
    setErrors((e) => ({ ...e, [path]: null }));
  };
  const err = (p) => errors[p];

  const save = async () => {
    const v = validate(form);
    if (Object.keys(v).length) {
      setErrors(v);
      toast.error('Revisa los campos marcados.');
      return;
    }
    setSaving(true);
    try {
      const res = await staffApi('/api/admin/settings', { method: 'PUT', body: patch });
      setSaved(res.settings);
      setForm(toForm(res.settings));
      setErrors({});
      toast.success('Ajustes guardados.');
    } catch (ex) {
      setErrors(ex.details?.fields || {});
      toast.error(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const applyReveal = async () => {
    const loc = { ...form.location, revealed: reveal };
    try {
      const res = await staffApi('/api/admin/settings', { method: 'PUT', body: { location: loc } });
      setSaved(res.settings);
      setForm((f) => ({ ...f, location: toForm(res.settings).location }));
      setReveal(null);
      toast.success(reveal ? 'Ubicación revelada en los tickets.' : 'Ubicación oculta.');
    } catch (ex) {
      setErrors(ex.details?.fields || {});
      toast.error(ex.message);
      throw ex;
    }
  };

  const askReveal = (on) => {
    if (on && (!form.location.name.trim() || !/^https:\/\//.test(form.location.mapsUrl))) {
      setErrors((e) => ({ ...e, 'location.mapsUrl': 'Primero escribe el nombre y un enlace https:// de Google Maps.' }));
      toast.error('Primero escribe el nombre y el enlace de Google Maps.');
      return;
    }
    setReveal(on);
  };

  const phase = phaseAt(saved.presaleEndsAt);
  const presaleLeft = new Date(saved.presaleEndsAt).getTime() - Date.now();
  const accounts = form.paymentAccounts;

  return (
    <div className={dirty ? 'pb-24' : ''}>
      <PageHeader
        title="Ajustes"
        description={`Lo que ve la gente en la web y usa la puerta. Última actualización ${formatRelative(saved.updatedAt)}.`}
      />
      <nav className="mb-4 flex gap-2 overflow-x-auto [scrollbar-width:none]" aria-label="Secciones de ajustes">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="flex h-10 shrink-0 items-center rounded-full border border-white/10 px-4 text-sm text-fog hover:text-bone">{label}</a>
        ))}
      </nav>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Section id="evento" icon={CalendarClock} title="Evento" description="Horas en Colombia (UTC−5).">
          <p className="rounded-xl border border-white/8 bg-white/3 px-3.5 py-2.5 text-sm text-fog">
            Fase actual: <strong className="text-bone">{PHASE_LABEL[phase]}</strong>
            {phase === 'preventa' && ` · termina en ${formatDuration(presaleLeft)} (${formatDateTime(saved.presaleEndsAt)})`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Inicio del evento" type="datetime-local" value={form.eventStartsAt} onChange={(e) => set('eventStartsAt', e.target.value)} error={err('eventStartsAt')} />
            <Input label="Fin de la preventa" type="datetime-local" value={form.presaleEndsAt} onChange={(e) => set('presaleEndsAt', e.target.value)} error={err('presaleEndsAt')} hint="Después, la web cobra precios de puerta." />
          </div>
        </Section>

        <Section id="ventas" icon={Ticket} title="Ventas">
          <Switch label="Ventas en línea abiertas" description="Si las cierras, nadie puede comprar en la web (manual y puerta siguen)." checked={form.salesOpen} onChange={(v) => set('salesOpen', v)} />
          <IntegerInput label="Aforo (entradas generales + cortesías)" value={form.capacity} onChange={(n) => set('capacity', n)} error={err('capacity')} hint="Las habitaciones van aparte." />
          <Switch label="Mostrar contador de cupos en la web" checked={form.publicCounter} onChange={(v) => set('publicCounter', v)} />
        </Section>

        <Section id="precios" icon={Tags} title="Precios">
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Preventa · Mujer" value={form.prices.preventa.mujer} onChange={(n) => set('prices.preventa.mujer', n)} error={err('prices.preventa.mujer')} />
            <MoneyInput label="Preventa · Hombre" value={form.prices.preventa.hombre} onChange={(n) => set('prices.preventa.hombre', n)} error={err('prices.preventa.hombre')} />
            <MoneyInput label="Puerta · Mujer" value={form.prices.puerta.mujer} onChange={(n) => set('prices.puerta.mujer', n)} error={err('prices.puerta.mujer')} />
            <MoneyInput label="Puerta · Hombre" value={form.prices.puerta.hombre} onChange={(n) => set('prices.puerta.hombre', n)} error={err('prices.puerta.hombre')} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyInput label="Descuento invitados en preventa ($)" value={form.guestPresaleDiscount} onChange={(n) => set('guestPresaleDiscount', n)} error={err('guestPresaleDiscount')} hint="Se resta al precio de preventa del género. Ej.: 5000." />
            <MoneyInput label="Descuento extra invitados en venta general ($, sobre el precio de preventa)" value={form.guestGeneralDiscount} onChange={(n) => set('guestGeneralDiscount', n)} error={err('guestGeneralDiscount')} hint="En venta general conservan el precio de preventa menos este valor. 0 = solo conservan la preventa." />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MoneyInput label="Parqueadero carro" value={form.parking.carro} onChange={(n) => set('parking.carro', n)} error={err('parking.carro')} />
            <MoneyInput label="Parqueadero moto" value={form.parking.moto} onChange={(n) => set('parking.moto', n)} error={err('parking.moto')} />
            <MoneyInput label="Guardar casco" value={form.parking.casco} onChange={(n) => set('parking.casco', n)} error={err('parking.casco')} />
          </div>
        </Section>

        <Section id="pagos" icon={CreditCard} title="Pagos por transferencia" description="Cuentas que ve el comprador (máximo 6).">
          {accounts.map((a, i) => (
            <div key={i} className="grid gap-2 rounded-2xl border border-white/8 bg-tomb/40 p-3 sm:grid-cols-[1fr_1.2fr_1.2fr_auto]">
              <Input aria-label="Etiqueta" placeholder="Nequi" value={a.label} onChange={(e) => set(`paymentAccounts.${i}.label`, e.target.value)} error={err(`paymentAccounts.${i}.label`)} />
              <Input aria-label="Número" placeholder="3135995612" inputMode="numeric" value={a.number} onChange={(e) => set(`paymentAccounts.${i}.number`, e.target.value)} error={err(`paymentAccounts.${i}.number`)} />
              <Input aria-label="Titular" placeholder="Titular (opcional)" value={a.holder} onChange={(e) => set(`paymentAccounts.${i}.holder`, e.target.value)} />
              <Button variant="ghost" size="icon" className="h-12 w-12" aria-label="Quitar cuenta" onClick={() => set('paymentAccounts', accounts.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {accounts.length < 6 && (
            <Button variant="secondary" className="self-start" onClick={() => set('paymentAccounts', [...accounts, { label: '', number: '', holder: '' }])}><Plus className="h-4 w-4" />Agregar cuenta</Button>
          )}
          <Textarea label="Instrucciones de transferencia" rows={3} value={form.transferInstructions} onChange={(e) => set('transferInstructions', e.target.value)} error={err('transferInstructions')} />
        </Section>

        <Section id="contacto" icon={Contact} title="Contacto">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="WhatsApp" inputMode="numeric" value={form.contact.whatsapp} onChange={(e) => set('contact.whatsapp', e.target.value.replace(/\D/g, ''))} error={err('contact.whatsapp')} hint="Con 57, sin + ni espacios" />
            <Input label="Instagram" leading="@" value={form.contact.instagram} onChange={(e) => set('contact.instagram', e.target.value.replace(/^@/, ''))} error={err('contact.instagram')} />
            <Input label="Nombre del admin" value={form.contact.adminName} onChange={(e) => set('contact.adminName', e.target.value)} error={err('contact.adminName')} />
          </div>
        </Section>

        <Section id="ubicacion" icon={MapPin} title="Ubicación" description="Se muestra en el ticket solo cuando la reveles.">
          <Input label="Nombre del lugar" value={form.location.name} onChange={(e) => set('location.name', e.target.value)} error={err('location.name')} placeholder="Finca La Esperanza" />
          <Input label="Enlace de Google Maps" type="url" value={form.location.mapsUrl} onChange={(e) => set('location.mapsUrl', e.target.value.trim())} error={err('location.mapsUrl')} placeholder="https://maps.app.goo.gl/…" />
          <Textarea label="Notas para llegar" rows={2} value={form.location.notes} onChange={(e) => set('location.notes', e.target.value)} error={err('location.notes')} />
          <div className={`rounded-2xl border p-4 ${saved.location?.revealed ? 'border-toxic/30 bg-toxic/5' : 'border-white/8 bg-tomb/40'}`}>
            <Switch
              label="Revelar ubicación a quienes tienen entrada"
              description={saved.location?.revealed ? 'Visible ahora en todos los tickets válidos.' : 'Oculta: el ticket dice que la ubicación se envía el 31.'}
              checked={Boolean(saved.location?.revealed)}
              onChange={askReveal}
            />
          </div>
        </Section>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-crypt/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-gold"><CircleAlert className="h-4 w-4 shrink-0" />Cambios sin guardar</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setForm(base); setErrors({}); }} disabled={saving}>Descartar</Button>
              <Button onClick={save} loading={saving}>{!saving && <Save className="h-4 w-4" />}Guardar</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={reveal !== null}
        onClose={() => setReveal(null)}
        onConfirm={applyReveal}
        tone={reveal ? 'success' : 'danger'}
        icon={MapPin}
        title={reveal ? '¿Revelar la ubicación ahora?' : '¿Ocultar la ubicación?'}
        confirmLabel={reveal ? 'Sí, revelar' : 'Ocultar'}
        description={
          reveal ? (
            <>Todas las personas con entrada verán <strong className="text-bone">{form.location.name}</strong> y el enlace de Maps en su ticket. Normalmente se hace el 31.</>
          ) : (
            'Dejarán de ver la ubicación en su ticket.'
          )
        }
      />
      <ConfirmDialog
        open={Boolean(guard.pendingPath)}
        onClose={guard.cancelLeave}
        onConfirm={guard.confirmLeave}
        title="¿Salir sin guardar?"
        description="Tienes cambios en los ajustes que se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
      />
    </div>
  );
}
