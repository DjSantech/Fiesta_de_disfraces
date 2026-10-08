import { useEffect } from 'react';
import { CELEBRATION } from '../../config/event';
import { Embers } from './ui';
import { Cobweb, Pumpkin, Skull } from './decor';

const COLORS = ['#ff6a00', '#ff8a3d', '#ffb340', '#ffb36b', '#f2ede4'];

/** Revelado tipo cine/glitch con brasas (canvas-confetti en rojo/naranja/hueso). */
export default function Celebration({ play }) {
  useEffect(() => {
    if (!play || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let stop = false;
    let raf;
    import('canvas-confetti').then(({ default: confetti }) => {
      if (stop) return;
      const base = { colors: COLORS, shapes: ['circle'], flat: true, disableForReducedMotion: true };
      setTimeout(() => !stop && confetti({ ...base, particleCount: 80, spread: 110, startVelocity: 36, origin: { y: 0.45 }, scalar: 0.7, gravity: 0.5, ticks: 260, decay: 0.92 }), 700);
      const end = Date.now() + 3200;
      const frame = () => {
        if (stop) return;
        confetti({ ...base, particleCount: 2, angle: 90, spread: 60, startVelocity: 14, origin: { x: Math.random(), y: 1.02 }, gravity: -0.18, drift: (Math.random() - 0.5) * 0.6, scalar: 0.55, ticks: 320, decay: 0.95 });
        if (Date.now() < end) raf = requestAnimationFrame(frame);
      };
      frame();
    });
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
    };
  }, [play]);

  const words = CELEBRATION.headline.split(' ');
  const cut = words.indexOf('A');
  const l1 = words.slice(0, cut).join(' ');
  const l2 = words.slice(cut).join(' ');

  return (
    <section aria-live="polite" className="relative overflow-hidden rounded-[32px] border border-pumpkin/30 bg-[#0a0508] px-5 py-10 text-center">
      <div className="fd-hero-glow absolute inset-0" aria-hidden="true" />
      {play && <div className="fd-sweep" aria-hidden="true" />}
      <Embers count={12} />
      <Cobweb corner="tl" className="absolute left-0 top-0 h-24 w-24" opacity={0.3} />
      <Cobweb corner="tr" className="absolute right-0 top-0 h-24 w-24" opacity={0.3} />
      <Pumpkin className="absolute -bottom-2 -left-3 h-16 w-[4.5rem] opacity-90" />
      <Skull className="absolute -bottom-1 -right-1 h-16 w-14 rotate-6 text-bone/30" glow />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-toxic">Pago confirmado</p>
        <h1 className="mt-4 font-display uppercase leading-[0.9] text-bone">
          <span className={play ? 'fd-glitch block animate-fade-up text-[length:clamp(2.3rem,10vw,4.2rem)]' : 'block text-[length:clamp(2.3rem,10vw,4.2rem)]'} data-text={l1}>
            {l1}
          </span>
          <span className="fd-title-pumpkin mt-3 block animate-fade-up leading-[1.05] text-[length:clamp(1.5rem,6.4vw,2.6rem)]" style={{ animationDelay: '450ms' }}>
            {l2}
          </span>
        </h1>
      </div>
    </section>
  );
}
