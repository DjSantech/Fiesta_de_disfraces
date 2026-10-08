import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, BadgePercent, DoorOpen, Sparkles } from 'lucide-react';
import { GUEST_NOTE } from '../../../config/event';
import { formatCOP } from '../../../lib/format';
import { Reveal, SectionHeading } from '../ui';
import { salesState } from '../usePublicConfig';
import { dayMonth, daysUntil } from '../utils/dates';

function PriceRow({ label, value, save, struck }) {
  return (
    <div className="flex items-end justify-between gap-4 border-t border-white/[0.07] py-4 first:border-t-0">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-fog">{label}</p>
        {save > 0 && !struck && (
          <p className="mt-1.5 inline-flex items-center rounded-full bg-ember/12 px-2 py-0.5 text-[11px] font-semibold text-ember">
            Ahorras {formatCOP(save)}
          </p>
        )}
      </div>
      <p
        className={clsx(
          'font-display text-[2.6rem] leading-none tabular-nums sm:text-5xl',
          struck ? 'text-smoke line-through decoration-blood/70 decoration-2' : 'text-bone',
        )}
      >
        {formatCOP(value)}
      </p>
    </div>
  );
}

export default function PricesSection({ config }) {
  const state = salesState(config);
  const { preventa, puerta } = config.prices;
  const presaleOver = config.event.phase === 'general';
  const presaleDate = dayMonth(config.event.presaleEndsAt);
  const days = daysUntil(config.event.presaleEndsAt);
  const canBuy = state === 'preventa' || state === 'general';

  return (
    <section id="precios" aria-labelledby="precios-title" className="relative scroll-mt-16 overflow-hidden bg-night py-24 sm:py-32">
      <div className="pointer-events-none absolute right-0 top-0 h-[28rem] w-[28rem] translate-x-1/3 -translate-y-1/4 rounded-full bg-blood/10 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="precios-title"
          index="02"
          overline="Entradas"
          title="Precios"
          accent={presaleOver ? 'La preventa ya terminó: ahora es venta general.' : 'Entre más temprano, más barato.'}
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-2 lg:gap-6">
          {/* Preventa */}
          <Reveal
            className={clsx(
              'relative overflow-hidden rounded-[28px] p-6 sm:p-8',
              presaleOver ? 'border border-white/[0.08] bg-crypt/50' : 'noise-border bg-[linear-gradient(160deg,rgb(225_29_46/0.16),rgb(21_21_28/0.92)_45%)] shadow-[0_30px_80px_-30px_rgb(225_29_46/0.55)]',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className={clsx('font-display text-4xl uppercase leading-none sm:text-5xl', presaleOver ? 'text-fog' : 'text-bone')}>Preventa</h3>
              {presaleOver ? (
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-fog">Terminó el {presaleDate}</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blood/40 bg-blood/15 px-3 py-1 text-xs font-semibold text-blood-light">
                  <Sparkles className="h-3.5 w-3.5" />
                  Hasta el {presaleDate}
                  {days > 0 && days <= 10 ? ` · quedan ${days} ${days === 1 ? 'día' : 'días'}` : ''}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-fog">En línea, con tu QR único.</p>
            <div className="mt-5">
              <PriceRow label="Mujeres" value={preventa.mujer} save={puerta.mujer - preventa.mujer} struck={presaleOver} />
              <PriceRow label="Hombres" value={preventa.hombre} save={puerta.hombre - preventa.hombre} struck={presaleOver} />
            </div>
            {!presaleOver && canBuy && (
              <Link
                to="/comprar"
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blood font-display text-lg uppercase tracking-[0.06em] text-white shadow-[0_0_30px_-8px_rgb(225_29_46/0.9)] transition hover:bg-blood-light"
              >
                Comprar en preventa
                <ArrowRight className="h-5 w-5" />
              </Link>
            )}
          </Reveal>

          {/* Puerta / venta general */}
          <Reveal
            delay={0.08}
            className={clsx(
              'relative overflow-hidden rounded-[28px] p-6 sm:p-8',
              presaleOver ? 'noise-border bg-[linear-gradient(160deg,rgb(225_29_46/0.16),rgb(21_21_28/0.92)_45%)]' : 'border border-white/[0.08] bg-crypt/60',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-4xl uppercase leading-none text-bone sm:text-5xl">{presaleOver ? 'Venta general' : 'En puerta'}</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-fog">
                <DoorOpen className="h-3.5 w-3.5" />
                {presaleOver ? 'En línea y en puerta' : 'El 31, en la entrada'}
              </span>
            </div>
            <p className="mt-2 text-sm text-fog">{presaleOver ? 'Compra en línea y llega con tu QR.' : 'Si quedan cupos el día de la fiesta.'}</p>
            <div className="mt-5">
              <PriceRow label="Mujeres" value={puerta.mujer} />
              <PriceRow label="Hombres" value={puerta.hombre} />
            </div>
            {presaleOver && canBuy && (
              <Link
                to="/comprar"
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blood font-display text-lg uppercase tracking-[0.06em] text-white shadow-[0_0_30px_-8px_rgb(225_29_46/0.9)] transition hover:bg-blood-light"
              >
                Comprar entrada
                <ArrowRight className="h-5 w-5" />
              </Link>
            )}
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-4 flex items-start gap-3 rounded-2xl border border-gold/25 bg-gold/[0.06] p-4 sm:items-center sm:p-5">
          <BadgePercent className="mt-0.5 h-5 w-5 shrink-0 text-gold sm:mt-0" strokeWidth={1.75} />
          <p className="text-sm leading-relaxed text-bone/90">{GUEST_NOTE}</p>
        </Reveal>

        {!canBuy && (
          <p className="mt-4 text-center text-sm text-fog">
            {state === 'soldout' ? 'Entradas agotadas en línea.' : 'Las ventas en línea están cerradas; aún puedes comprar en la puerta.'}
          </p>
        )}
      </div>
    </section>
  );
}
