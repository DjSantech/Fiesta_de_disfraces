import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Loader2, Search, Ticket } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { whatsappLink, formatCOP } from '../../lib/format';
import { Cobweb, Pumpkin } from './decor';
import { Reveal } from './ui';
import { usePublicConfig } from './usePublicConfig';

/** Link a /comprar con el dato escrito prellenado (solo @instagram o número). Nada se guarda en storage. */
function buyLink(query) {
  const q = query.trim();
  const p = new URLSearchParams({ invitado: '1' });
  if (q.startsWith('@') && q.length > 1) p.set('instagram', q.replace(/^@+/, ''));
  else if (/^[\d.\s-]{5,}$/.test(q)) p.set('cedula', q.replace(/\D/g, ''));
  return `/comprar?${p.toString()}`;
}

function errorText(err) {
  if (err instanceof ApiError) {
    if (err.status === 429 || err.code === 'RATE_LIMITED') return 'Has consultado muchas veces seguidas. Espera un par de minutos e inténtalo de nuevo.';
    if (err.status === 400) return 'Escribe tu @Instagram, tu cédula o tu nombre completo.';
  }
  return 'No pudimos consultar la lista en este momento. Revisa tu conexión e inténtalo otra vez.';
}

function BuyButton({ to, children, tone = 'pumpkin' }) {
  return (
    <Link
      to={to}
      className={clsx(
        'mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold uppercase tracking-[0.06em] transition',
        tone === 'pumpkin'
          ? 'bg-pumpkin text-white shadow-[0_0_26px_-8px_rgb(255_106_0/0.9)] hover:bg-pumpkin-light'
          : 'border border-white/15 bg-white/[0.05] text-bone hover:bg-white/[0.1]',
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function Result({ res, query, contact }) {
  const name = res.firstName ? res.firstName : 'bienvenido';
  if (res.found && res.redeemed) {
    return (
      <div role="status" className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
        <p className="font-display text-2xl uppercase text-bone">Ya usaste tu invitación</p>
        <p className="mt-1 text-sm text-fog">Esta invitación ya fue reclamada. Si crees que es un error, escríbele al administrador.</p>
      </div>
    );
  }
  if (res.found && res.kind === 'cortesia') {
    return (
      <div role="status" className="rounded-2xl border border-pumpkin/50 bg-pumpkin/[0.1] p-5 shadow-[0_0_40px_-18px_rgb(255_106_0/0.9)]">
        <p className="font-display text-[1.7rem] uppercase leading-tight text-bone">
          ¡{name}, tienes entrada de <span className="text-pumpkin-light">cortesía</span>!
        </p>
        <p className="mt-1 text-sm text-fog">Resérvala ahora para recibir tu QR.</p>
        <BuyButton to={buyLink(query)}>Reclamar mi entrada</BuyButton>
      </div>
    );
  }
  if (res.found && res.kind === 'descuento') {
    const desc = res.discountPercent
      ? `${res.discountPercent}% de descuento`
      : res.phase === 'preventa'
        ? `${formatCOP(res.presaleDiscount)} de descuento en tu entrada de preventa`
        : res.generalDiscount > 0
          ? `${formatCOP(res.generalDiscount)} de descuento sobre el precio de preventa`
          : 'tu precio de preventa conservado';
    return (
      <div role="status" className="rounded-2xl border border-pumpkin/40 bg-pumpkin/[0.08] p-5">
        <p className="font-display text-[1.7rem] uppercase leading-tight text-bone">
          {name !== 'bienvenido' && <>{name}: </>}tienes <span className="text-pumpkin-light">{desc}</span>
        </p>
        <p className="mt-1 text-sm text-fog">Se aplica solo al comprar con los mismos datos.</p>
        <BuyButton to={buyLink(query)}>Comprar con descuento</BuyButton>
      </div>
    );
  }
  if (res.ambiguous) {
    return (
      <div role="status" className="rounded-2xl border border-gold/30 bg-gold/[0.06] p-5">
        <p className="font-display text-2xl uppercase text-gold">Varias coincidencias</p>
        <p className="mt-1 text-sm text-bone/90">Encontramos varias coincidencias, consulta con tu @Instagram o cédula.</p>
      </div>
    );
  }
  return (
    <div role="status" className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
      <p className="font-display text-2xl uppercase text-bone">No apareces en la lista</p>
      <p className="mt-1 text-sm text-fog">Revisa que esté bien escrito. Si deberías estar, escríbele al administrador.</p>
      <div className="flex flex-wrap gap-2">
        {contact?.whatsapp && (
          <a
            href={whatsappLink(contact.whatsapp, 'Hola, creo que debería estar en la lista de invitados de la Fiesta de Disfraces.')}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-12 items-center rounded-xl border border-toxic/40 bg-toxic/[0.08] px-5 text-sm font-semibold text-bone transition hover:bg-toxic/[0.14]"
          >
            Escribir por WhatsApp
          </a>
        )}
        <BuyButton to="/comprar" tone="ghost">Comprar entrada</BuyButton>
      </div>
    </div>
  );
}

export default function GuestCheck({ className }) {
  const { config } = usePublicConfig();
  const [value, setValue] = useState('');
  const [state, setState] = useState({ status: 'idle' });
  const seq = useRef(0);

  async function submit(e) {
    e.preventDefault();
    const query = value.trim();
    if (query.length < 3) {
      setState({ status: 'error', message: 'Escribe tu @Instagram, tu cédula o tu nombre completo.' });
      return;
    }
    const mine = ++seq.current;
    setState({ status: 'loading' });
    try {
      const res = await api('/api/public/guest-check', { method: 'POST', body: { query } });
      if (mine === seq.current) setState({ status: 'done', res, query });
    } catch (err) {
      if (mine === seq.current) setState({ status: 'error', message: errorText(err) });
    }
  }

  const loading = state.status === 'loading';
  return (
    <Reveal
      id="lista"
      delay={0.1}
      className={clsx('noise-border relative scroll-mt-20 overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,rgb(255_106_0/0.12),rgb(21_21_28/0.94)_50%)] p-5 sm:p-8', className)}
    >
      <Cobweb corner="tr" className="absolute right-0 top-0 h-24 w-24 sm:h-32 sm:w-32" opacity={0.22} />
      <Pumpkin className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-[4.5rem] opacity-60 sm:h-24 sm:w-28" />
      <div className="relative">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-pumpkin-light">
          <Ticket className="h-4 w-4" strokeWidth={1.75} />
          Lista de invitados
        </p>
        <h3 className="mt-2 font-display text-[2.1rem] uppercase leading-none text-bone sm:text-5xl">¿Estás en la lista?</h3>
        <p className="mt-2 max-w-xl text-sm text-fog">Escribe tu @Instagram (o tu cédula, o tu nombre completo) y mira si tienes cortesía o descuento. Es rápido y no guardamos lo que escribes.</p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row" noValidate>
          <label className="sr-only" htmlFor="guest-query">@Instagram, cédula o nombre completo</label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-smoke" />
            <input
              id="guest-query"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ej: @santiguevara_05"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={80}
              className="h-14 w-full rounded-2xl border border-white/12 bg-ink/70 pl-12 pr-4 text-base text-bone placeholder:text-smoke focus:border-pumpkin-light/70 focus:outline-none focus:ring-2 focus:ring-pumpkin/30"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-pumpkin px-7 font-display text-lg uppercase tracking-[0.06em] text-white shadow-[0_0_26px_-8px_rgb(255_106_0/0.9)] transition hover:bg-pumpkin-light disabled:opacity-70"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {loading ? 'Consultando' : 'Consultar'}
          </button>
        </form>

        <div className="mt-4 min-h-0" aria-live="polite">
          {state.status === 'error' && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-light">{state.message}</p>
          )}
          {state.status === 'done' && <Result res={state.res} query={state.query} contact={config.contact} />}
        </div>
      </div>
    </Reveal>
  );
}
