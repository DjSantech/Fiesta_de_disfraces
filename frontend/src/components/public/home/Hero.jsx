import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, BedDouble, CalendarDays, Clock3, Disc3, MapPin, TicketX, Ticket } from 'lucide-react';
import { EVENT } from '../../../config/event';
import { formatCOP, formatTime, whatsappLink } from '../../../lib/format';
import Countdown from '../Countdown';
import { Embers } from '../ui';
import { Bat, Cobweb, Neon, Pumpkin, Skull } from '../decor';
import { roomsAvailable, salesState } from '../usePublicConfig';
import { dayMonth } from '../utils/dates';

/** Clases de entrada escalonada: solo animan cuando la intro ya salió (`ready`). */
function enter(ready, delay) {
  return {
    className: ready ? 'animate-fade-up' : 'opacity-0',
    style: ready ? { animationDelay: `${delay}ms` } : undefined,
  };
}

function Counter({ counter }) {
  if (!counter || !counter.capacity) return null;
  const pct = Math.min(100, Math.round((counter.sold / counter.capacity) * 100));
  return (
    <div className="mx-auto mt-5 w-full max-w-sm">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold uppercase tracking-[0.2em] text-fog">Cupos</span>
        <span className="font-semibold text-bone">
          {counter.remaining > 0 ? `Quedan ${counter.remaining} de ${counter.capacity}` : 'Sin cupos'}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-label="Cupos vendidos"
        aria-valuemin={0}
        aria-valuemax={counter.capacity}
        aria-valuenow={counter.sold}
      >
        <div className="h-full rounded-full bg-linear-to-r from-pumpkin-dark via-pumpkin to-ember" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function HeroCta({ config, size = 'hero', className }) {
  const state = salesState(config);
  const presale = dayMonth(config.event.presaleEndsAt);
  const door = config.prices.puerta;

  if (state === 'preventa' || state === 'general') {
    return (
      <div className={clsx('flex w-full flex-col items-center', className)}>
        <Link
          to="/comprar"
          className={clsx(
            'fd-shine group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-pumpkin font-display uppercase text-white animate-pulse-glow transition hover:bg-pumpkin-light active:scale-[0.99] active:bg-pumpkin-dark',
            size === 'hero' ? 'h-[4.25rem] max-w-xl px-5 text-[length:clamp(1.12rem,5.3vw,1.7rem)] tracking-[0.035em]' : 'h-16 max-w-md px-6 text-xl tracking-[0.04em]',
          )}
        >
          <span className="relative z-[2]">{state === 'preventa' ? 'Compra tu entrada en preventa' : 'Compra tu entrada'}</span>
          <ArrowRight className="relative z-[2] h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" strokeWidth={2.25} />
        </Link>
        <p className="mt-3 flex items-center gap-2 text-sm text-fog">
          <Clock3 className="h-4 w-4 text-pumpkin-light" strokeWidth={1.75} />
          {state === 'preventa' ? (
            <span>
              Preventa hasta el <span className="font-semibold text-bone">{presale}</span>
            </span>
          ) : (
            <span>
              Venta general · Mujeres {formatCOP(config.prices.current.mujer)} · Hombres {formatCOP(config.prices.current.hombre)}
            </span>
          )}
        </p>
        <Counter counter={config.counter} />
      </div>
    );
  }

  const rooms = roomsAvailable(config);
  return (
    <div className={clsx('mx-auto flex w-full max-w-xl flex-col items-center', className)}>
      <div className="w-full rounded-2xl border border-white/12 bg-white/[0.035] px-5 py-5 text-center backdrop-blur-sm">
        <p className="flex items-center justify-center gap-2 font-display text-[1.6rem] uppercase tracking-[0.05em] text-bone">
          <TicketX className="h-6 w-6 text-pumpkin-light" strokeWidth={1.75} />
          {state === 'soldout' ? 'Entradas agotadas' : 'Ventas en línea cerradas'}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-fog">
          {state === 'soldout' ? (
            'Se llenó el aforo. Escríbele a DJ Santech por si se libera algún cupo.'
          ) : (
            <>
              Aún puedes comprar en la puerta el 31: Mujeres <span className="text-bone">{formatCOP(door.mujer)}</span> · Hombres{' '}
              <span className="text-bone">{formatCOP(door.hombre)}</span>.
            </>
          )}
        </p>
      </div>
      <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row">
        {state === 'soldout' && rooms && (
          <Link
            to="/comprar?tipo=habitacion"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-pumpkin text-sm font-semibold text-white transition hover:bg-pumpkin-light"
          >
            <BedDouble className="h-4 w-4" />
            Aún hay habitaciones
          </Link>
        )}
        <a
          href={whatsappLink(config.contact.whatsapp, 'Hola DJ Santech, quiero saber si hay cupos para la Fiesta de Disfraces.')}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] text-sm font-semibold text-bone transition hover:bg-white/[0.08]"
        >
          Escribirle a {config.contact.adminName || 'DJ Santech'}
        </a>
      </div>
    </div>
  );
}

export default function Hero({ config, ready }) {
  const time = formatTime(config.event.startsAt);
  const meta = [
    { icon: CalendarDays, text: `${EVENT.dateLabel}${time ? ` · ${time}` : ''}` },
    { icon: MapPin, text: `${EVENT.venue} · ${EVENT.zone} · ubicación exacta el 31` },
    { icon: Disc3, text: 'DJs toda la noche' },
  ];

  return (
    <section aria-labelledby="hero-title" className="relative flex min-h-[100svh] flex-col overflow-hidden">
      {/* Atmósfera */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="fd-hero-glow absolute inset-0" />
        <div className="fd-beam fd-beam--left" />
        <div className="fd-beam fd-beam--right" />
        <span className="fd-text-stroke absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 select-none font-display text-[92vw] leading-none sm:text-[44vw]">
          31
        </span>
        <div className="fog-layer" />
        <Cobweb corner="tl" className="absolute left-0 top-0 h-44 w-44 sm:h-72 sm:w-72" opacity={0.3} />
        <Cobweb corner="tr" className="absolute right-0 top-0 h-44 w-44 sm:h-72 sm:w-72" opacity={0.3} />
        <Bat className="fd-bat absolute left-[22%] top-[17%] h-4 w-10 text-bone/20" />
        <Bat className="fd-bat fd-bat--b absolute right-[18%] top-[24%] h-3 w-8 text-bone/15" />
        <Pumpkin className="absolute -bottom-3 -left-6 h-24 w-28 opacity-90 sm:bottom-6 sm:left-[6%] sm:h-44 sm:w-48" />
        <Skull className="absolute -right-3 bottom-24 hidden h-28 w-24 rotate-6 text-bone/25 sm:block" glow />
        <Embers count={18} />
        <div className="vignette absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-b from-transparent to-ink" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-14 pt-28 text-center sm:px-6 sm:pt-32">
        <p {...enter(ready, 0)}>
          <span className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-bone/85 sm:text-xs">
            <span className="h-px w-7 bg-pumpkin" aria-hidden="true" />
            {EVENT.presenter}
            <span className="h-px w-7 bg-pumpkin" aria-hidden="true" />
          </span>
        </p>

        <h1 id="hero-title" className="mt-5 font-display uppercase leading-[0.84]">
          <span className={clsx('block', enter(ready, 120).className)} style={enter(ready, 120).style}>
            <span className="fd-title-bone relative block text-[length:clamp(4rem,19.5vw,10.5rem)]">
              Fiesta de
              <Cobweb corner="tl" className="absolute -left-1 top-0 h-14 w-14 sm:h-24 sm:w-24" opacity={0.55} />
            </span>
          </span>
          <span className={clsx('block', enter(ready, 240).className)} style={enter(ready, 240).style}>
            <span className="fd-title-pumpkin relative block text-[length:clamp(4rem,19.5vw,10.5rem)]">
              Disfra<span className="animate-flicker">c</span>es
              <Cobweb corner="tr" className="absolute -right-1 top-0 h-14 w-14 sm:h-24 sm:w-24" opacity={0.55} />
              <Skull className="absolute -top-1 -left-1 -top-3 h-[0.42em] w-[0.38em] -rotate-12 text-bone/70" glow />
            </span>
          </span>
        </h1>

        <p {...enter(ready, 380)}>
          <span className="mt-4 block font-serif text-[1.7rem] italic leading-tight text-bone/90 sm:text-[2.6rem]">
            La noche más <Neon v="b" delay={1.3} className="text-pumpkin-light">terrorífica</Neon> del año
          </span>
        </p>

        <ul className={clsx('mt-7 flex flex-col items-center gap-2.5 text-sm text-fog sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6', enter(ready, 480).className)} style={enter(ready, 480).style}>
          {meta.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-pumpkin-light" strokeWidth={1.75} />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <div className={clsx('mt-9 w-full max-w-md', enter(ready, 600).className)} style={enter(ready, 600).style}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-fog">Faltan</p>
          <Countdown target={config.event.startsAt} />
        </div>

        <div className={clsx('mt-8 w-full', enter(ready, 720).className)} style={enter(ready, 720).style}>
          <HeroCta config={config} />
          <a href="#lista" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-pumpkin-light underline-offset-4 hover:underline">
            <Ticket className="h-4 w-4" strokeWidth={1.75} />
            ¿Estás en la lista de invitados?
          </a>
        </div>
      </div>

      <a
        href="#la-noche"
        className={clsx('relative z-10 mx-auto mb-6 flex flex-col items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-fog/80 transition hover:text-bone', enter(ready, 900).className)}
        style={enter(ready, 900).style}
      >
        Desliza
        <span className="relative block h-10 w-px overflow-hidden bg-white/10" aria-hidden="true">
          <span className="absolute inset-x-0 top-0 h-4 animate-float bg-pumpkin" />
        </span>
      </a>
    </section>
  );
}
