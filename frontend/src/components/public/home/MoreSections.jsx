import { Link } from 'react-router-dom';
import { ArrowRight, Ban, Car, Droplets, ExternalLink, HardHat, IdCard, Motorbike, Plus, ScrollText } from 'lucide-react';
import { FAQ, IMPORTANT_INFO, PARKING_NOTE, REFUND_POLICY, SPONSORS } from '../../../config/event';
import { formatCOP } from '../../../lib/format';
import FincaMap from '../FincaMap';
import { Reveal, SectionHeading } from '../ui';
import { HeroCta } from './Hero';

const wrap = 'relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8';

export function MapSection({ config, known }) {
  return (
    <section id="mapa" aria-labelledby="mapa-title" className="relative scroll-mt-16 bg-night py-24 sm:py-32">
      <div className={wrap}>
        <SectionHeading id="mapa-title" index="04" overline="La finca" title="El mapa" accent="Así se ve la noche desde arriba." />
        <Reveal className="mt-12">
          <FincaMap config={config} known={known} />
        </Reveal>
      </div>
    </section>
  );
}

export function InfoSection({ config }) {
  const p = config.parking || {};
  const parking = [
    { icon: Car, label: 'Carro', value: p.carro },
    { icon: Motorbike, label: 'Moto', value: p.moto },
    { icon: HardHat, label: 'Guardado de casco', value: p.casco },
  ];
  const icons = { hidratacion: Droplets, edad: IdCard, admision: Ban };
  return (
    <section id="info" aria-labelledby="info-title" className="relative scroll-mt-16 bg-ink py-24 sm:py-32">
      <div className={wrap}>
        <SectionHeading id="info-title" index="05" overline="Antes de ir" title="Info importante" />
        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          <Reveal className="rounded-[28px] border border-white/[0.08] bg-crypt/70 p-6 sm:p-8">
            <h3 className="font-display text-3xl uppercase text-bone">Parqueadero</h3>
            <ul className="mt-5 grid grid-cols-3 gap-2">
              {parking.map(({ icon: I, label, value }) => (
                <li key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
                  <I className="mx-auto h-6 w-6 text-gold" strokeWidth={1.5} />
                  <p className="mt-2 text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-fog">{label}</p>
                  <p className="mt-1 font-display text-2xl text-bone">{formatCOP(value)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-fog">{PARKING_NOTE}</p>
          </Reveal>
          <Reveal delay={0.08} as="ul" className="flex flex-col gap-3">
            {IMPORTANT_INFO.map((i) => {
              const I = icons[i.icon] || Ban;
              return (
                <li key={i.title} className="flex gap-4 rounded-3xl border border-white/[0.08] bg-crypt/70 p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blood/30 bg-blood/10 text-blood-light">
                    <I className="h-5 w-5" strokeWidth={1.6} />
                  </span>
                  <div>
                    <h3 className="font-semibold text-bone">{i.title}</h3>
                    <p className="mt-0.5 text-sm text-fog">{i.text}</p>
                  </div>
                </li>
              );
            })}
          </Reveal>
        </div>
        <Reveal id="politica" className="mt-4 rounded-[28px] border border-white/[0.08] bg-night p-6 sm:p-8">
          <h3 className="flex items-center gap-3 font-display text-2xl uppercase text-bone sm:text-3xl">
            <ScrollText className="h-6 w-6 text-blood-light" strokeWidth={1.6} /> Política de devoluciones
          </h3>
          <ul className="mt-4 flex flex-col gap-3">
            {REFUND_POLICY.map((t) => (
              <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-fog">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-blood" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="relative scroll-mt-16 bg-night py-24 sm:py-32">
      <div className={`${wrap} grid gap-10 lg:grid-cols-[1fr_1.4fr]`}>
        <SectionHeading id="faq-title" index="06" overline="Preguntas" title={<>Lo que<br />preguntan</>} />
        <Reveal className="flex flex-col gap-2">
          {FAQ.map((f) => (
            <details key={f.q} className="fd-faq group rounded-2xl border border-white/[0.08] bg-crypt/70 open:border-blood/30">
              <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 font-semibold text-bone">
                {f.q}
                <Plus className="fd-faq-icon h-5 w-5 shrink-0 text-blood-light transition-transform" />
              </summary>
              <div className="px-5 pb-5 text-[15px] leading-relaxed text-fog">
                {f.a}
                {f.link && (
                  <Link to={f.link.to} className="mt-3 flex items-center gap-1.5 font-semibold text-blood-light">
                    {f.link.label} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

export function SponsorsSection() {
  return (
    <section id="patrocinadores" aria-labelledby="sponsors-title" className="relative bg-ink py-24 sm:py-28">
      <div className={wrap}>
        <SectionHeading id="sponsors-title" index="07" overline="Patrocinadores" title="Con el apoyo de" />
        <ul className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {SPONSORS.map((s) => (
            <li key={s.name}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col items-center justify-center gap-3 rounded-3xl border border-white/[0.08] bg-crypt/60 p-5 text-center transition hover:border-blood/35"
              >
                {s.logo ? (
                  <img src={s.logo} alt={s.name} loading="lazy" className="h-14 w-auto object-contain" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-white/20 font-display text-xl text-bone/70" aria-hidden="true">
                    {s.name.split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('')}
                  </span>
                )}
                <span className="text-sm font-semibold text-bone">{s.name}</span>
                <span className="flex items-center gap-1 text-xs text-fog group-hover:text-blood-light">
                  {s.url.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FinalCta({ config }) {
  return (
    <section className="relative overflow-hidden bg-ink py-24 text-center">
      <div className="fd-hero-glow pointer-events-none absolute inset-0 opacity-80" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl px-4">
        <p className="font-display text-[length:clamp(3.2rem,15vw,8rem)] uppercase leading-[0.86] text-bone">
          Nos vemos <span className="fd-title-blood">el 31</span>
        </p>
        <p className="mt-4 font-serif text-2xl italic text-fog">Ven disfrazado. El resto lo pone la noche.</p>
        <HeroCta config={config} className="mt-10" />
      </div>
    </section>
  );
}
