import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowRight,
  Bath,
  BedDouble,
  Car,
  Disc3,
  Droplets,
  Gamepad2,
  HardHat,
  House,
  Martini,
  Motorbike,
  MousePointerClick,
  MoveHorizontal,
  Sofa,
  SquareParking,
  Users,
  Utensils,
  Waves,
} from 'lucide-react';
import { MAP_ZONES } from '../../config/event';
import { formatCOP } from '../../lib/format';
import { ROOM_STATUS, RoomHelpNote, RoomPriceLine, RoomStatusBadge, RoomThumb, RoomViewModal, roomHasPhotos, roomPeopleText } from './rooms';

// Plano nocturno de la finca, fiel al boceto del organizador (docs/mapa-finca-v4.png), en horizontal:
// arriba [Barra | DJ] [Salón de juegos | Jacuzzi] y la Piscina; abajo el Parqueadero, la Casa
// (1 · 2 · baño · 3 / sala / comedor · baño · 4) y la zona verde. En celular el plano va en un contenedor
// con scroll horizontal propio (los rótulos están en unidades grandes para que se lean a ese ancho).

const VIEWBOX = '-8 -10 1428 494';
const HOUSE_CX = 668;
const VB_X = -8;
const VB_W = 1428;

const BONE = '#f2ede4';
const RED = '#ff8a3d';

/** Zonas tocables. `id` es la clave en MAP_ZONES; `room` enlaza con config.rooms[].number. */
const ZONES = [
  { id: 'barraCocteles', shape: { t: 'rect', x: 25, y: 8, w: 160, h: 132, rx: 12 } },
  { id: 'dj', shape: { t: 'rect', x: 185, y: 8, w: 193, h: 132, rx: 12 } },
  { id: 'salonJuegos', shape: { t: 'rect', x: 406, y: 4, w: 231, h: 134, rx: 12 } },
  { id: 'jacuzzi', shape: { t: 'rect', x: 637, y: 4, w: 281, h: 134, rx: 12 }, water: true },
  { id: 'piscina', shape: { t: 'circle', cx: 1120, cy: 75, r: 82 }, water: true },
  { id: 'parqueadero', shape: { t: 'rect', x: 18, y: 172, w: 375, h: 294, rx: 10 } },
  { id: 'casa', shape: { t: 'rect', x: 421, y: 156, w: 494, h: 308, rx: 12 } },
  // Fila superior de la casa
  { id: 'room1', room: 1, shape: { t: 'rect', x: 430, y: 163, w: 127, h: 119, rx: 8 } },
  { id: 'room2', room: 2, shape: { t: 'rect', x: 563, y: 165, w: 117, h: 115, rx: 8 } },
  { id: 'bano', shape: { t: 'rect', x: 683, y: 173, w: 62, h: 99, rx: 8 } },
  { id: 'room3', room: 3, shape: { t: 'rect', x: 754, y: 175, w: 156, h: 100, rx: 8 } },
  // Sala al centro
  { id: 'sala', shape: { t: 'rect', x: 565, y: 288, w: 340, h: 54, rx: 8 }, dashed: true },
  // Fila inferior de la casa
  { id: 'comedorCocina', shape: { t: 'rect', x: 430, y: 350, w: 196, h: 106, rx: 8 } },
  { id: 'room4', room: 4, labelCx: 817, shape: { t: 'rect', x: 640, y: 350, w: 266, h: 106, rx: 8 } },
  { id: 'bano2', shape: { t: 'rect', x: 648, y: 360, w: 70, h: 86, rx: 8 } },
];

const ZONE_ICONS = {
  barraCocteles: Martini,
  dj: Disc3,
  salonJuegos: Gamepad2,
  jacuzzi: Droplets,
  piscina: Waves,
  parqueadero: SquareParking,
  casa: House,
  room1: BedDouble,
  room2: BedDouble,
  room3: BedDouble,
  room4: BedDouble,
  bano: Bath,
  bano2: Bath,
  sala: Sofa,
  comedorCocina: Utensils,
};

const SANS = 'Inter, sans-serif';
const DISPLAY = 'Anton, Impact, sans-serif';
const SERIF = "'Cormorant Garamond', Georgia, serif";

function Shape({ shape, ...props }) {
  if (shape.t === 'circle') return <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...props} />;
  return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx || 0} {...props} />;
}

function center(shape) {
  if (shape.t === 'circle') return { x: shape.cx, y: shape.cy };
  return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
}

function roomAriaLabel(name, room, known) {
  if (!room) return name;
  const status = known ? (ROOM_STATUS[room.status] || ROOM_STATUS.blocked).label : 'consultando disponibilidad';
  if (room.reserved) return `${name}: ${status}`;
  return `${name}: ${room.beds ? `${room.beds}, ` : ''}${roomPeopleText(room).toLowerCase()}, ${formatCOP(room.currentPrice ?? room.price)}, ${status}`;
}

function statusColor(room, known) {
  if (!room || !known) return 'rgb(242 237 228 / 0.35)';
  return (ROOM_STATUS[room.status] || ROOM_STATUS.blocked).color;
}

/** Rótulo dentro del plano de cada zona (el texto es decorativo: el botón ya tiene aria-label). */
function ZoneLabel({ z, sel, room, known, ink, soft }) {
  const c = center(z.shape);
  switch (z.id) {
    case 'barraCocteles':
      return (
        <g pointerEvents="none" textAnchor="middle" fontFamily={SANS} fontWeight="700" fontSize="18" letterSpacing="0.8" fill={ink}>
          <text x={c.x} y={c.y - 4} className="fd-zone-label">BARRA DE</text>
          <text x={c.x} y={c.y + 20} className="fd-zone-label">CÓCTELES</text>
        </g>
      );
    case 'dj':
      return (
        <g pointerEvents="none">
          <text x={254} y={100} textAnchor="middle" className="fd-zone-label" fontSize="66" fontFamily={DISPLAY} letterSpacing="3" fill={ink}>
            DJ
          </text>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={306 + i * 11}
              y={52}
              width={6}
              height={48}
              rx={1.6}
              fill={i % 3 === 0 ? RED : i % 3 === 1 ? '#ffb340' : '#8b5cf6'}
              fillOpacity="0.8"
              className="fd-eq-bar"
              style={{ animationDelay: `${(i * 137) % 900}ms`, animationDuration: `${700 + ((i * 211) % 500)}ms` }}
            />
          ))}
        </g>
      );
    case 'salonJuegos':
      return (
        <g pointerEvents="none" textAnchor="middle" fontFamily={SANS} fontWeight="700" fontSize="22" letterSpacing="1" fill={ink}>
          <text x={c.x} y={c.y - 4} className="fd-zone-label">SALÓN DE</text>
          <text x={c.x} y={c.y + 24} className="fd-zone-label">JUEGOS</text>
        </g>
      );
    case 'jacuzzi':
      return (
        <g pointerEvents="none">
          <circle cx={697} cy={70} r={25} fill="none" stroke="rgb(167 139 250 / 0.85)" strokeWidth="1.6" />
          <circle cx={697} cy={70} r={25} fill="none" stroke="rgb(167 139 250 / 0.6)" className="fd-ripple" />
          <text x={745} y={79} className="fd-zone-label" fontSize="24" fontFamily={SANS} fontWeight="700" letterSpacing="1.5" fill={ink}>
            JACUZZI
          </text>
        </g>
      );
    case 'piscina':
      return (
        <g pointerEvents="none">
          <circle cx={1120} cy={75} r={64} fill="none" stroke="rgb(167 139 250 / 0.5)" className="fd-ripple" />
          <circle cx={1120} cy={75} r={64} fill="none" stroke="rgb(167 139 250 / 0.5)" className="fd-ripple" style={{ animationDelay: '-2.7s' }} />
          <text x={1120} y={86} textAnchor="middle" className="fd-zone-label" fontSize="31" fontFamily={DISPLAY} letterSpacing="3" fill={ink}>
            PISCINA
          </text>
        </g>
      );
    case 'parqueadero':
      return (
        <g pointerEvents="none">
          {Array.from({ length: 8 }, (_, i) => {
            const x = 18 + (375 / 9) * (i + 1);
            return <path key={i} d={`M${x} 172 v26 M${x} 466 v-26`} stroke="rgb(242 237 228 / 0.2)" strokeWidth="1.2" />;
          })}
          <text x={c.x} y={c.y + 10} textAnchor="middle" className="fd-zone-label" fontSize="30" fontFamily={SANS} fontWeight="700" letterSpacing="3" fill={ink}>
            PARQUEADERO
          </text>
        </g>
      );
    case 'casa':
      return (
        <text x={493} y={322} textAnchor="middle" className="fd-zone-label" fontSize="19" fontFamily={SANS} fontWeight="700" letterSpacing="2.5" fill={sel ? '#fff' : soft} pointerEvents="none">
          LA CASA
        </text>
      );
    case 'bano':
    case 'bano2':
      return (
        <text x={c.x} y={c.y + 6} textAnchor="middle" className="fd-zone-label" fontSize="17" fontFamily={SANS} fontWeight="700" letterSpacing="0.6" fill={soft} pointerEvents="none">
          BAÑO
        </text>
      );
    case 'sala':
      return (
        <text x={c.x} y={c.y + 11} textAnchor="middle" className="fd-zone-label" fontSize="32" fontFamily={DISPLAY} letterSpacing="6" fill={ink} pointerEvents="none">
          SALA
        </text>
      );
    case 'comedorCocina':
      return (
        <g pointerEvents="none" textAnchor="middle" fontFamily={SANS} fontWeight="700" fontSize="20" letterSpacing="1" fill={ink}>
          <text x={c.x} y={c.y - 3} className="fd-zone-label">COMEDOR</text>
          <text x={c.x} y={c.y + 22} className="fd-zone-label">Y COCINA</text>
        </g>
      );
    default:
      break;
  }
  if (z.room) {
    const { x, y, w, h } = z.shape;
    const st = known ? room?.status : null;
    const statusText = st === 'booked' ? 'OCUPADA' : st === 'held' ? 'APARTADA' : st === 'available' ? 'LIBRE' : null;
    const col = statusColor(room, known);
    const cx = z.labelCx ?? x + w / 2;
    return (
      <g pointerEvents="none" textAnchor="middle">
        <text x={cx} y={y + 27} className="fd-zone-label" fontSize="16" fontFamily={SANS} fontWeight="700" letterSpacing="2" fill={soft}>
          HAB.
        </text>
        <text x={cx} y={y + h * 0.6 + 6} className="fd-zone-label" fontSize="42" fontFamily={DISPLAY} fill={ink}>
          {z.room}
        </text>
        {statusText && (
          <text x={cx} y={y + h - 12} fontSize="16" fontFamily={SANS} fontWeight="800" letterSpacing="1.6" fill={col}>
            {statusText}
          </text>
        )}
        {known && room?.status === 'available' && <circle cx={x + w - 14} cy={y + 14} r={5} fill={col} className="fd-pulse-dot" />}
        <circle cx={x + w - 14} cy={y + 14} r={5} fill={col} />
      </g>
    );
  }
  return null;
}

export default function FincaMap({ config, known = true, className }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [selected, setSelected] = useState(null);
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const roomsByNumber = useMemo(() => Object.fromEntries((config.rooms || []).map((r) => [r.number, r])), [config.rooms]);

  const select = (id) => setSelected((cur) => (cur === id ? cur : id));

  // En celular el plano es más ancho que la pantalla: arranca desplazado para que se vea la casa.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = ((HOUSE_CX - VB_X) / VB_W) * el.scrollWidth - el.clientWidth / 2;
  }, []);

  // En celular, si el panel quedó fuera de pantalla, lo acerca suavemente.
  useEffect(() => {
    if (!selected) return;
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight - 120) {
      el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    }
  }, [selected]);

  const zone = ZONES.find((z) => z.id === selected) || null;

  return (
    <div className={clsx('grid gap-5', className)}>
      <div className="fd-blueprint noise-border relative w-full overflow-hidden rounded-[28px]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgb(255_106_0/0.12),transparent_70%)]" aria-hidden="true" />
        <p className="relative flex items-center justify-center gap-2 px-4 pt-3 text-xs font-semibold text-fog lg:hidden" aria-hidden="true">
          Desliza para ver todo el mapa
          <MoveHorizontal className="h-4 w-4 text-pumpkin-light" />
        </p>
        <div ref={scrollRef} className="relative overflow-x-auto overscroll-x-contain p-2 [scroll-snap-type:x_proximity] sm:p-4" tabIndex={-1}>
          <div className="relative min-w-[880px] lg:min-w-0">
            {/* Puntos de anclaje del scroll: inicio, casa y final */}
            <span className="pointer-events-none absolute left-0 top-0 h-full w-px snap-center" aria-hidden="true" />
            <span className="pointer-events-none absolute top-0 h-full w-px snap-center" style={{ left: `${((HOUSE_CX - VB_X) / VB_W) * 100}%` }} aria-hidden="true" />
            <span className="pointer-events-none absolute right-0 top-0 h-full w-px snap-center" aria-hidden="true" />
            <svg
              viewBox={VIEWBOX}
              className="relative block h-auto w-full select-none"
              role="group"
              aria-label="Mapa de la finca. Toca o selecciona una zona para ver su información."
            >
              <defs>
                <pattern id={`hatch-${uid}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="rgb(255 77 94 / 0.22)" strokeWidth="3" />
                </pattern>
                <radialGradient id={`water-${uid}`} cx="50%" cy="45%" r="60%">
                  <stop offset="0%" stopColor="rgb(139 92 246 / 0.30)" />
                  <stop offset="70%" stopColor="rgb(139 92 246 / 0.10)" />
                  <stop offset="100%" stopColor="rgb(139 92 246 / 0.04)" />
                </radialGradient>
                <radialGradient id={`lawn-${uid}`} cx="50%" cy="50%" r="65%">
                  <stop offset="0%" stopColor="rgb(34 229 132 / 0.14)" />
                  <stop offset="100%" stopColor="rgb(34 229 132 / 0.03)" />
                </radialGradient>
              </defs>

              {/* Lindero de la finca */}
              <rect x="-2" y="-4" width="1418" height="484" rx="22" fill="none" stroke="rgb(242 237 228 / 0.16)" strokeWidth="1.5" strokeDasharray="7 7" aria-hidden="true" />

              {/* Anotaciones del paisaje (no son botones) */}
              <g aria-hidden="true">
                {/* Zona verde: sin caja, solo el texto con un césped suave detrás */}
                <ellipse cx="1250" cy="322" rx="140" ry="62" fill={`url(#lawn-${uid})`} stroke="rgb(34 229 132 / 0.3)" strokeWidth="1.2" strokeDasharray="4 6" />
                <text x="1250" y="334" textAnchor="middle" fontSize="38" fontWeight="600" fontFamily={SERIF} fontStyle="italic" letterSpacing="0.6" fill="rgb(120 240 175 / 0.95)">
                  {MAP_ZONES.zonaVerde.name.toLowerCase()}
                </text>
                {[
                  [1128, 292, 9],
                  [1372, 296, 8],
                  [1356, 360, 10],
                ].map(([x, y, r]) => (
                  <g key={`${x}-${y}`} fill="none" stroke="rgb(34 229 132 / 0.4)" strokeWidth="1.3">
                    <circle cx={x} cy={y} r={r} />
                    <path d={`M${x - r * 0.45} ${y} H${x + r * 0.45} M${x} ${y - r * 0.45} V${y + r * 0.45}`} strokeOpacity="0.6" />
                  </g>
                ))}
                {/* Vista a toda Pereira, inclinado como en el boceto */}
                <g transform="translate(1312 30) rotate(8)">
                  <text textAnchor="middle" fontSize="21" fontWeight="600" fontFamily={SERIF} fontStyle="italic" letterSpacing="0.3" fill="rgb(255 179 64 / 0.95)">
                    {MAP_ZONES.vista.name.toLowerCase()}
                  </text>
                  <path d="M-90 12 Q0 20 90 12" fill="none" stroke="rgb(255 179 64 / 0.4)" strokeWidth="1.4" strokeDasharray="3 6" />
                </g>
              </g>

              {/* Zonas interactivas (la casa va primero: las habitaciones quedan encima) */}
              {ZONES.map((z) => {
                const info = MAP_ZONES[z.id] || { name: z.id };
                const room = z.room ? roomsByNumber[z.room] : null;
                const isSel = selected === z.id;
                const label = room ? roomAriaLabel(room.name || info.name, room, known) : info.name;
                const taken = !!room && known && room.status === 'booked';
                const onKeyDown = (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select(z.id);
                  }
                };

                let fill = 'transparent';
                if (z.water) fill = `url(#water-${uid})`;
                if (z.id === 'casa') fill = 'rgb(8 8 13 / 0.9)';
                if (room && known) fill = taken ? `url(#hatch-${uid})` : `${statusColor(room, known)}14`;
                if (isSel) fill = 'rgb(255 106 0 / 0.2)';

                let baseStroke = 'rgb(242 237 228 / 0.38)';
                if (z.water) baseStroke = 'rgb(167 139 250 / 0.75)';
                else if (['barraCocteles', 'dj', 'salonJuegos', 'parqueadero', 'casa'].includes(z.id)) baseStroke = 'rgb(242 237 228 / 0.6)';
                if (taken) baseStroke = 'rgb(255 77 94 / 0.7)';

                const ink = isSel ? '#fff' : taken ? 'rgb(242 237 228 / 0.55)' : BONE;
                const soft = isSel ? '#fff' : 'rgb(242 237 228 / 0.78)';
                const focusShape = z.shape.t === 'circle' ? { ...z.shape, r: z.shape.r + 5 } : { ...z.shape, x: z.shape.x - 4, y: z.shape.y - 4, w: z.shape.w + 8, h: z.shape.h + 8, rx: (z.shape.rx || 0) + 4 };

                return (
                  <g key={z.id} className="fd-zone" role="button" tabIndex={0} aria-label={label} aria-pressed={isSel} onClick={() => select(z.id)} onKeyDown={onKeyDown}>
                    {/* Halo de neón cuando está seleccionada */}
                    {isSel && <Shape shape={z.shape} fill="none" stroke={RED} strokeOpacity="0.28" strokeWidth="9" />}
                    {z.water && !isSel && <Shape shape={z.shape} fill="none" stroke="rgb(139 92 246 / 0.25)" strokeWidth="7" />}
                    <Shape
                      shape={z.shape}
                      className="fd-zone-shape"
                      fill={fill}
                      stroke={isSel ? RED : baseStroke}
                      strokeOpacity={isSel ? 1 : 0.9}
                      strokeWidth={isSel ? 2.6 : z.water ? 2 : 1.6}
                      strokeDasharray={z.dashed && !isSel ? '6 6' : undefined}
                      pointerEvents="all"
                    />
                    <Shape shape={focusShape} className="fd-zone-focus" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeDasharray="6 5" />
                    <ZoneLabel z={z} sel={isSel} room={room} known={known} ink={ink} soft={soft} />
                  </g>
                );
              })}

              {/* Cajetín del plano */}
              <g aria-hidden="true" fontFamily={SANS}>
                <g transform="translate(1050 440)">
                  <circle r="22" fill="none" stroke="rgb(242 237 228 / 0.2)" />
                  <path d="M0 -17 L5 3 L0 -1 L-5 3 Z" fill={RED} />
                  <path d="M0 17 L5 -3 L0 1 L-5 -3 Z" fill="rgb(242 237 228 / 0.3)" />
                  <text y="-28" textAnchor="middle" fontSize="13" fontWeight="700" fill="rgb(242 237 228 / 0.55)">
                    N
                  </text>
                </g>
                <rect x="1100" y="412" width="304" height="62" fill="rgb(7 7 10 / 0.6)" stroke="rgb(242 237 228 / 0.25)" />
                <path d="M1100 436 H1404 M1296 436 V474" stroke="rgb(242 237 228 / 0.18)" />
                <text x="1110" y="430" fontSize="13" fontFamily={DISPLAY} letterSpacing="1.4" fill={BONE}>
                  FINCA · PEREIRA · PLANO DE LA NOCHE
                </text>
                <text x="1110" y="452" fontSize="11" fontWeight="600" letterSpacing="1" fill="rgb(242 237 228 / 0.6)">
                  FIESTA DE DISFRACES
                </text>
                <text x="1110" y="466" fontSize="11" fontWeight="600" letterSpacing="1" fill="rgb(255 77 94 / 0.85)">
                  31 · 10 · 2026
                </text>
                <text x="1350" y="452" textAnchor="middle" fontSize="11" fontWeight="600" letterSpacing="1" fill="rgb(242 237 228 / 0.6)">
                  SIN ESCALA
                </text>
                <text x="1350" y="466" textAnchor="middle" fontSize="11" fontWeight="600" letterSpacing="1" fill="rgb(242 237 228 / 0.45)">
                  HOJA 01
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>

      <div ref={panelRef} className="w-full max-w-3xl">
        <ZonePanel zone={zone} config={config} roomsByNumber={roomsByNumber} known={known} />
        <Legend />
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { color: ROOM_STATUS.available.color, label: 'Libre' },
    { color: ROOM_STATUS.held.color, label: 'Apartada' },
    { color: ROOM_STATUS.booked.color, label: 'Ocupada' },
  ];
  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fog" aria-label="Estado de las habitaciones">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function ZonePanel({ zone, config, roomsByNumber, known }) {
  const [viewing, setViewing] = useState(false);

  if (!zone) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-crypt/70 p-6" aria-live="polite">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-pumpkin-light">
          <MousePointerClick className="h-5 w-5" strokeWidth={1.6} />
        </span>
        <h3 className="mt-5 font-display text-3xl uppercase leading-none text-bone">Toca una zona</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-fog">
          Explora la finca: la barra y el DJ, el salón de juegos, el jacuzzi, la piscina y la casa con las habitaciones, con su disponibilidad en vivo.
        </p>
      </div>
    );
  }

  const info = MAP_ZONES[zone.id] || { name: zone.id, description: '' };
  const Icon = ZONE_ICONS[zone.id] || House;
  const room = zone.room ? roomsByNumber[zone.room] : null;
  const salesOpen = config.event?.salesOpen !== false;
  const parking = config.parking || {};
  const phase = config.event?.phase;
  const taken = !!room && known && room.status === 'booked';
  const reserved = !!room && room.reserved === true;
  const hasPhotos = !!room && roomHasPhotos(room.number);

  return (
    <div className="animate-fade-up rounded-3xl border border-pumpkin/30 bg-[linear-gradient(160deg,rgb(255_106_0/0.12),rgb(21_21_28/0.9)_50%)] p-6" aria-live="polite" key={zone.id}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-pumpkin/35 bg-pumpkin/12 text-pumpkin-light">
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </span>
        {room && <RoomStatusBadge status={room.status} known={known} />}
      </div>
      <h3 className="mt-5 font-display text-[2.1rem] uppercase leading-none text-bone">{room?.name || info.name}</h3>
      {info.description && <p className="mt-3 text-[15px] leading-relaxed text-fog">{info.description}</p>}

      {zone.id === 'parqueadero' && (
        <ul className="mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: Car, label: 'Carro', value: parking.carro },
            { icon: Motorbike, label: 'Moto', value: parking.moto },
            { icon: HardHat, label: 'Casco', value: parking.casco },
          ].map(({ icon: I, label, value }) => (
            <li key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <I className="mx-auto h-5 w-5 text-gold" strokeWidth={1.6} />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">{label}</p>
              <p className="mt-0.5 font-display text-xl text-bone">{formatCOP(value)}</p>
            </li>
          ))}
        </ul>
      )}

      {room && (
        <>
          {hasPhotos && <RoomThumb number={room.number} taken={taken} onOpen={() => setViewing(true)} className="mt-5 h-44 w-full rounded-2xl border border-white/10" />}
          {!reserved && (
            <>
              <dl className="mt-4 grid grid-cols-1 gap-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">
                    <Users className="h-3.5 w-3.5" /> Camas y personas
                  </dt>
                  <dd className="mt-1 text-sm text-bone">
                    {room.beds ? `${room.beds} · ` : ''}
                    <span className="font-semibold">{roomPeopleText(room)}</span>
                  </dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">Precio</dt>
                  <dd className="mt-1">
                    <RoomPriceLine room={room} phase={phase} size="sm" />
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-fog">
                Incluye la entrada de todo el grupo{room.privateBathroom ? ' · baño privado' : ''} · se alquila completa, no por cama.
              </p>
            </>
          )}
          {hasPhotos && (
            <button
              type="button"
              onClick={() => setViewing(true)}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] text-sm font-semibold uppercase tracking-[0.1em] text-bone transition hover:bg-white/[0.08]"
            >
              Ver habitación
            </button>
          )}
          {!taken && !reserved && <RoomHelpNote contact={config.contact} room={room} className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3" />}
          {!reserved && (
            <>
              <RoomViewModal
                room={room}
                phase={phase}
                contact={config.contact}
                open={viewing}
                onClose={() => setViewing(false)}
                buyTo={salesOpen && room.status === 'available' ? `/comprar?tipo=habitacion&hab=${room.number}` : null}
              />
              <div className="mt-3">
                {salesOpen && (room.status === 'available' || !known) ? (
                  <Link
                    to={`/comprar?tipo=habitacion&hab=${room.number}`}
                    className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-pumpkin font-semibold text-white shadow-[0_0_30px_-8px_rgb(255_106_0/0.9)] transition hover:bg-pumpkin-light"
                  >
                    Reservar {room.name || `Habitación ${room.number}`}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <p className="flex h-13 items-center justify-center rounded-2xl border border-dashed border-white/12 text-sm font-semibold text-fog">
                    {salesOpen ? (ROOM_STATUS[room.status] || ROOM_STATUS.blocked).label : 'Ventas en línea cerradas'}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
