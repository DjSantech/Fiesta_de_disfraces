import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Link2, Share2 } from 'lucide-react';
import { Overline, Reveal } from '../ui';

const STEPS = [
  { icon: Link2, title: 'Tu propio link', text: 'Te registras con tu celular y recibes un link y un QR solo tuyos.' },
  { icon: Share2, title: 'Compártelo', text: 'Mándalo por WhatsApp, historias o donde quieras.' },
  { icon: BarChart3, title: 'Mira tus ventas', text: 'Ves en tiempo real cuántos entraron con tu link y cuántos compraron.' },
];

/** Llamado para promotores: vender boletas con link propio (va antes de FinalCta). */
export default function PromotersSection() {
  return (
    <section id="promotores" aria-labelledby="promotores-titulo" className="relative scroll-mt-16 overflow-hidden bg-night py-20 sm:py-28">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-pumpkin/10 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="rounded-[28px] bg-linear-to-br from-pumpkin/70 via-pumpkin-dark/30 to-white/[0.06] p-[1.5px] shadow-[0_0_60px_-24px_rgb(255_106_0/0.8)]">
          <div className="rounded-[26.5px] bg-crypt/95 p-6 sm:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              <div>
                <Overline>Promotores</Overline>
                <h2 id="promotores-titulo" className="mt-4 font-display text-[length:clamp(2.5rem,10.5vw,5rem)] uppercase leading-[0.9] text-bone">
                  ¿Quieres ganar dinero <span className="fd-title-pumpkin">vendiendo boletas?</span>
                </h2>
                <p className="mt-4 font-serif text-2xl italic leading-tight text-fog sm:text-3xl">Comparte tu propio link y vende entradas.</p>
                <Link
                  to="/promotores"
                  className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-pumpkin px-7 font-display text-lg uppercase tracking-[0.06em] text-white shadow-[0_0_30px_-6px_rgb(255_106_0/0.9)] transition hover:bg-pumpkin-light active:bg-pumpkin-dark max-sm:w-full"
                >
                  Quiero ser promotor
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
              <ol className="flex flex-col gap-3">
                {STEPS.map(({ icon: Icon, title, text }, i) => (
                  <li key={title} className="flex gap-4 rounded-2xl border border-white/[0.07] bg-ink/50 p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pumpkin/35 bg-pumpkin/10 text-pumpkin-light">
                      <Icon className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <div>
                      <p className="font-display text-lg uppercase leading-tight text-bone">
                        <span className="mr-2 text-pumpkin-light/80">0{i + 1}</span>
                        {title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-fog">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
