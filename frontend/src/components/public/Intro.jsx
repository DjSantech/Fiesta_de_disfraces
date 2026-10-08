import { useEffect, useRef } from 'react';
import { m } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { INTRO } from '../../config/event';
import { Embers } from './ui';
import { Cobweb, Pumpkin } from './decor';
import { KEYS, session } from './utils/storage';

const EASE = [0.16, 1, 0.3, 1];
const AUTO_EXIT_MS = 6400;

/** ¿Mostrar la intro? Una vez por sesión; se omite con ?intro=0 o si llegan a un #ancla. ?intro=1 la fuerza. */
export function shouldShowIntro() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('intro') === '1') return true;
    if (params.get('intro') === '0') return false;
    if (window.location.hash) return false;
  } catch {
    /* sigue */
  }
  return session.get(KEYS.introSeen) !== '1';
}

export function markIntroSeen() {
  session.set(KEYS.introSeen, '1');
}

/**
 * Intro cinematográfica a pantalla completa (~5 s): negro, grano, neón rojo dañado,
 * "DJ SANTECH PRESENTA", revelado del título, fecha y tagline. Botones Entrar / Saltar.
 */
export default function Intro({ onDone }) {
  const doneRef = useRef(false);
  const skipRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current?.();
  };

  useEffect(() => {
    markIntroSeen();
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    skipRef.current?.focus({ preventScroll: true });
    const timer = setTimeout(finish, AUTO_EXIT_MS);
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      root.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-label="Presentación de la Fiesta de Disfraces"
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[#030304]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1, ease: [0.4, 0, 0.2, 1] } }}
    >
      {/* Luz roja ambiental (aparece suave, sin destellos) */}
      <m.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 2.4, ease: 'easeOut' }}
        style={{
          background:
            'radial-gradient(55% 40% at 50% 46%, rgb(255 106 0 / 0.28), transparent 72%), radial-gradient(80% 60% at 50% 120%, rgb(139 92 246 / 0.14), transparent 70%)',
        }}
      />
      <Cobweb corner="tl" className="absolute left-0 top-0 h-40 w-40" opacity={0.22} />
      <Cobweb corner="tr" className="absolute right-0 top-0 h-40 w-40" opacity={0.22} />
      <Pumpkin className="absolute bottom-4 left-4 h-20 w-24 opacity-70" />
      <Embers count={10} className="opacity-70" />
      <div className="vignette pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 flex items-center justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <m.button
          ref={skipRef}
          type="button"
          onClick={finish}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-fog transition hover:border-white/30 hover:text-bone"
        >
          Saltar
        </m.button>
      </div>

      <m.div
        className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 text-center"
        exit={{ scale: 1.08, filter: 'blur(10px)', transition: { duration: 1, ease: [0.4, 0, 0.2, 1] } }}
      >
        {/* Tubo de neón que intenta prender */}
        <div className="fd-neon-tube relative mb-8 h-[2px] w-[min(68vw,420px)] rounded-full bg-[#ff3346] shadow-[0_0_12px_2px_rgb(255_106_0/0.85),0_0_44px_8px_rgb(255_106_0/0.45)]" aria-hidden="true" />

        <m.p
          className="text-[11px] font-semibold uppercase text-bone/80 sm:text-xs"
          initial={{ opacity: 0, letterSpacing: '0.9em' }}
          animate={{ opacity: 1, letterSpacing: '0.38em' }}
          transition={{ delay: 0.7, duration: 1.6, ease: EASE }}
        >
          {INTRO.presenter}
        </m.p>

        <h1 className="mt-5 font-display uppercase leading-[0.84]">
          {INTRO.titleLines.map((line, i) => (
            <span key={line} className="block overflow-hidden px-2 pb-[0.04em]">
              <m.span
                className="block"
                initial={{ y: '105%', opacity: 0, filter: 'blur(8px)' }}
                animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                transition={{ delay: 1.2 + i * 0.2, duration: 1.15, ease: EASE }}
              >
                <span
                  className={
                    i === 0
                      ? 'fd-title-bone block text-[length:clamp(3.9rem,19vw,10.5rem)]'
                      : 'fd-title-pumpkin fd-neon-glow-text block text-[length:clamp(3.9rem,19vw,10.5rem)]'
                  }
                >
                  {line}
                </span>
              </m.span>
            </span>
          ))}
        </h1>

        <m.div
          className="mt-7 flex items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.4, duration: 0.8 }}
        >
          <m.span
            className="h-px w-10 origin-right bg-pumpkin/80 sm:w-16"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 2.5, duration: 0.9, ease: EASE }}
            aria-hidden="true"
          />
          <p className="font-display text-2xl uppercase tracking-[0.14em] text-bone sm:text-3xl">
            {INTRO.date} <span className="text-pumpkin-light">·</span> {INTRO.place}
          </p>
          <m.span
            className="h-px w-10 origin-left bg-pumpkin/80 sm:w-16"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 2.5, duration: 0.9, ease: EASE }}
            aria-hidden="true"
          />
        </m.div>

        <m.p
          className="mt-4 font-serif text-[1.65rem] italic leading-tight text-fog sm:text-4xl"
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 3.05, duration: 1.1, ease: EASE }}
        >
          {INTRO.tagline}
        </m.p>

        <m.div
          className="mt-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.6, duration: 0.8, ease: EASE }}
        >
          <button
            type="button"
            onClick={finish}
            className="fd-shine group inline-flex h-14 items-center gap-3 rounded-full border border-pumpkin/60 bg-pumpkin/15 px-9 font-display text-lg uppercase tracking-[0.2em] text-bone shadow-[0_0_40px_-8px_rgb(255_106_0/0.9)] transition hover:bg-pumpkin/30"
          >
            Entrar
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          </button>
        </m.div>
      </m.div>

      {/* Barra de progreso sutil hasta la salida automática */}
      <m.div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-linear-to-r from-pumpkin-dark via-pumpkin to-ember"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: AUTO_EXIT_MS / 1000, ease: 'linear' }}
      />
    </m.div>
  );
}
