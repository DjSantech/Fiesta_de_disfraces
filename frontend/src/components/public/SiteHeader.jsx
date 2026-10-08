import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Menu, Ticket, X } from 'lucide-react';
import { Wordmark } from './ui';
import { roomsAvailable, salesState, usePublicConfig } from './usePublicConfig';

export const HOME_LINKS = [
  { id: 'la-noche', label: 'La noche' },
  { id: 'precios', label: 'Precios' },
  { id: 'habitaciones', label: 'Habitaciones' },
  { id: 'mapa', label: 'Mapa' },
  { id: 'faq', label: 'Preguntas' },
];

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  try {
    window.history.replaceState(window.history.state, '', `#${id}`);
  } catch {
    /* no pasa nada */
  }
}

function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/** CTA del header según el estado de ventas. */
function useHeaderCta() {
  const { config } = usePublicConfig();
  const state = salesState(config);
  if (state === 'preventa' || state === 'general') return { to: '/comprar', label: 'Comprar', long: 'Comprar entrada' };
  if (state === 'soldout' && roomsAvailable(config)) return { to: '/comprar?tipo=habitacion', label: 'Habitaciones', long: 'Ver habitaciones' };
  return null;
}

/**
 * Header fijo minimal.
 * variant="home": anclas + CTA, transparente hasta que haces scroll.
 * variant="page": marca + acción opcional (`right`).
 */
export default function SiteHeader({ variant = 'page', right, hideCta = false }) {
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);
  const cta = useHeaderCta();
  const isHome = variant === 'home';
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    menuRef.current?.querySelector('a,button')?.focus();
    const button = menuButtonRef.current;
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      button?.focus();
    };
  }, [open]);

  const solid = !isHome || scrolled || open;

  return (
    <>
      <header
        className={clsx(
          'fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300',
          solid ? 'border-b border-white/[0.07] bg-ink/75 backdrop-blur-xl' : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="-m-1 rounded-lg p-1" aria-label="Fiesta de Disfraces · inicio">
            <Wordmark size="md" className="text-[17px] sm:text-lg" />
          </Link>

          {isHome && (
            <nav aria-label="Secciones" className="hidden lg:block">
              <ul className="flex items-center gap-1">
                {HOME_LINKS.map((l) => (
                  <li key={l.id}>
                    <a
                      href={`#${l.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToId(l.id);
                      }}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-fog transition hover:bg-white/[0.05] hover:text-bone"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className="flex items-center gap-2">
            {right}
            <Link
              to="/recuperar"
              aria-label="Ver mi entrada"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 text-sm font-semibold text-bone transition hover:border-pumpkin/60 hover:bg-white/[0.08] sm:px-4"
            >
              <Ticket className="h-4 w-4 text-pumpkin-light" strokeWidth={1.75} />
              <span className="hidden sm:inline">Ver mi entrada</span>
            </Link>
            {!hideCta && cta && (
              <Link
                to={cta.to}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-pumpkin px-4 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgb(255_106_0/0.9)] transition hover:bg-pumpkin-light active:bg-pumpkin-dark"
              >
                <span className="sm:hidden">{cta.label}</span>
                <span className="hidden sm:inline">{cta.long}</span>
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            )}
            {isHome && (
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-bone transition hover:bg-white/[0.08] lg:hidden"
                aria-expanded={open}
                aria-controls="menu-movil"
                aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      </header>

      {isHome && open && (
        <div
          id="menu-movil"
          ref={menuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className="fixed inset-0 z-30 flex flex-col bg-ink/95 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-24 backdrop-blur-xl lg:hidden"
        >
          <div className="fd-hero-glow pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <nav aria-label="Secciones" className="relative">
            <ol className="flex flex-col gap-1">
              {HOME_LINKS.map((l, i) => (
                <li key={l.id} className="animate-fade-up" style={{ animationDelay: `${i * 55}ms` }}>
                  <a
                    href={`#${l.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setOpen(false);
                      requestAnimationFrame(() => requestAnimationFrame(() => scrollToId(l.id)));
                    }}
                    className="group flex items-baseline gap-4 rounded-xl py-2.5"
                  >
                    <span className="font-display text-sm text-pumpkin-light/80">0{i + 1}</span>
                    <span className="font-display text-[2.6rem] uppercase leading-none text-bone transition group-hover:text-pumpkin-light">
                      {l.label}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="relative mt-auto flex flex-col gap-3">
            <Link
              to="/recuperar"
              onClick={() => setOpen(false)}
              className="flex h-12 items-center justify-center rounded-xl border border-white/12 text-sm font-semibold text-bone"
            >
              Ver mi entrada
            </Link>
            {cta && (
              <Link
                to={cta.to}
                onClick={() => setOpen(false)}
                className="flex h-14 items-center justify-center gap-2 rounded-xl bg-pumpkin font-display text-lg uppercase tracking-[0.06em] text-white shadow-[0_0_30px_-6px_rgb(255_106_0/0.9)]"
              >
                {cta.long}
                <ArrowRight className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
