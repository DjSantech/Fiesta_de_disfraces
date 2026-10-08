import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import QRCode from 'qrcode';
import { Check, ExternalLink, Share2 } from 'lucide-react';
import { EVENT } from '../../config/event';
import { formatTime } from '../../lib/format';
import { GENDER_LABEL } from '../../lib/labels';
import { copyText } from './ui';
import { shortWeekdayDate } from './utils/dates';

export const ticketUrl = (token) => `${window.location.origin}/entrada/${token}`;

export function ticketTypeLabel(t) {
  if (t.kind === 'cortesia') return 'Cortesía';
  if (t.kind === 'room') return `Habitación ${t.roomNumber ?? ''}`.trim();
  if (t.isGuest) return 'Invitado';
  return t.phase === 'general' ? 'General' : 'Preventa';
}

export function ticketStatus(t) {
  if (t.status === 'used') return { label: `Ya ingresó a las ${formatTime(t.checkedInAt)}`, cls: 'border-ultra/40 bg-ultra/15 text-violet-300' };
  if (t.status === 'void') return { label: 'Anulada', cls: 'border-blood/40 bg-blood/15 text-blood-light' };
  return { label: 'Válida', cls: 'border-toxic/40 bg-toxic/10 text-toxic' };
}

/** QR negro sobre blanco con margen (no invertir: los escáneres lo necesitan). */
export function TicketQR({ token, className, dimmed }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(ticketUrl(token), { errorCorrectionLevel: 'M', margin: 3, width: 720, color: { dark: '#000000', light: '#ffffff' } })
      .then((u) => alive && setSrc(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);
  return (
    <div className={clsx('relative rounded-2xl bg-white p-2', className)}>
      {src ? (
        <img src={src} alt="Código QR de tu entrada" className={clsx('block aspect-square w-full [image-rendering:pixelated]', dimmed && 'opacity-20 blur-[2px]')} />
      ) : (
        <div className="aspect-square w-full animate-pulse rounded-xl bg-neutral-200" />
      )}
      {dimmed && <span className="absolute inset-0 flex items-center justify-center font-display text-4xl uppercase text-blood">Anulada</span>}
    </div>
  );
}

/** Boleto premium. */
export function TicketCard({ ticket, startsAt, children, compact }) {
  const st = ticketStatus(ticket);
  return (
    <article className="noise-border relative overflow-hidden rounded-[28px] bg-[linear-gradient(170deg,#1a1016,#121218_40%)] shadow-[0_40px_90px_-40px_rgb(225_29_46/0.6)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(70%_100%_at_50%_0%,rgb(225_29_46/0.3),transparent)]" aria-hidden="true" />
      <header className="relative px-6 pt-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-bone/70">{EVENT.presenter}</p>
        <p className="mt-2 font-display text-[2.4rem] uppercase leading-[0.88] text-bone">
          Fiesta de <span className="fd-title-blood">Disfraces</span>
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-fog">
          {shortWeekdayDate(startsAt)} · {formatTime(startsAt)} · {EVENT.city}
        </p>
      </header>
      <div className={clsx('relative mx-auto mt-5 px-6', compact ? 'max-w-[230px]' : 'max-w-[300px]')}>
        <TicketQR token={ticket.token} dimmed={ticket.status === 'void'} />
        <p className="mt-4 text-center font-display text-3xl tracking-[0.12em] text-bone">{ticket.code}</p>
      </div>
      <div className="relative my-5 h-px border-t border-dashed border-white/15">
        <span className="fd-ticket-notch -left-[13px]" />
        <span className="fd-ticket-notch -right-[13px]" />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-6 pb-6 text-sm">
        <div className="col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fog">Titular</dt>
          <dd className="mt-0.5 font-semibold text-bone">{ticket.holderName}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fog">Tipo</dt>
          <dd className="mt-0.5 font-semibold text-bone">
            {ticketTypeLabel(ticket)}
            {ticket.gender ? ` · ${GENDER_LABEL[ticket.gender]}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fog">Estado</dt>
          <dd className="mt-1">
            <span className={clsx('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold', st.cls)}>{st.label}</span>
          </dd>
        </div>
      </dl>
      {children && <div className="border-t border-white/[0.07] px-6 py-4">{children}</div>}
    </article>
  );
}

/** Compartir / copiar el enlace de un ticket (acompañantes de habitación). */
export function ShareTicketLink({ ticket }) {
  const [done, setDone] = useState(false);
  async function share() {
    const url = ticketUrl(ticket.token);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tu entrada · Fiesta de Disfraces', text: `Entrada de ${ticket.holderName}`, url });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    if (await copyText(url)) {
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    }
  }
  return (
    <div className="flex gap-2">
      <button type="button" onClick={share} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] text-sm font-semibold text-bone hover:bg-white/[0.08]">
        {done ? <Check className="h-4 w-4 text-toxic" /> : <Share2 className="h-4 w-4" />}
        {done ? 'Enlace copiado' : 'Compartir entrada'}
      </button>
      <Link to={`/entrada/${ticket.token}`} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 text-fog hover:text-bone" aria-label={`Abrir entrada de ${ticket.holderName}`}>
        <ExternalLink className="h-4 w-4" />
      </Link>
    </div>
  );
}
