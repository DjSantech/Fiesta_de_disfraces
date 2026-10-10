import { useState } from 'react';
import clsx from 'clsx';
import { Bath, BedDouble, ChevronLeft, ChevronRight, Gift, Lock, SquareParking, Ticket, Users } from 'lucide-react';
import { ROOMS_COPY, ROOM_PERKS, ROOM_PERKS_KICKER, ROOM_PERKS_TITLE, ROOM_PHOTOS } from '../../config/event';
import { formatCOP, whatsappLink } from '../../lib/format';
import Modal from '../ui/Modal';
import { WhatsAppIcon } from './icons';

export const ROOM_STATUS = {
  available: { label: 'Disponible', short: 'Libre', tone: 'toxic', color: '#22e584' },
  held: { label: 'Apartada · pago en curso', short: 'Apartada', tone: 'gold', color: '#f5c04a' },
  booked: { label: 'Reservada', short: 'Reservada', tone: 'pumpkin', color: '#ff8a3d' },
  blocked: { label: 'No disponible', short: 'No disponible', tone: 'neutral', color: '#6e6b78' },
};

const TONES = {
  toxic: 'border-toxic/35 bg-toxic/10 text-toxic',
  gold: 'border-gold/35 bg-gold/10 text-gold',
  pumpkin: 'border-pumpkin/40 bg-pumpkin/12 text-pumpkin-light',
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
              fill={on ? 'rgb(255 106 0 / 0.28)' : 'transparent'}
              stroke={on ? '#ff8a3d' : 'rgb(242 237 228 / 0.22)'}
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

/** Precios según fase: preventa muestra presalePrice y el normal; general solo el normal. */
export function roomPricing(room, phase) {
  const normal = room.price;
  const presale = room.presalePrice ?? room.price;
  const isPresale = phase !== 'general' && presale !== normal;
  return { normal, presale, isPresale, current: phase === 'general' ? normal : presale };
}

export const roomPeopleText = (room) =>
  room.minPeople && room.minPeople < room.capacity ? `De ${room.minPeople} a ${room.capacity} personas` : `Hasta ${room.capacity} personas`;

export function RoomPriceLine({ room, phase, size = 'lg', className }) {
  const p = roomPricing(room, phase);
  return (
    <div className={className}>
      <p className={clsx('font-display leading-none tabular-nums text-bone', size === 'lg' ? 'text-[2.6rem]' : 'text-2xl')}>{formatCOP(p.current)}</p>
      <p className="mt-1.5 text-xs text-fog">
        {p.isPresale ? (
          <>
            Preventa · después <s className="text-fog/80">{formatCOP(p.normal)}</s>
          </>
        ) : (
          'Precio normal, con la entrada de todo el grupo'
        )}
      </p>
    </div>
  );
}

const PERK_ICONS = { ticket: Ticket, bed: BedDouble, parking: SquareParking, lock: Lock, gift: Gift, bath: Bath };

function PerkCard({ perk, large = false }) {
  const I = PERK_ICONS[perk.icon] || Lock;
  return (
    <li
      className={clsx(
        'relative flex items-start gap-3.5 rounded-2xl border p-4',
        perk.highlight ? 'border-ember/50 bg-ember/[0.09] shadow-[0_0_34px_-14px_rgb(255_179_64/0.7)]' : 'border-white/10 bg-ink/60',
      )}
    >
      <span
        className={clsx(
          'flex shrink-0 items-center justify-center rounded-full ring-1',
          large ? 'h-12 w-12' : 'h-10 w-10',
          perk.highlight ? 'bg-ember/20 text-ember ring-ember/50' : 'bg-pumpkin/15 text-pumpkin-light ring-pumpkin/40',
        )}
      >
        <I className={large ? 'h-6 w-6' : 'h-5 w-5'} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        {perk.badge && (
          <span className="mb-1 inline-block rounded-full bg-ember/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ember">{perk.badge}</span>
        )}
        <p className="font-semibold leading-snug text-bone">{perk.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-fog">{perk.text}</p>
      </div>
    </li>
  );
}

/**
 * Ventajas de reservar habitación.
 * variant="panel": bloque grande y llamativo (Home), muestra también el extra de la habitación grande.
 * variant="compact": lista para el modal "Ver habitación" y la compra; suma el baño solo si la habitación lo tiene.
 */
export function RoomPerks({ room, variant = 'compact', className }) {
  const perks = variant === 'panel' ? [...ROOM_PERKS.all, ...ROOM_PERKS.big] : [...ROOM_PERKS.all, ...(room?.privateBathroom ? ROOM_PERKS.big : [])];
  if (variant === 'panel') {
    return (
      <section
        aria-labelledby="ventajas-hab"
        className={clsx(
          'relative overflow-hidden rounded-3xl border border-pumpkin/40 bg-gradient-to-br from-pumpkin/[0.12] via-crypt/80 to-ink p-5 shadow-[0_0_70px_-24px_rgb(255_106_0/0.75)] sm:p-8',
          className,
        )}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pumpkin/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-ember">{ROOM_PERKS_KICKER}</p>
          <h3 id="ventajas-hab" className="text-glow-ember mt-2 font-display text-[2rem] uppercase leading-none text-bone sm:text-5xl">
            {ROOM_PERKS_TITLE}
          </h3>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {perks.map((p) => (
              <PerkCard key={p.title} perk={p} large />
            ))}
          </ul>
        </div>
      </section>
    );
  }
  return (
    <div className={clsx('rounded-2xl border border-pumpkin/30 bg-pumpkin/[0.05] p-4', className)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ember">{ROOM_PERKS_TITLE}</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {perks.map((p) => (
          <PerkCard key={p.title} perk={p} />
        ))}
      </ul>
    </div>
  );
}

/** Nota para pedir más personas o ajustar el precio, con botón de WhatsApp. */
export function RoomHelpNote({ contact = {}, room, className }) {
  const text = room ? ROOMS_COPY.whatsappTextFor(room.name || `Habitación ${room.number}`) : ROOMS_COPY.whatsappText;
  return (
    <div className={clsx('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-sm leading-relaxed text-bone/90">{ROOMS_COPY.help}.</p>
      <a
        href={whatsappLink(contact.whatsapp, text)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-toxic/12 px-4 text-sm font-semibold text-toxic ring-1 ring-toxic/35 transition hover:bg-toxic/20"
      >
        <WhatsAppIcon className="h-5 w-5" />
        Escribirle a {contact.adminName || 'DJ Santech'}
      </a>
    </div>
  );
}

/** Miniatura de la primera foto de la habitación. */
export function RoomThumb({ number, className }) {
  const photo = ROOM_PHOTOS[number]?.[0];
  if (!photo) return null;
  return <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" className={clsx('object-cover', className)} />;
}

/** Galería accesible: flechas, miniaturas y teclado. */
function Gallery({ photos }) {
  const [i, setI] = useState(0);
  if (!photos?.length) return null;
  const go = (d) => setI((n) => (n + d + photos.length) % photos.length);
  const cur = photos[i];
  return (
    <div
      role="group"
      aria-roledescription="galería"
      aria-label="Fotos de la habitación"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
        <img src={cur.src} alt={cur.alt} className="aspect-[4/3] w-full object-cover" />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Foto siguiente" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2.5 py-1 text-xs text-white" aria-live="polite">
          {i + 1} / {photos.length}
        </span>
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex gap-2">
          {photos.map((p, n) => (
            <button
              key={p.src}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Ver foto ${n + 1}: ${p.alt}`}
              aria-current={n === i}
              className={clsx('h-16 w-20 overflow-hidden rounded-xl border-2 transition', n === i ? 'border-pumpkin' : 'border-white/10 opacity-70 hover:opacity-100')}
            >
              <img src={p.src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RoomViewModal({ room, phase, contact, open, onClose, buyTo }) {
  if (!room) return null;
  return (
    <Modal open={open} onClose={onClose} title={room.name || `Habitación ${room.number}`} description={room.beds} size="lg">
      <Gallery key={room.number} photos={ROOM_PHOTOS[room.number]} />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-fog">
          <Users className="h-4 w-4 text-pumpkin-light" strokeWidth={1.75} />
          <span className="font-semibold text-bone">{roomPeopleText(room)}</span>
        </p>
        <RoomPriceLine room={room} phase={phase} size="sm" />
      </div>
      <RoomPerks room={room} className="mt-5" />
      <RoomHelpNote contact={contact} room={room} className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4" />
      {buyTo && (
        <a href={buyTo} className="mt-4 flex h-13 w-full items-center justify-center rounded-2xl bg-pumpkin font-semibold text-white transition hover:bg-pumpkin-light">
          Reservar {room.name}
        </a>
      )}
    </Modal>
  );
}
