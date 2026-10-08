import clsx from 'clsx';

export const ROOM_STATUS = {
  available: { label: 'Disponible', short: 'Libre', tone: 'toxic', color: '#22e584' },
  held: { label: 'Apartada · pago en curso', short: 'Apartada', tone: 'gold', color: '#f5c04a' },
  booked: { label: 'Reservada', short: 'Reservada', tone: 'blood', color: '#ff4d5e' },
  blocked: { label: 'No disponible', short: 'No disponible', tone: 'neutral', color: '#6e6b78' },
};

const TONES = {
  toxic: 'border-toxic/35 bg-toxic/10 text-toxic',
  gold: 'border-gold/35 bg-gold/10 text-gold',
  blood: 'border-blood/40 bg-blood/12 text-blood-light',
  neutral: 'border-white/12 bg-white/[0.05] text-fog',
};

/** Estado en vivo de una habitación. `known=false` mientras no ha respondido la API. */
export function RoomStatusBadge({ status, known = true, short = false, className }) {
  if (!known) {
    return (
      <span className={clsx('inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-fog', className)}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fog" aria-hidden="true" />
        Consultando…
      </span>
    );
  }
  const s = ROOM_STATUS[status] || ROOM_STATUS.blocked;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', TONES[s.tone], className)}>
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {status === 'available' && <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />}
        <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {short ? s.short : s.label}
    </span>
  );
}

/** Mini plano de la fila de cuartos [X][1][2][X][3] con una habitación resaltada. */
export function RoomRowMini({ highlight, className }) {
  const cells = [
    { key: 'x1', w: 18, label: '×' },
    { key: 1, w: 22, label: '1' },
    { key: 2, w: 22, label: '2' },
    { key: 'x2', w: 18, label: '×' },
    { key: 3, w: 34, label: '3' },
  ];
  let x = 1;
  return (
    <svg viewBox="0 0 118 26" className={clsx('h-6 w-auto', className)} aria-hidden="true">
      {cells.map((c) => {
        const cx = x;
        x += c.w;
        const on = c.key === highlight;
        const isX = typeof c.key === 'string';
        return (
          <g key={c.key}>
            <rect
              x={cx}
              y={1}
              width={c.w}
              height={24}
              rx={2}
              fill={on ? 'rgb(225 29 46 / 0.28)' : 'transparent'}
              stroke={on ? '#ff4d5e' : 'rgb(242 237 228 / 0.22)'}
              strokeWidth={on ? 1.4 : 1}
            />
            <text
              x={cx + c.w / 2}
              y={17.5}
              textAnchor="middle"
              fontSize={isX ? 11 : 11}
              fontFamily="Anton, Impact, sans-serif"
              fill={on ? '#fff' : isX ? 'rgb(242 237 228 / 0.25)' : 'rgb(242 237 228 / 0.55)'}
            >
              {c.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
