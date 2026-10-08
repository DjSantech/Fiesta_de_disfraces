import clsx from 'clsx';

/* Decoración de Halloween (solo web pública). Todo es SVG inline, aria-hidden,
   sin filtros pesados: el brillo sale de drop-shadow CSS y opacity/transform. */

const ORANGE = '#ff6a00';
const ORANGE_LIGHT = '#ff8a3d';

const CORNER = {
  tl: '',
  tr: '-scale-x-100',
  bl: '-scale-y-100',
  br: '-scale-100',
};

const RAYS = [0, 15, 30, 45, 60, 75, 90].map((deg) => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r) * 100, Math.sin(r) * 100];
});
const RADII = [0.22, 0.4, 0.6, 0.82];

/** Telaraña de esquina (origen arriba-izquierda; `corner` la voltea). */
export function Cobweb({ corner = 'tl', className, opacity = 0.5 }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={clsx('pointer-events-none select-none', CORNER[corner], className)}
      style={{ opacity }}
      fill="none"
      stroke="#f2ede4"
      strokeLinecap="round"
    >
      {RAYS.map(([x, y], i) => (
        <line key={i} x1="0" y1="0" x2={x} y2={y} strokeWidth="0.6" />
      ))}
      {RADII.map((k, ri) =>
        RAYS.slice(0, -1).map(([x, y], i) => {
          const [nx, ny] = RAYS[i + 1];
          const ax = x * k;
          const ay = y * k;
          const bx = nx * k;
          const by = ny * k;
          const cx = ((ax + bx) / 2) * 0.82;
          const cy = ((ay + by) / 2) * 0.82;
          return <path key={`${ri}-${i}`} d={`M${ax} ${ay}Q${cx} ${cy} ${bx} ${by}`} strokeWidth="0.45" />;
        }),
      )}
    </svg>
  );
}

/** Calavera en trazo fino con detalle. */
export function Skull({ className, glow = false }) {
  return (
    <svg
      viewBox="0 0 64 72"
      aria-hidden="true"
      focusable="false"
      className={clsx('pointer-events-none select-none', glow && 'drop-shadow-[0_0_8px_rgb(255_106_0/0.55)]', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M32 4C16 4 7 15 7 28c0 8 3 13 8 17v9c0 2 1 4 3 4h4v6h20v-6h4c2 0 3-2 3-4v-9c5-4 8-9 8-17C57 15 48 4 32 4Z" />
      <path d="M13 26c0-6 5-10 10-10s9 4 9 10-5 10-10 10-9-4-9-10Z" fill="rgb(7 7 10 / 0.7)" />
      <path d="M32 26c0-6 4-10 9-10s10 4 10 10-4 10-9 10-10-4-10-10Z" fill="rgb(7 7 10 / 0.7)" />
      <circle cx="21" cy="27" r="1.6" fill={ORANGE} stroke="none" />
      <circle cx="42" cy="27" r="1.6" fill={ORANGE} stroke="none" />
      <path d="M32 38l-3.5 6h7L32 38Z" fill="rgb(7 7 10 / 0.7)" />
      <path d="M22 54v10M27 56v10M32 56v10M37 56v10M42 54v10" strokeWidth="1.2" />
      <path d="M22 58h20" strokeWidth="1.2" />
      <path d="M36 6l-3 9 5 5-3 6M12 16l5 3" strokeWidth="0.9" opacity="0.6" />
    </svg>
  );
}

/** Jack-o-lantern amenazante: silueta oscura, cara iluminada en naranja. */
export function Pumpkin({ className, lit = true }) {
  return (
    <svg
      viewBox="0 0 120 108"
      aria-hidden="true"
      focusable="false"
      className={clsx('pointer-events-none select-none', lit && 'drop-shadow-[0_0_14px_rgb(255_106_0/0.45)]', className)}
    >
      <path d="M56 22c-2-9 2-15 9-18-1 5 0 9 4 12-4 1-9 3-13 6Z" fill="#0c0a06" stroke="#3a2a10" strokeWidth="1.2" />
      <path
        d="M60 20c-14-6-30-3-42 8C5 40 2 60 12 78c9 15 28 24 48 24s39-9 48-24c10-18 7-38-6-50-12-11-28-14-42-8Z"
        fill="#150a04"
        stroke="#ff6a00"
        strokeOpacity="0.45"
        strokeWidth="1.4"
      />
      <path d="M60 20c-9 14-9 62 0 82M38 24c-12 18-12 54 0 74M82 24c12 18 12 54 0 74" fill="none" stroke="#ff6a00" strokeOpacity="0.16" strokeWidth="1.2" />
      <g className={clsx(lit && 'fd-pumpkin-face')} fill={ORANGE_LIGHT}>
        <path d="M24 46l22 6-4 14-14-6Z" />
        <path d="M96 46l-22 6 4 14 14-6Z" />
        <path d="M60 62l-6 11h12Z" />
        <path d="M26 78c8 10 20 15 34 15s26-5 34-15l-8 1-5 7-6-6-7 8-5-8-5 8-7-8-6 6-5-7Z" />
      </g>
    </svg>
  );
}

/** Murciélago en silueta. */
export function Bat({ className }) {
  return (
    <svg viewBox="0 0 64 28" aria-hidden="true" focusable="false" className={clsx('pointer-events-none select-none', className)} fill="currentColor">
      <path d="M32 9c2 0 3 1 4 3 3-2 7-8 14-9 6-1 11 2 14 6-4-1-7 1-8 4-3-2-6-1-8 2-3-2-6-1-8 3-2-2-4-2-6 2-2-4-4-4-6-2-2-4-5-5-8-3-2-3-5-4-8-2-1-3-4-5-8-4 3-4 8-7 14-6 7 1 11 7 14 9 1-2 2-3 4-3Z" />
      <path d="M29 10l1-5 2 3 2-3 1 5Z" />
    </svg>
  );
}

/** Candelabro de tres brazos con llamas. */
export function Candelabra({ className }) {
  return (
    <svg viewBox="0 0 80 100" aria-hidden="true" focusable="false" className={clsx('pointer-events-none select-none', className)} fill="none" stroke="#a3a0ad" strokeWidth="1.6" strokeLinecap="round">
      <path d="M40 94V50M26 94h28M32 88h16M40 50c-14 0-22-6-22-20M40 50c14 0 22-6 22-20M40 50V30" />
      <path d="M13 30h10M35 30h10M57 30h10" strokeWidth="2.4" />
      {[18, 40, 62].map((x) => (
        <g key={x}>
          <path d={`M${x} 29v-12`} stroke="#d9d2c5" strokeWidth="4" />
          <path className="fd-flame" d={`M${x} 14c-4-4-3-8 0-12 3 4 4 8 0 12Z`} fill={ORANGE_LIGHT} stroke="none" />
        </g>
      ))}
    </svg>
  );
}

/** Línea - calavera/calabaza - línea. Para separar bloques. */
export function SkullDivider({ className, icon = 'skull' }) {
  return (
    <div aria-hidden="true" className={clsx('flex items-center justify-center gap-4', className)}>
      <span className="h-px max-w-40 flex-1 bg-linear-to-r from-transparent to-pumpkin/45" />
      {icon === 'pumpkin' ? <Pumpkin className="h-9 w-10" /> : <Skull className="h-9 w-8 text-bone/55" glow />}
      <span className="h-px max-w-40 flex-1 bg-linear-to-l from-transparent to-pumpkin/45" />
    </div>
  );
}

/** Separador entre secciones de la home: murciélagos + calavera/calabaza. */
export function SectionBreak({ variant = 'skull', className }) {
  return (
    <div aria-hidden="true" className={clsx('relative overflow-hidden bg-night py-7 sm:py-9', className)}>
      <Bat className="fd-bat absolute left-[12%] top-2 h-4 w-9 text-bone/15" />
      <Bat className="fd-bat fd-bat--b absolute right-[16%] top-5 h-3 w-7 text-bone/10" />
      <SkullDivider icon={variant} className="px-6" />
    </div>
  );
}

/** Letra/palabra con parpadeo de neón dañado (variantes a/b/c: ritmos distintos). */
export function Neon({ children, v = 'a', delay = 0, className }) {
  return (
    <span className={clsx('fd-neon', `fd-neon--${v}`, className)} style={delay ? { animationDelay: `${delay}s` } : undefined}>
      {children}
    </span>
  );
}
