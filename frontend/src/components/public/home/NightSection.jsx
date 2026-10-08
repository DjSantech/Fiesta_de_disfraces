import { Disc3, Lightbulb, TreePine, VenetianMask } from 'lucide-react';
import { EVENT, PILLARS } from '../../../config/event';
import { Reveal, SectionHeading } from '../ui';

const ICONS = { finca: TreePine, djs: Disc3, luces: Lightbulb, ambiente: VenetianMask };

/** Resalta "terrorífica" dentro de la descripción oficial. */
function Description() {
  const [before, after] = EVENT.description.split('terrorífica');
  if (after === undefined) return EVENT.description;
  return (
    <>
      {before}
      <span className="text-pumpkin-light">terrorífica</span>
      {after}
    </>
  );
}

export default function NightSection() {
  return (
    <section id="la-noche" aria-labelledby="la-noche-title" className="relative scroll-mt-16 overflow-hidden bg-ink py-24 sm:py-32">
      <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-ultra/10 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-end lg:gap-16">
          <SectionHeading id="la-noche-title" index="01" overline="La noche" title={<>Ven<br />disfrazado</>} />
          <Reveal delay={0.1}>
            <p className="font-serif text-[1.9rem] italic leading-[1.15] text-bone/90 sm:text-[2.6rem]">
              “<Description />”
            </p>
            <p className="mt-5 flex items-center gap-3 text-sm text-fog">
              <span className="h-px w-8 bg-pumpkin/70" aria-hidden="true" />
              {EVENT.music}
            </p>
          </Reveal>
        </div>

        <ul className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4 lg:gap-4">
          {PILLARS.map((p, i) => {
            const Icon = ICONS[p.icon] || Disc3;
            return (
              <Reveal
                as="li"
                key={p.title}
                delay={i * 0.08}
                className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-crypt/70 p-6 transition-colors duration-300 hover:border-pumpkin/35"
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-pumpkin/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  aria-hidden="true"
                />
                <div className="flex items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-pumpkin/30 bg-pumpkin/10 text-pumpkin-light shadow-[0_0_30px_-10px_rgb(255_106_0/0.9)]">
                    <Icon className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                  <span className="font-display text-sm text-bone/30">0{i + 1}</span>
                </div>
                <h3 className="mt-8 font-display text-[1.9rem] uppercase leading-none tracking-[0.01em] text-bone">{p.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-fog">{p.text}</p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
