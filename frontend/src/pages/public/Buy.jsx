import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, BadgePercent, BedDouble, CreditCard, Plus, Smartphone, Ticket, Trash2, TicketX } from 'lucide-react';
import { Button, Checkbox, Input, Segmented } from '../../components/ui';
import { api } from '../../lib/api';
import { formatCOP } from '../../lib/format';
import { LEGAL } from '../../config/event';
import PublicLayout, { PageAtmosphere, PageContainer } from '../../components/public/PublicLayout';
import { PolicyModal, PriceBreakdown, TransferPanel } from '../../components/public/payment';
import { RoomHelpNote, RoomStatusBadge, roomPeopleText, roomPricing } from '../../components/public/rooms';
import { Notice } from '../../components/public/ui';
import { salesState, usePublicConfig, loadPublicConfig } from '../../components/public/usePublicConfig';
import { describeError } from '../../components/public/utils/errors';
import { KEYS, rememberOrder, session } from '../../components/public/utils/storage';
import { dayMonth } from '../../components/public/utils/dates';
import {
  buildOrderPayload,
  isValidCedula,
  isValidInstagram,
  isValidPhone,
  normalizeCedula,
  normalizeInstagram,
  normalizePhone,
  validateBuyer,
  validateCompanions,
} from '../../components/public/utils/validation';

const EMPTY_BUYER = { name: '', cedula: '', phone: '', instagram: '', email: '' };

function Steps({ step, total }) {
  const labels = ['Elige', 'Tus datos', 'Pago', 'Comprobante'].slice(0, total);
  return (
    <ol className="mt-6 grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, minmax(0,1fr))` }} aria-label={`Paso ${step} de ${total}`}>
      {labels.map((l, i) => (
        <li key={l} aria-current={i + 1 === step ? 'step' : undefined}>
          <span className={clsx('block h-1 rounded-full', i + 1 <= step ? 'bg-blood shadow-[0_0_10px_rgb(225_29_46/0.8)]' : 'bg-white/10')} />
          <span className={clsx('mt-2 block text-[10px] font-semibold uppercase tracking-[0.18em]', i + 1 === step ? 'text-bone' : 'text-fog/70')}>{l}</span>
        </li>
      ))}
    </ol>
  );
}

function OptionCard({ active, disabled, onClick, icon: Icon, title, hint, right }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition',
        active ? 'border-blood bg-blood/12 shadow-[inset_0_0_0_1px_rgb(225_29_46/0.6)]' : 'border-white/10 bg-crypt/70 hover:border-white/25',
        disabled && 'cursor-not-allowed opacity-45',
      )}
    >
      {Icon && (
        <span className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border', active ? 'border-blood/50 text-blood-light' : 'border-white/10 text-fog')}>
          <Icon className="h-6 w-6" strokeWidth={1.5} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-bone">{title}</span>
        {hint && <span className="mt-0.5 block text-sm text-fog">{hint}</span>}
      </span>
      {right}
    </button>
  );
}

export default function Buy() {
  const { config, live } = usePublicConfig({ refreshInterval: 45000 });
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const draft = useMemo(() => session.getJSON(KEYS.buyDraft, {}) || {}, []);
  const paramRoom = Number(params.get('hab')) || null;
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState(params.get('tipo') === 'habitacion' ? 'room' : draft.kind || 'ticket');
  const [gender, setGender] = useState(draft.gender || null);
  const [roomNumber, setRoomNumber] = useState(paramRoom || draft.roomNumber || null);
  const [buyer, setBuyer] = useState({ ...EMPTY_BUYER, ...(draft.buyer || {}) });
  const [companions, setCompanions] = useState(draft.companions || []);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptData, setAcceptData] = useState(false);
  const [errors, setErrors] = useState({});
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [method, setMethod] = useState(null);
  const [order, setOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [alphaId, setAlphaId] = useState(false);
  const topRef = useRef(null);

  const state = salesState(config);
  const room = config.rooms.find((r) => r.number === roomNumber) || null;
  const maxCompanions = room ? room.capacity - 1 : 0;
  useEffect(() => {
    if (kind === 'room' && room && companions.length > maxCompanions) setCompanions((l) => l.slice(0, maxCompanions));
  }, [kind, room, companions.length, maxCompanions]);
  const ticketsOpen = state === 'preventa' || state === 'general';
  const salesOpen = state !== 'closed';

  useEffect(() => {
    document.title = 'Comprar entrada · Fiesta de Disfraces';
  }, []);
  useEffect(() => {
    session.setJSON(KEYS.buyDraft, { kind, gender, roomNumber, buyer, companions });
  }, [kind, gender, roomNumber, buyer, companions]);
  useEffect(() => {
    if (!method) setMethod(config.mercadoPago?.enabled ? 'mercadopago' : 'transferencia');
  }, [config.mercadoPago?.enabled, method]);
  // Si la habitación elegida dejó de estar libre
  useEffect(() => {
    if (live && kind === 'room' && room && room.status !== 'available' && step < 4) setRoomNumber(null);
  }, [live, kind, room, step]);

  const go = (n) => {
    setStep(n);
    setSubmitError(null);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: 'start' }));
  };

  // Cotización en vivo (descuento de invitado), con debounce
  const quoteKey = kind === 'ticket'
    ? JSON.stringify({ kind, gender, c: isValidCedula(buyer.cedula) ? normalizeCedula(buyer.cedula) : '', p: isValidPhone(buyer.phone) ? normalizePhone(buyer.phone) : '', i: isValidInstagram(buyer.instagram) ? normalizeInstagram(buyer.instagram) : '' })
    : JSON.stringify({ kind, roomNumber });
  useEffect(() => {
    if (step < 2 || (kind === 'ticket' && !gender) || (kind === 'room' && !roomNumber)) return undefined;
    const k = JSON.parse(quoteKey);
    const body = kind === 'ticket' ? { kind, gender, cedula: k.c, phone: k.p, instagram: k.i } : { kind, roomNumber };
    let alive = true;
    setQuoting(true);
    const t = setTimeout(() => {
      api('/api/public/quote', { method: 'POST', body })
        .then((d) => alive && setQuote({ key: quoteKey, ...d }))
        .catch(() => {})
        .finally(() => alive && setQuoting(false));
    }, 600);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [quoteKey, step, kind, gender, roomNumber]);

  const localBreakdown = kind === 'room'
    ? room && { phase: config.event.phase, base: roomPricing(room, config.event.phase).current, isGuest: false, discountPercent: 0, discount: 0, total: roomPricing(room, config.event.phase).current }
    : gender && { phase: config.event.phase, base: config.prices.current[gender], isGuest: false, discountPercent: 0, discount: 0, total: config.prices.current[gender] };
  const breakdown = quote?.key === quoteKey ? quote.breakdown : localBreakdown;

  const setB = (field) => (e) => setBuyer((b) => ({ ...b, [field]: e.target.value }));
  const err = (k) => errors[k];

  function nextFromDetails() {
    const cleaned = companions.filter((c) => c.name.trim() || c.cedula.trim());
    const e = { ...validateBuyer(buyer), ...(kind === 'room' ? validateCompanions(cleaned, buyer.cedula) : {}) };
    if (!acceptTerms) e.acceptTerms = 'Debes ser mayor de edad y aceptar la política para continuar.';
    if (!acceptData) e.acceptData = 'Necesitamos tu autorización para procesar la compra.';
    setCompanions(cleaned);
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    go(3);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = buildOrderPayload({ kind, gender, roomNumber, buyer, companions, paymentMethod: method });
      const data = await api('/api/public/orders', { method: 'POST', body: payload });
      rememberOrder(data.order.token);
      session.remove(KEYS.buyDraft);
      if (method === 'mercadopago') {
        if (!data.checkoutUrl) throw Object.assign(new Error(''), { code: 'PAYMENT_PROVIDER_ERROR' });
        window.location.href = data.checkoutUrl;
        return;
      }
      setOrder(data.order);
      go(4);
    } catch (e) {
      if (e.code === 'VALIDATION_ERROR' && e.details?.fields) {
        setErrors(e.details.fields);
        go(2);
      } else if (e.code === 'ROOM_UNAVAILABLE' || e.code === 'SOLD_OUT') {
        loadPublicConfig({ force: true });
        setSubmitError(describeError(e));
      } else setSubmitError(describeError(e));
    } finally {
      setSubmitting(false);
    }
  }

  const total = step === 4 ? 4 : method === 'transferencia' ? 4 : 3;
  const canNext1 = kind === 'ticket' ? ticketsOpen && gender : salesOpen && room && (room.status === 'available' || !live);

  return (
    <PublicLayout hideHeaderCta>
      <PageAtmosphere intensity="soft" />
      <PageContainer>
        <div ref={topRef} className="scroll-mt-24">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blood-light">Paso {step} de {total}</p>
            {step > 1 && step < 4 && (
              <button type="button" onClick={() => go(step - 1)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-fog hover:text-bone">
                <ArrowLeft className="h-4 w-4" /> Atrás
              </button>
            )}
          </div>
          <h1 className="mt-3 font-display text-[length:clamp(2.6rem,12vw,4rem)] uppercase leading-[0.9] text-bone">
            {['¿Qué vas a comprar?', 'Tus datos', '¿Cómo quieres pagar?', 'Transfiere y sube tu comprobante'][step - 1]}
          </h1>
          <Steps step={step} total={total} />
        </div>

        <div key={step} className="mt-8 animate-fade-up">
          {step === 1 && (
            <div className="flex flex-col gap-6">
              {!salesOpen && (
                <Notice icon={TicketX} title="Ventas en línea cerradas">
                  Aún puedes comprar en la puerta el 31: Mujeres {formatCOP(config.prices.puerta.mujer)} · Hombres {formatCOP(config.prices.puerta.hombre)}.
                </Notice>
              )}
              <div role="radiogroup" aria-label="Qué compras" className="grid gap-3">
                <OptionCard
                  active={kind === 'ticket'}
                  onClick={() => setKind('ticket')}
                  disabled={!ticketsOpen}
                  icon={Ticket}
                  title="Entrada"
                  hint={state === 'soldout' ? 'Agotadas' : `${config.event.phase === 'preventa' ? 'Preventa' : 'Venta general'} · desde ${formatCOP(Math.min(config.prices.current.mujer, config.prices.current.hombre))}`}
                />
                <OptionCard active={kind === 'room'} onClick={() => setKind('room')} disabled={!salesOpen} icon={BedDouble} title="Habitación" hint="Incluye la entrada · grupo completo, no por cama" />
              </div>

              {kind === 'ticket' && ticketsOpen && (
                <div>
                  <p className="mb-3 text-sm font-medium text-bone/90">¿Para quién es la entrada?</p>
                  <Segmented
                    size="lg"
                    columns={2}
                    ariaLabel="Género"
                    value={gender}
                    onChange={setGender}
                    options={[
                      { value: 'mujer', label: 'Mujer', hint: formatCOP(config.prices.current.mujer) },
                      { value: 'hombre', label: 'Hombre', hint: formatCOP(config.prices.current.hombre) },
                    ]}
                  />
                  <p className="mt-3 text-xs text-fog">
                    {config.event.phase === 'preventa' ? `Precio de preventa hasta el ${dayMonth(config.event.presaleEndsAt)}.` : 'Precio de venta general.'} Una entrada por cédula.
                  </p>
                </div>
              )}

              {kind === 'room' && salesOpen && (
                <div role="radiogroup" aria-label="Habitación" className="grid gap-3">
                  {config.rooms.map((r) => {
                    const free = r.status === 'available' || !live;
                    return (
                      <OptionCard
                        key={r.number}
                        active={roomNumber === r.number}
                        disabled={!free}
                        onClick={() => setRoomNumber(r.number)}
                        title={`${r.name} · ${formatCOP(roomPricing(r, config.event.phase).current)}`}
                        hint={`${r.beds ? `${r.beds} · ` : ''}${roomPeopleText(r)}${r.privateBathroom ? ' · baño privado' : ''}${roomPricing(r, config.event.phase).isPresale ? ` · preventa, después ${formatCOP(r.price)}` : ''}`}
                        right={<RoomStatusBadge status={r.status} known={live} short />}
                      />
                    );
                  })}
                  <RoomHelpNote contact={config.contact} room={room} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4" />
                  {paramRoom && live && !room && <p className="text-sm text-gold">La Habitación {paramRoom} ya no está disponible. Elige otra.</p>}
                </div>
              )}

              <Button size="lg" block disabled={!canNext1} onClick={() => go(2)}>
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                nextFromDetails();
              }}
            >
              <Input label="Nombre completo" required autoComplete="name" value={buyer.name} onChange={setB('name')} error={err('buyer.name')} maxLength={80} />
              <Input
                label="Cédula"
                required
                inputMode={alphaId ? 'text' : 'numeric'}
                autoCapitalize="characters"
                value={buyer.cedula}
                onChange={setB('cedula')}
                error={err('buyer.cedula')}
                hint={
                  <button type="button" className="underline decoration-dotted" onClick={() => setAlphaId((v) => !v)}>
                    {alphaId ? 'Usar teclado numérico' : '¿Pasaporte o documento con letras?'}
                  </button>
                }
                placeholder="Sin puntos"
              />
              <Input label="Celular" required type="tel" inputMode="tel" autoComplete="tel-national" value={buyer.phone} onChange={setB('phone')} error={err('buyer.phone')} placeholder="300 123 4567" />
              <Input label="Instagram" required leading="@" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={buyer.instagram} onChange={setB('instagram')} error={err('buyer.instagram')} placeholder="tuusuario" />
              <Input label="Correo (opcional)" type="email" autoComplete="email" value={buyer.email} onChange={setB('email')} error={err('buyer.email')} />

              {kind === 'ticket' && breakdown?.isGuest && (
                <Notice tone="gold" icon={BadgePercent} title={`Estás en la lista: −${breakdown.discountPercent}%`}>
                  Pagas {formatCOP(breakdown.total)} en vez de {formatCOP(breakdown.base)}.
                </Notice>
              )}

              {kind === 'room' && room && (
                <div className="rounded-2xl border border-white/10 bg-crypt/60 p-4">
                  <p className="font-semibold text-bone">Acompañantes (opcional)</p>
                  <p className="mt-0.5 text-xs text-fog">Esta habitación es para mínimo {room.minPeople || 1} y máximo {room.capacity} personas (tú cuentas como 1, así que puedes agregar hasta {room.capacity - 1}). Puedes completarlos después con el admin.</p>
                  {companions.length + 1 < (room.minPeople || 1) && (
                    <p className="mt-2 text-xs text-gold" role="status">Ojo: la habitación se piensa para mínimo {room.minPeople} personas. Puedes continuar igual.</p>
                  )}
                  <div className="mt-3 flex flex-col gap-3">
                    {companions.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_10rem_auto]">
                        <Input aria-label={`Nombre del acompañante ${i + 1}`} placeholder={`Acompañante ${i + 1}`} value={c.name} error={err(`companions.${i}.name`)} onChange={(e) => setCompanions((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                        <Input aria-label={`Cédula del acompañante ${i + 1}`} placeholder="Cédula (opcional)" inputMode="numeric" className="order-3 col-span-2 sm:order-none sm:col-span-1" value={c.cedula} error={err(`companions.${i}.cedula`)} onChange={(e) => setCompanions((l) => l.map((x, j) => (j === i ? { ...x, cedula: e.target.value } : x)))} />
                        <Button variant="ghost" size="icon" className="h-12 w-12" aria-label={`Quitar acompañante ${i + 1}`} onClick={() => setCompanions((l) => l.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {companions.length < room.capacity - 1 && (
                      <Button variant="secondary" onClick={() => setCompanions((l) => [...l, { name: '', cedula: '' }])}>
                        <Plus className="h-4 w-4" /> Agregar acompañante
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-2 flex flex-col gap-3">
                <Checkbox
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  error={err('acceptTerms')}
                  label={
                    <>
                      Soy mayor de edad y acepto la{' '}
                      <button type="button" className="font-semibold text-blood-light underline" onClick={(e) => { e.preventDefault(); setPolicyOpen(true); }}>
                        política de devoluciones
                      </button>
                    </>
                  }
                />
                <Checkbox checked={acceptData} onChange={(e) => setAcceptData(e.target.checked)} error={err('acceptData')} label={<>{LEGAL.data}<span className="mt-1 block text-xs text-fog/80">{LEGAL.dataDetail}</span></>} />
              </div>
              <Button type="submit" size="lg" block className="mt-2">
                Continuar al pago <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div role="radiogroup" aria-label="Método de pago" className="grid gap-3">
                {config.mercadoPago?.enabled && (
                  <OptionCard active={method === 'mercadopago'} onClick={() => setMethod('mercadopago')} icon={CreditCard} title="Tarjeta, PSE y más · Mercado Pago" hint={`Confirmación automática${config.mercadoPago.mock ? ' · modo de prueba' : ''}`} />
                )}
                <OptionCard active={method === 'transferencia'} onClick={() => setMethod('transferencia')} icon={Smartphone} title="Transferencia Nequi / Daviplata" hint="Subes el comprobante · confirmamos en pocas horas" />
              </div>
              <div className="rounded-3xl border border-white/10 bg-crypt/70 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fog">Resumen</p>
                <p className="mt-2 text-sm text-bone">{buyer.name} · CC {normalizeCedula(buyer.cedula)}</p>
                <PriceBreakdown className="mt-4" kind={kind} gender={gender} room={room} breakdown={breakdown} loading={quoting} />
              </div>
              {quote?.key === quoteKey && quote.available === false && <Notice title={describeError({ code: quote.reason }).title}>{describeError({ code: quote.reason }).message}</Notice>}
              {submitError && (
                <Notice
                  title={submitError.title}
                  action={submitError.action && <Link className="font-semibold text-blood-light underline" to={submitError.action.to}>{submitError.action.label}</Link>}
                >
                  {submitError.message}
                </Notice>
              )}
              <Button size="xl" block loading={submitting} onClick={submit} className="font-display uppercase tracking-[0.05em]">
                {method === 'mercadopago' ? `Pagar ${formatCOP(breakdown?.total)}` : `Continuar · ${formatCOP(breakdown?.total)}`}
              </Button>
              <p className="text-center text-xs text-fog">Al pagar aceptas la política de devoluciones.</p>
            </div>
          )}

          {step === 4 && order && (
            <>
              <TransferPanel order={order} config={config} onUploaded={(o) => navigate(`/orden/${o.token}`)} />
              <Link to={`/orden/${order.token}`} className="mt-6 block text-center text-sm font-semibold text-fog underline">
                Lo subo después · ver mi compra
              </Link>
            </>
          )}
        </div>
      </PageContainer>
      <PolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </PublicLayout>
  );
}
