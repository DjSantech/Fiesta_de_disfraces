import { useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import clsx from 'clsx';
import { Check, Copy } from 'lucide-react';
import { Cobweb, Neon } from './decor';

/** Aparece al entrar en pantalla (una sola vez). */
export function Reveal({ as = 'div', delay = 0, y = 26, className, children, ...props }) {
  const Comp = m[as] || m.div;
  return (
    <Comp
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.85, delay, ease: [0.2, 0.7, 0.2, 1] }}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  );
}

/** Overline: "01 —— LA NOCHE" */
export function Overline({ index, children, className, tone = 'pumpkin' }) {
  return (
    <p
      className={clsx(
        'flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em]',
        tone === 'pumpkin' ? 'text-pumpkin-light' : 'text-fog',
        className,
      )}
    >
      {index && <span className="font-display text-sm tracking-[0.08em] text-bone/45">{index}</span>}
      <span className={clsx('h-px w-8', tone === 'pumpkin' ? 'bg-pumpkin/70' : 'bg-white/25')} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Encabezado de sección: overline + título enorme + acento en serif itálica. */
/** Parpadeo de neon en una letra del titulo (posicion/ritmo/retardo derivan del id). */
function neonTitle(title, id = '') {
  if (typeof title !== 'string') return title;
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const letters = [...title];
  let idx = (seed * 7) % letters.length;
  for (let n = 0; n < letters.length && letters[idx] === ' '; n++) idx = (idx + 1) % letters.length;
  return (
    <>
      {letters.slice(0, idx).join('')}
      <Neon v={['a', 'b', 'c'][seed % 3]} delay={(seed % 5) * 0.9}>{letters[idx]}</Neon>
      {letters.slice(idx + 1).join('')}
    </>
  );
}

export function SectionHeading({ index, overline, title, accent, id, align = 'left', className, titleClassName, children }) {
  return (
    <Reveal className={clsx('relative', align === 'center' && 'flex flex-col items-center text-center', className)}>
      <Cobweb corner="tr" className="absolute -top-7 right-0 h-24 w-24 sm:-top-10 sm:h-36 sm:w-36" opacity={0.28} />
      {overline && <Overline index={index}>{overline}</Overline>}
      <h2
        id={id}
        className={clsx(
          'mt-4 font-display text-[length:clamp(3rem,13.5vw,7.25rem)] uppercase leading-[0.86] tracking-[-0.005em] text-bone',
          titleClassName,
        )}
      >
        {neonTitle(title, id)}
      </h2>
      {accent && <p className="mt-4 max-w-2xl font-serif text-[1.65rem] italic leading-tight text-fog sm:text-4xl">{accent}</p>}
      {children}
    </Reveal>
  );
}

/** Marca: FIESTA DE DISFRACES */
export function Wordmark({ className, size = 'md' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 font-display uppercase leading-none tracking-[0.04em]',
        size === 'sm' && 'text-base',
        size === 'md' && 'text-lg',
        size === 'lg' && 'text-2xl',
        className,
      )}
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inset-0 rounded-full bg-pumpkin shadow-[0_0_10px_2px_rgb(255_106_0/0.8)]" />
      </span>
      <span className="text-bone">Fiesta de</span>
      <span className="-ml-0.5 text-pumpkin-light">Disfraces</span>
    </span>
  );
}

function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* usa el respaldo */
  }
  return copyFallback(text);
}

/** Botón copiar con confirmación visible y anunciada. */
export function CopyButton({ value, label = 'Copiar', copiedLabel = 'Copiado', srLabel, className, compact = false }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function onCopy() {
    const ok = await copyText(String(value));
    if (!ok) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={srLabel || `${label} ${value}`}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition',
        compact ? 'h-9 w-9' : 'h-9 px-3',
        copied ? 'border-toxic/40 bg-toxic/10 text-toxic' : 'border-white/12 bg-white/[0.04] text-bone hover:border-white/25 hover:bg-white/[0.08]',
        className,
      )}
    >
      {copied ? <Check className="h-4 w-4" strokeWidth={2.25} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
      {!compact && <span>{copied ? copiedLabel : label}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ''}
      </span>
    </button>
  );
}

// Generador pseudoaleatorio determinista (las brasas no "saltan" entre renders).
function seeded(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const EMBER_SETS = {};
function emberSet(count) {
  if (!EMBER_SETS[count]) {
    const r = seeded(count * 7 + 3);
    EMBER_SETS[count] = Array.from({ length: count }, () => ({
      left: `${(r() * 100).toFixed(2)}%`,
      size: 2 + r() * 3.5,
      dur: 8 + r() * 10,
      delay: -(r() * 16),
      drift: Math.round((r() - 0.5) * 140),
    }));
  }
  return EMBER_SETS[count];
}

/** Partículas de brasa que suben (CSS puro, se apagan con movimiento reducido). */
export function Embers({ count = 16, className }) {
  return (
    <div className={clsx('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
      {emberSet(count).map((e, i) => (
        <span
          key={i}
          className="fd-ember"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            '--dur': `${e.dur}s`,
            '--delay': `${e.delay}s`,
            '--drift': `${e.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

/** Cinta tipo flyer que corre horizontalmente. Decorativa (repite info de la página). */
export function Marquee({ items, className }) {
  const row = (
    <div className="flex shrink-0 items-center">
      {items.map((t, i) => (
        <span key={i} className="flex items-center">
          <span className="px-6 font-display text-xl uppercase tracking-[0.06em] text-bone/85 sm:text-2xl">{t}</span>
          <span className="h-1.5 w-1.5 rotate-45 bg-pumpkin shadow-[0_0_10px_rgb(255_106_0/0.9)]" />
        </span>
      ))}
    </div>
  );
  return (
    <div className={clsx('relative overflow-hidden border-y border-white/[0.07] bg-night py-4', className)} aria-hidden="true">
      <div className="fd-marquee-track">
        {row}
        {row}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-linear-to-r from-night to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-night to-transparent" />
    </div>
  );
}

const STATE_TONES = {
  pumpkin: 'text-pumpkin-light border-pumpkin/40 bg-pumpkin/10 shadow-[0_0_40px_-10px_rgb(255_106_0/0.9)]',
  toxic: 'text-toxic border-toxic/40 bg-toxic/10 shadow-[0_0_40px_-10px_rgb(34_229_132/0.7)]',
  ultra: 'text-violet-300 border-ultra/40 bg-ultra/10 shadow-[0_0_40px_-10px_rgb(139_92_246/0.9)]',
  gold: 'text-gold border-gold/40 bg-gold/10 shadow-[0_0_40px_-10px_rgb(245_192_74/0.7)]',
  ember: 'text-ember border-ember/40 bg-ember/10 shadow-[0_0_40px_-10px_rgb(255_179_64/0.8)]',
  neutral: 'text-fog border-white/15 bg-white/[0.04]',
};

/** Pantalla de estado centrada (resultados, errores, vacíos). */
export function StateScreen({ icon: Icon, tone = 'pumpkin', overline, title, children, actions, className, iconSlot }) {
  return (
    <div className={clsx('flex flex-col items-center text-center', className)}>
      {iconSlot ||
        (Icon && (
          <span className={clsx('flex h-16 w-16 items-center justify-center rounded-2xl border', STATE_TONES[tone])}>
            <Icon className="h-7 w-7" strokeWidth={1.6} />
          </span>
        ))}
      {overline && <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.3em] text-fog">{overline}</p>}
      {title && (
        <h1 className="mt-3 max-w-xl text-balance font-display text-[length:clamp(2.4rem,10vw,4.5rem)] uppercase leading-[0.9] text-bone">
          {title}
        </h1>
      )}
      {children && <div className="mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-fog">{children}</div>}
      {actions && <div className="mt-8 flex w-full max-w-sm flex-col gap-3">{actions}</div>}
    </div>
  );
}

/** Aviso en línea (error / info / éxito) */
export function Notice({ tone = 'pumpkin', icon: Icon, title, children, action, className }) {
  const tones = {
    pumpkin: 'border-pumpkin/35 bg-pumpkin/[0.08]',
    toxic: 'border-toxic/30 bg-toxic/[0.07]',
    gold: 'border-gold/30 bg-gold/[0.07]',
    ultra: 'border-ultra/35 bg-ultra/[0.08]',
    neutral: 'border-white/10 bg-white/[0.03]',
  };
  const iconTones = { pumpkin: 'text-pumpkin-light', toxic: 'text-toxic', gold: 'text-gold', ultra: 'text-violet-300', neutral: 'text-fog' };
  return (
    <div className={clsx('flex gap-3 rounded-2xl border p-4', tones[tone], className)} role={tone === 'pumpkin' ? 'alert' : 'status'}>
      {Icon && <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', iconTones[tone])} strokeWidth={1.75} />}
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-fog">
        {title && <p className="font-semibold text-bone">{title}</p>}
        {children && <div className={clsx(title && 'mt-0.5')}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
