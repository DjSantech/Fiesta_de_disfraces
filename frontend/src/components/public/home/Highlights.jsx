import { Disc3, PartyPopper, Trophy } from 'lucide-react';
import { Reveal } from '../ui';
import { Cobweb, Neon, Skull } from '../decor';

const ITEMS = [
  {
    icon: Trophy,
    before: 'PREMIO AL MEJOR ',
    neon: 'DISFRAZ',
    v: 'a',
    text: 'Ven disfrazado: el mejor disfraz de la noche se lleva premio.',
  },
  {
    icon: PartyPopper,
    before: 'DINÁMICAS DURANTE LA ',
    neon: 'NOCHE',
    v: 'b',
    text: 'Juegos y sorpresas en la pista para que nadie se quede sentado.',
  },
  {
    icon: Disc3,
    before: '3 DJs ',
    neon: 'DIFERENTES',
    v: 'c',
    text: 'Fiesta crossover: tres sets distintos, de todo un poco.',
  },
];

/** Tres razones para ir, justo debajo del hero. */
export default function Highlights() {
  return (
    <section id="destacados" aria-label="Lo que te espera" className="relative scroll-mt-16 overflow-hidden bg-ink py-14 sm:py-20">
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[80%] -translate-x-1/2 rounded-full bg-pumpkin/10 blur-3xl" aria-hidden="true" />
      <ul className="relative mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:gap-6 lg:px-8">
        {ITEMS.map(({ icon: Icon, before, neon, v, text }, i) => (
          <Reveal
            as="li"
            key={neon}
            delay={i * 0.1}
            className="group relative rounded-[28px] bg-linear-to-br from-pumpkin via-pumpkin-dark/60 to-ember/70 p-[1.5px] shadow-[0_0_44px_-14px_rgb(255_106_0/0.7)]"
          >
            <div className="relative h-full overflow-hidden rounded-[27px] bg-crypt px-6 pb-7 pt-7 sm:px-7">
              <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-pumpkin/20 blur-3xl" aria-hidden="true" />
              <Cobweb corner="tr" className="absolute right-0 top-0 h-20 w-20" opacity={0.3} />
              <Skull className="absolute -bottom-3 -right-2 h-16 w-14 rotate-6 text-bone/[0.07]" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-pumpkin/50 bg-pumpkin/15 text-pumpkin-light shadow-[0_0_36px_-6px_rgb(255_106_0/0.9)]">
                <Icon className="h-8 w-8" strokeWidth={1.5} />
              </span>
              <h3 className="relative mt-6 font-display text-[2.1rem] uppercase leading-[0.95] text-bone sm:text-[2.4rem]">
                {before}
                <Neon v={v} delay={i * 0.8} className="text-pumpkin-light">{neon}</Neon>
              </h3>
              <p className="relative mt-3 text-[15px] leading-relaxed text-fog">{text}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
